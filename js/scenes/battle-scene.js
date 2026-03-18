const BaseScene = require("../runtime/base-scene");
const {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  calcPoints,
  detectOperator,
  formatDuration,
  getEquippedSkin,
} = require("../domain/rules");
const { decideWinner, shortError } = require("../services/cloud");

const RESULT_REASON = {
  host_first: "\u62a2\u5148\u5168\u5bf9",
  guest_first: "\u62a2\u5148\u5168\u5bf9",
  same_time: "\u51e0\u4e4e\u540c\u65f6\u5b8c\u6210",
  faster: "\u7528\u65f6\u66f4\u5feb",
  guest_wrong: "\u5bf9\u624b\u5931\u8bef",
  host_wrong: "\u5bf9\u624b\u5931\u8bef",
  both_wrong: "\u53cc\u65b9\u90fd\u6709\u5931\u8bef",
  time_up_draw: "\u65f6\u95f4\u8017\u5c3d",
  time_up_score: "\u8017\u65f6\u540e\u6309\u6b63\u786e\u9898\u6570\u5224\u5b9a",
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function percent(correct, total) {
  if (!total) {
    return 0;
  }
  return Math.round((correct / total) * 100);
}

function comboMultiplier(bestCombo) {
  if (bestCombo >= 8) {
    return 1.55;
  }
  if (bestCombo >= 5) {
    return 1.3;
  }
  if (bestCombo >= 3) {
    return 1.12;
  }
  return 1;
}

function padLabel(key) {
  if (key === "clear") {
    return "\u6e05\u7a7a";
  }
  if (key === "delete") {
    return "\u5220\u9664";
  }
  return key;
}

function reasonText(reason) {
  return RESULT_REASON[reason] || "\u5bf9\u5c40\u7ed3\u675f";
}

class BattleScene extends BaseScene {
  onEnter(params) {
    super.onEnter(params);
    this.phase = "lobby";
    this.error = "";
    this.tip = "";
    this.difficulty = (params && params.difficulty) || "advanced";
    this.onlinePlayers = [];
    this.room = null;
    this.roomId = "";
    this.roomCode = "";
    this.role = "";
    this.opponentName = "";
    this.questions = [];
    this.memoryLeft = 0;
    this.answerLeft = 0;
    this.currentIndex = 0;
    this.correctCount = 0;
    this.input = "";
    this.selfProgress = 0;
    this.rivalProgress = 0;
    this.result = null;
    this.resultSaved = false;
    this.hasTimeoutSubmitted = false;
    this.watching = null;
    this.lastRefreshAt = 0;
    this.lastRoomStatus = "";
    this.answerStartAt = 0;
    this.currentQuestionStartAt = 0;

    this.combo = 0;
    this.bestCombo = 0;
    this.critCount = 0;
    this.effectText = "";
    this.effectTime = 0;
    this.shakeTime = 0;
    this.flashTime = 0;
    this.skin = getEquippedSkin(this.app.profile);

    if (!this.app.cloud.ready) {
      this.phase = "error";
      this.error = `\u4e91\u5f00\u53d1\u6682\u4e0d\u53ef\u7528\uff1a${this.app.cloud.reason || "\u672a\u521d\u59cb\u5316"}`;
      return;
    }

    this.startHeartbeat();
    const roomCode = params && params.roomCode ? params.roomCode : "";
    if (roomCode) {
      this.joinByCode(roomCode);
      return;
    }

    this.loadOnlinePlayers();
    this.tip = "\u9009\u62e9\u5728\u7ebf\u597d\u53cb\u53d1\u8d77 PK\uff0c\u6216\u76f4\u63a5\u5feb\u901f\u5339\u914d";
    if (params && params.autoQuickMatch) {
      this.quickMatch();
    }
  }

  onExit() {
    this.stopHeartbeat();
    this.stopWatcher();
    this.app.cloud.heartbeat("").catch(() => {});
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      const code = this.roomCode || "";
      this.app.cloud.heartbeat(code).catch(() => {});
    }, 10000);
    this.app.cloud.heartbeat("").catch(() => {});
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  stopWatcher() {
    if (this.watching) {
      this.watching.close();
      this.watching = null;
    }
  }

  currentQuestion() {
    return this.questions[this.currentIndex] || null;
  }

  mergeQuestions(roomQuestions) {
    return (roomQuestions || []).map((question, index) => {
      const prev = this.questions[index] || {};
      return {
        ...prev,
        id: prev.id || `q_${index}`,
        expression: question.expression,
        answer: question.answer,
        operator: prev.operator || detectOperator(question.expression),
        status: prev.status || "pending",
        userAnswer: prev.userAnswer != null ? prev.userAnswer : null,
        answerMs: prev.answerMs || 0,
        answeredAt: prev.answeredAt || 0,
      };
    });
  }

  update(dt) {
    this.effectTime = Math.max(0, this.effectTime - dt);
    this.shakeTime = Math.max(0, this.shakeTime - dt);
    this.flashTime = Math.max(0, this.flashTime - dt);

    if (this.phase === "lobby" && Date.now() - this.lastRefreshAt > 12000) {
      this.lastRefreshAt = Date.now();
      this.loadOnlinePlayers();
    }

    if (this.phase === "memory" && this.room) {
      this.memoryLeft = Math.max(0, Math.ceil((this.room.memoryEndsAt - Date.now()) / 1000));
      if (this.memoryLeft <= 0 && this.role === "host" && this.room.status === "memory") {
        this.app.cloud.startAnswer(this.roomId, this.room.config.answerTime).catch(() => {});
      }
      return;
    }

    if (this.phase === "answer" && this.room) {
      this.answerLeft = Math.max(0, Math.ceil((this.room.answerEndsAt - Date.now()) / 1000));
      if (!this.currentQuestionStartAt && this.currentQuestion()) {
        this.currentQuestionStartAt = Date.now();
      }
      if (this.answerLeft <= 0 && !this.hasTimeoutSubmitted) {
        this.hasTimeoutSubmitted = true;
        this.submitTimeoutState();
      }
      if (this.role === "host") {
        this.tryFinalize(this.room);
      }
    }
  }

  render(renderer) {
    this.resetButtons();
    const W = renderer.width;
    const H = renderer.height;
    const ctx = renderer.ctx;
    const shakeX = this.shakeTime > 0 ? (Math.random() * 2 - 1) * 4 : 0;
    const shakeY = this.shakeTime > 0 ? (Math.random() * 2 - 1) * 2 : 0;

    ctx.save();
    ctx.translate(shakeX, shakeY);
    this.drawBackground(renderer, W, H);
    this.drawHeader(renderer, W);

    if (this.phase === "error") {
      this.drawError(renderer, W, H);
    } else if (this.phase === "lobby") {
      this.drawLobby(renderer, W, H);
    } else if (this.phase === "waiting") {
      this.drawWaiting(renderer, W, H);
    } else if (this.phase === "memory") {
      this.drawMemory(renderer, W, H);
    } else if (this.phase === "answer") {
      this.drawAnswer(renderer, W, H);
    } else {
      this.drawResult(renderer, W, H);
    }

    if (this.combo >= 3 && this.phase === "answer") {
      this.drawComboFrame(renderer, W, H);
    }
    if (this.effectTime > 0) {
      renderer.text(this.effectText, W / 2, 132, {
        size: this.effectText.indexOf("CRIT") >= 0 ? 30 : 24,
        weight: "700",
        align: "center",
        color: this.effectText.indexOf("CRIT") >= 0 ? "#fde68a" : "#bfdbfe",
      });
    }
    if (this.flashTime > 0) {
      ctx.fillStyle = `rgba(248, 113, 113, ${this.flashTime * 0.6})`;
      ctx.fillRect(-12, -12, W + 24, H + 24);
    }
    ctx.restore();
  }

  drawBackground(renderer, W, H) {
    const ctx = renderer.ctx;
    const style = this.skin.cardStyle;
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, "#f8fbff");
    gradient.addColorStop(1, "#eef4ff");
    renderer.clear("#eef4ff");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = style.glow || "rgba(96, 165, 250, 0.12)";
    ctx.beginPath();
    ctx.arc(W - 26, 116, 94, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(168, 85, 247, 0.08)";
    ctx.beginPath();
    ctx.arc(28, H - 150, 110, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(253, 186, 116, 0.08)";
    for (let i = 0; i < 12; i += 1) {
      const x = ((i * 71) % (W + 60)) - 20;
      const y = ((i * 103) % (H + 140)) - 40;
      ctx.beginPath();
      ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawHeader(renderer, W) {
    const top = renderer.topInset;
    renderer.panel(16, top, W - 32, 92, {
      fill: "rgba(255,255,255,0.96)",
      radius: 20,
      shadow: "rgba(15,23,42,0.12)",
    });
    renderer.text("\u597d\u53cb\u5bf9\u6218", 28, top + 32, {
      size: 28,
      weight: "700",
      color: "#111827",
    });
    renderer.text(`\u6635\u79f0 ${this.app.player.name}`, 28, top + 60, {
      size: 14,
      color: "#64748b",
    });
    const backRect = { x: W - 112, y: top + 14, w: 84, h: 32 };
    renderer.button(backRect, "\u8fd4\u56de", {
      fill: "#eef2f7",
      color: "#334155",
      fontSize: 14,
      radius: 10,
    });
    this.registerButton(backRect, () => {
      this.app.switchScene("menu");
    });
  }

  drawQuestionCard(renderer, x, y, w, h, text) {
    const style = this.skin.cardStyle;
    renderer.panel(x, y, w, h, {
      fill: style.fill,
      border: style.border,
      borderWidth: 1,
      radius: 14,
      shadow: "",
    });
    const ctx = renderer.ctx;
    if (style.pattern === "sprinkles") {
      const colors = ["#fb7185", "#60a5fa", "#fbbf24"];
      for (let i = 0; i < 6; i += 1) {
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(x + 10 + (i % 3) * 18, y + 8 + Math.floor(i / 3) * 20, 9, 3);
      }
    } else if (style.pattern === "stars") {
      ctx.fillStyle = "#bfdbfe";
      for (let i = 0; i < 6; i += 1) {
        ctx.beginPath();
        ctx.arc(x + 12 + (i % 3) * 18, y + 12 + Math.floor(i / 3) * 22, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    renderer.text(text, x + w / 2, y + h / 2 + 1, {
      size: Math.min(56, Math.round(h * 0.48)),
      align: "center",
      baseline: "middle",
      weight: "700",
      color: style.text,
    });
  }

  drawError(renderer, W, H) {
    const top = renderer.topInset + 108;
    const body = renderer.modal(
      { x: 16, y: top, w: W - 32, h: 216 },
      {
        fill: "rgba(255,255,255,0.98)",
        title: "\u5b9e\u65f6\u5bf9\u6218\u6682\u4e0d\u53ef\u7528",
        subtitle: "\u8bf7\u5148\u786e\u8ba4\u4e91\u5f00\u53d1\u73af\u5883\u4e0e\u6570\u636e\u96c6\u5408\u6743\u9650",
      }
    );
    renderer.text(this.error, W / 2, body.y + 32, {
      size: 14,
      align: "center",
      color: "#b45309",
    });
    renderer.text("\u5bf9\u6218\u63d0\u793a\uff1a\u8fd9\u91cc\u9700\u8981 players / rooms \u96c6\u5408\u53ef\u8bfb\u5199", W / 2, body.y + 66, {
      size: 13,
      align: "center",
      color: "#64748b",
    });
    const retryRect = { x: 30, y: H - renderer.bottomInset - 44, w: W - 60, h: 44 };
    renderer.button(retryRect, "\u91cd\u8bd5\u8fde\u63a5", {
      fill: "#ffffff",
      color: "#334155",
      border: "#cbd5e1",
      radius: 12,
      fontSize: 17,
    });
    this.registerButton(retryRect, () => this.retryConnection());
  }

  drawLobby(renderer, W, H) {
    const top = renderer.topInset + 102;
    renderer.panel(16, top, W - 32, H - top - renderer.bottomInset - 18, {
      fill: "rgba(255,255,255,0.96)",
      radius: 18,
      shadow: "rgba(15,23,42,0.1)",
    });
    renderer.text("\u9009\u62e9\u96be\u5ea6", 28, top + 30, {
      size: 18,
      weight: "700",
      color: "#111827",
    });

    const chipW = (W - 60) / 3;
    DIFFICULTY_ORDER.forEach((key, index) => {
      const rect = {
        x: 22 + index * chipW,
        y: top + 42,
        w: chipW - 8,
        h: 34,
      };
      renderer.button(rect, DIFFICULTIES[key].name, {
        fill: this.difficulty === key ? "#2563eb" : "#eff6ff",
        color: this.difficulty === key ? "#fff" : "#1e3a8a",
        fontSize: 14,
        radius: 12,
      });
      this.registerButton(rect, () => {
        this.difficulty = key;
      });
    });

    const quickRect = { x: 24, y: top + 94, w: W - 48, h: 44 };
    const createRect = { x: 24, y: top + 146, w: W - 48, h: 42 };
    const refreshRect = { x: 24, y: top + 196, w: W - 48, h: 38 };
    renderer.button(quickRect, "\u5feb\u901f\u5339\u914d", {
      fill: "#2563eb",
      color: "#fff",
      fontSize: 17,
      radius: 14,
    });
    renderer.button(createRect, "\u521b\u5efa\u623f\u95f4\u9080\u8bf7\u597d\u53cb", {
      fill: "#ffffff",
      color: "#166534",
      border: "#bbf7d0",
      fontSize: 16,
      radius: 12,
    });
    renderer.button(refreshRect, "\u5237\u65b0\u5728\u7ebf\u5217\u8868", {
      fill: "#ffffff",
      color: "#334155",
      border: "#cbd5e1",
      fontSize: 15,
      radius: 12,
    });
    this.registerButton(quickRect, () => this.quickMatch());
    this.registerButton(createRect, () => this.createRoomAndWait(""));
    this.registerButton(refreshRect, () => this.loadOnlinePlayers());

    renderer.text("\u5728\u7ebf\u597d\u53cb", 28, top + 264, {
      size: 18,
      weight: "700",
      color: "#111827",
    });
    renderer.text("\u5bf9\u6218\u6a21\u5f0f\u7981\u7528\u9053\u5177\u4e0e Buff\uff0c\u516c\u5e73\u62fc\u53cd\u5e94", W - 26, top + 264, {
      size: 12,
      align: "right",
      color: "#64748b",
    });

    if (!this.onlinePlayers.length) {
      renderer.text("\u6682\u65e0\u5728\u7ebf\u73a9\u5bb6\uff0c\u53ef\u4ee5\u5148\u521b\u5efa\u623f\u95f4\u53d1\u9001\u9080\u8bf7", 28, top + 294, {
        size: 13,
        color: "#64748b",
      });
    }

    const maxRows = Math.max(1, Math.floor((H - renderer.bottomInset - (top + 302)) / 50));
    this.onlinePlayers.slice(0, maxRows).forEach((item, index) => {
      const y = top + 300 + index * 50;
      renderer.panel(24, y - 18, W - 48, 40, {
        fill: "#f8fafc",
        radius: 12,
        shadow: "",
      });
      renderer.text(item.nickName || "\u73a9\u5bb6", 38, y + 4, {
        size: 15,
        weight: "600",
        color: "#111827",
      });
      renderer.text(item.roomCode ? `\u623f\u95f4 ${item.roomCode}` : "\u5927\u5385\u5728\u7ebf", W - 122, y + 4, {
        size: 12,
        color: "#64748b",
      });
      const inviteRect = { x: W - 88, y: y - 10, w: 54, h: 24 };
      renderer.button(inviteRect, "\u9080\u8bf7", {
        fill: "#fff7ed",
        color: "#9a3412",
        border: "#fdba74",
        radius: 8,
        fontSize: 12,
      });
      this.registerButton(inviteRect, () => this.createRoomAndWait(item.nickName || "\u597d\u53cb"));
    });

    renderer.text(this.tip, 28, H - renderer.bottomInset - 8, {
      size: 12,
      color: "#64748b",
    });
  }

  drawWaiting(renderer, W, H) {
    const top = renderer.topInset + 110;
    const bottom = renderer.bottomInset;
    renderer.panel(16, top, W - 32, H - top - bottom - 18, {
      fill: "rgba(255,255,255,0.96)",
      radius: 18,
      shadow: "rgba(15,23,42,0.1)",
    });

    renderer.text("\u7b49\u5f85\u5bf9\u624b\u52a0\u5165", W / 2, top + 58, {
      size: 28,
      align: "center",
      weight: "700",
      color: "#111827",
    });
    renderer.text("\u5bf9\u6218\u623f\u95f4\u7801", W / 2, top + 94, {
      size: 14,
      align: "center",
      color: "#64748b",
    });
    renderer.text(this.roomCode || "--", W / 2, top + 154, {
      size: 48,
      align: "center",
      weight: "700",
      color: "#ea580c",
    });
    renderer.text("\u4e00\u952e\u5206\u4eab\u7ed9\u597d\u53cb\uff0c\u5bf9\u65b9\u6253\u5f00\u540e\u5373\u53ef\u52a0\u5165", W / 2, top + 196, {
      size: 14,
      align: "center",
      color: "#64748b",
    });

    renderer.panel(26, top + 228, W - 52, 88, {
      fill: "#eff6ff",
      radius: 16,
      shadow: "",
    });
    renderer.text("1. \u70b9\u51fb\u4e0b\u65b9\u5206\u4eab\u623f\u95f4", 40, top + 262, {
      size: 14,
      color: "#1e3a8a",
    });
    renderer.text("2. \u597d\u53cb\u8fdb\u5165\u540e\u81ea\u52a8\u5f00\u59cb\u8bb0\u5fc6\u9636\u6bb5", 40, top + 290, {
      size: 14,
      color: "#1e3a8a",
    });

    const shareRect = { x: 20, y: H - bottom - 96, w: W - 40, h: 48 };
    const cancelRect = { x: 20, y: H - bottom - 42, w: W - 40, h: 42 };
    renderer.button(shareRect, "\u5206\u4eab\u623f\u95f4\u9080\u8bf7", {
      fill: "#2563eb",
      color: "#fff",
      fontSize: 18,
      radius: 14,
    });
    renderer.button(cancelRect, "\u8fd4\u56de\u5bf9\u6218\u5927\u5385", {
      fill: "#ffffff",
      color: "#334155",
      border: "#cbd5e1",
      fontSize: 16,
      radius: 12,
    });
    this.registerButton(shareRect, () => this.shareRoom());
    this.registerButton(cancelRect, () => this.backLobby());
  }

  drawMemory(renderer, W, H) {
    const top = renderer.topInset + 104;
    const bottom = renderer.bottomInset;
    renderer.panel(16, top, W - 32, H - top - bottom - 18, {
      fill: "rgba(255,255,255,0.96)",
      radius: 18,
      shadow: "rgba(15,23,42,0.1)",
    });
    renderer.text(`\u8bb0\u5fc6\u5012\u8ba1\u65f6 ${this.memoryLeft}s`, W / 2, top + 34, {
      size: 26,
      align: "center",
      weight: "700",
      color: "#14532d",
    });
    renderer.text(`\u5bf9\u624b\uff1a${this.opponentName || "\u5f85\u5339\u914d"}`, W / 2, top + 62, {
      size: 14,
      align: "center",
      color: "#64748b",
    });
    renderer.text("\u8bb0\u4f4f\u6240\u6709\u7b97\u5f0f\uff0c\u7a0d\u540e\u62fc\u624b\u901f\u53d1\u8d77\u8fdb\u653b", W / 2, top + 88, {
      size: 14,
      align: "center",
      color: "#64748b",
    });

    const cols = 2;
    const gap = 12;
    const cardW = (W - 56 - gap) / cols;
    this.questions.forEach((question, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const x = 22 + col * (cardW + gap);
      const y = top + 108 + row * 60;
      this.drawQuestionCard(renderer, x, y, cardW, 48, question.expression);
    });
  }

  drawAnswer(renderer, W, H) {
    const top = renderer.topInset + 104;
    renderer.panel(16, top, W - 32, H - top - renderer.bottomInset - 18, {
      fill: "rgba(255,255,255,0.96)",
      radius: 18,
      shadow: "rgba(15,23,42,0.1)",
    });

    renderer.text(`\u5269\u4f59 ${this.answerLeft}s`, 28, top + 34, {
      size: 22,
      weight: "700",
      color: "#92400e",
    });
    renderer.text(`\u5bf9\u624b ${this.opponentName || "-"}`, W - 28, top + 34, {
      size: 14,
      align: "right",
      color: "#64748b",
    });

    renderer.text(this.combo > 1 ? `Combo x${this.combo}` : "\u84c4\u529b\u4e2d", 28, top + 62, {
      size: 15,
      weight: "700",
      color: this.combo > 1 ? "#2563eb" : "#94a3b8",
    });
    renderer.text(`\u6700\u9ad8\u8fde\u51fb ${this.bestCombo}`, W - 28, top + 62, {
      size: 14,
      align: "right",
      color: "#64748b",
    });

    this.drawProgressPanel(renderer, W);

    const question = this.currentQuestion();
    this.drawQuestionCard(renderer, 34, top + 150, W - 68, 48, question ? question.expression : "--");
    renderer.text("\u7b54\u9898\u5373\u653b\u51fb\uff0c\u62a2\u5148\u5168\u5bf9\u5373\u53ef\u83b7\u80dc", W / 2, top + 212, {
      size: 14,
      align: "center",
      color: "#64748b",
    });

    renderer.panel(26, top + 220, W - 52, 54, {
      fill: "#f8fafc",
      border: "#d1d5db",
      borderWidth: 1,
      radius: 12,
      shadow: "",
    });
    renderer.text(this.input || "\u8f93\u5165\u7b54\u6848", W / 2, top + 247, {
      size: 28,
      align: "center",
      baseline: "middle",
      color: this.input ? "#111827" : "#94a3b8",
      weight: this.input ? "700" : "normal",
    });

    renderer.text(this.tip, W / 2, top + 294, {
      size: 13,
      align: "center",
      color: "#64748b",
    });

    this.drawPad(renderer, W, H - renderer.bottomInset - 228);
  }

  drawProgressPanel(renderer, W) {
    renderer.panel(26, 202, W - 52, 64, {
      fill: "#f8fafc",
      radius: 16,
      shadow: "",
    });

    renderer.text("\u6211\u65b9", 40, 226, {
      size: 14,
      weight: "600",
      color: "#166534",
    });
    renderer.text(`\u5df2\u89e3\u51b3 ${this.correctCount}/${this.questions.length || 0}`, W - 38, 226, {
      size: 13,
      align: "right",
      color: "#64748b",
    });
    renderer.progress({ x: 40, y: 236, w: W - 120, h: 10 }, this.selfProgress / 100, {
      bgFill: "#d1fae5",
      fill: "#10b981",
      minFill: this.selfProgress > 0 ? 10 : 0,
    });

    renderer.text("\u5bf9\u624b", 40, 258, {
      size: 14,
      weight: "600",
      color: "#b45309",
    });
    renderer.text(`${this.rivalProgress}%`, W - 38, 258, {
      size: 13,
      align: "right",
      color: "#64748b",
    });
    renderer.progress({ x: 40, y: 268, w: W - 120, h: 10 }, this.rivalProgress / 100, {
      bgFill: "#ffedd5",
      fill: "#f97316",
      minFill: this.rivalProgress > 0 ? 10 : 0,
    });
  }

  drawPad(renderer, W, startY) {
    const rows = [
      ["1", "2", "3"],
      ["4", "5", "6"],
      ["7", "8", "9"],
      ["clear", "0", "delete"],
    ];
    const gap = 8;
    const btnW = (W - 52 - gap * 2) / 3;
    const btnH = 46;

    rows.forEach((row, rowIndex) => {
      row.forEach((key, colIndex) => {
        const rect = {
          x: 26 + colIndex * (btnW + gap),
          y: startY + rowIndex * (btnH + gap),
          w: btnW,
          h: btnH,
        };
        renderer.button(rect, padLabel(key), {
          fill: "#ffffff",
          color: "#1f2937",
          border: "#d1d5db",
          fontSize: 18,
          radius: 12,
        });
        this.registerButton(rect, () => this.onPadKey(key));
      });
    });

    const submitRect = { x: 26, y: startY + 4 * (btnH + gap), w: W - 52, h: 46 };
    renderer.button(submitRect, "\u53d1\u52a8\u653b\u51fb", {
      fill: "#2563eb",
      color: "#fff",
      fontSize: 18,
      radius: 14,
    });
    this.registerButton(submitRect, () => this.submitAnswer());
  }

  drawResult(renderer, W, H) {
    const top = renderer.topInset + 104;
    const bottom = renderer.bottomInset;
    renderer.panel(16, top, W - 32, H - top - bottom - 18, {
      fill: "rgba(255,255,255,0.96)",
      radius: 18,
      shadow: "rgba(15,23,42,0.1)",
    });
    if (!this.result) {
      renderer.text("\u7ed3\u7b97\u4e2d...", W / 2, top + 100, {
        size: 24,
        align: "center",
        weight: "700",
        color: "#111827",
      });
      return;
    }

    const result = this.result;
    const title = result.draw ? "\u52bf\u5747\u529b\u654c" : result.win ? "\u5bf9\u6218\u83b7\u80dc" : "\u60dc\u8d25\u4e00\u5c40";
    const titleColor = result.draw ? "#475569" : result.win ? "#166534" : "#7c2d12";

    renderer.text(title, W / 2, top + 48, {
      size: 30,
      align: "center",
      weight: "700",
      color: titleColor,
    });
    renderer.text(result.reasonText, W / 2, top + 78, {
      size: 14,
      align: "center",
      color: "#64748b",
    });

    renderer.panel(26, top + 100, W - 52, 112, {
      fill: "#f8fafc",
      radius: 16,
      shadow: "",
    });
    renderer.text(`\u6211\u65b9 ${result.correctCount}/${result.totalCount}`, 40, top + 132, {
      size: 17,
      weight: "700",
      color: "#111827",
    });
    renderer.text(`\u5bf9\u624b ${result.rivalCorrect}/${result.totalCount}`, W - 40, top + 132, {
      size: 17,
      align: "right",
      color: "#475569",
    });
    renderer.text(`\u7528\u65f6 ${formatDuration(result.elapsedMs || 0)}`, 40, top + 164, {
      size: 15,
      color: "#64748b",
    });
    renderer.text(`Combo ${result.comboBest}`, W - 40, top + 164, {
      size: 15,
      align: "right",
      color: "#2563eb",
      weight: "700",
    });
    renderer.text(`\u91d1\u5e01 +${result.coins}`, 40, top + 194, {
      size: 18,
      weight: "700",
      color: "#0f766e",
    });
    renderer.text(`\u5b66\u4e60\u503c +${result.studyExp}`, W - 40, top + 194, {
      size: 18,
      align: "right",
      weight: "700",
      color: "#1d4ed8",
    });

    if (result.newTitle) {
      renderer.text(`\u89e3\u9501\u65b0\u79f0\u53f7\uff1a${result.newTitle.name}`, W / 2, top + 240, {
        size: 14,
        align: "center",
        color: "#b45309",
      });
    }
    if (result.critCount > 0) {
      renderer.text(`CRIT x${result.critCount}\uff0c\u5956\u52b1\u91d1\u5e01\u5df2\u8ffd\u52a0`, W / 2, top + 266, {
        size: 13,
        align: "center",
        color: "#7c3aed",
      });
    }

    const againRect = { x: 20, y: H - bottom - 96, w: W - 40, h: 48 };
    const reportRect = { x: 20, y: H - bottom - 42, w: (W - 50) / 2, h: 42 };
    const lobbyRect = { x: reportRect.x + reportRect.w + 10, y: H - bottom - 42, w: (W - 50) / 2, h: 42 };
    renderer.button(againRect, "\u518d\u6765\u4e00\u5c40", {
      fill: "#2563eb",
      color: "#fff",
      fontSize: 18,
      radius: 14,
    });
    renderer.button(reportRect, "\u5b66\u4e60\u62a5\u544a", {
      fill: "#ffffff",
      color: "#1d4ed8",
      border: "#bfdbfe",
      radius: 12,
      fontSize: 15,
    });
    renderer.button(lobbyRect, "\u8fd4\u56de\u5927\u5385", {
      fill: "#ffffff",
      color: "#334155",
      border: "#cbd5e1",
      radius: 12,
      fontSize: 15,
    });
    this.registerButton(againRect, () => this.quickMatch());
    this.registerButton(reportRect, () => this.app.switchScene("report"));
    this.registerButton(lobbyRect, () => this.backLobby());
  }

  drawComboFrame(renderer, W, H) {
    const ctx = renderer.ctx;
    const strength = clamp((this.combo - 2) * 0.08, 0, 0.28);
    ctx.strokeStyle = `rgba(59, 130, 246, ${strength})`;
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, W - 16, H - 16);
  }

  retryConnection() {
    const ready = this.app.cloud.init();
    this.app.cloud.setPlayer(this.app.player);
    if (!ready) {
      this.error = `\u4e91\u5f00\u53d1\u6682\u4e0d\u53ef\u7528\uff1a${this.app.cloud.reason || "\u672a\u521d\u59cb\u5316"}`;
      return;
    }
    this.phase = "lobby";
    this.error = "";
    this.startHeartbeat();
    this.loadOnlinePlayers();
    this.tip = "\u5df2\u91cd\u8bd5\u8fde\u63a5\uff0c\u53ef\u4ee5\u91cd\u65b0\u5339\u914d";
  }

  async loadOnlinePlayers() {
    try {
      const rows = await this.app.cloud.fetchOnlinePlayers();
      this.onlinePlayers = rows;
      this.lastRefreshAt = Date.now();
      this.tip = rows.length ? `\u5728\u7ebf ${rows.length} \u4eba` : "\u5f53\u524d\u6682\u65e0\u5728\u7ebf\u73a9\u5bb6";
    } catch (error) {
      this.tip = `\u5728\u7ebf\u5217\u8868\u5237\u65b0\u5931\u8d25\uff1a${shortError(error)}`;
    }
  }

  async createRoomAndWait(targetName) {
    wx.showLoading({ title: "\u521b\u5efa\u623f\u95f4\u4e2d" });
    try {
      const result = await this.app.cloud.createBattleRoom(this.difficulty);
      this.roomId = result.roomId;
      this.room = result.room;
      this.role = "host";
      this.roomCode = result.room.roomCode;
      this.phase = "waiting";
      this.tip = targetName
        ? `\u623f\u95f4\u5df2\u521b\u5efa\uff0c\u8bf7\u628a\u9080\u8bf7\u53d1\u7ed9 ${targetName}`
        : `\u623f\u95f4 ${this.roomCode} \u5df2\u521b\u5efa\uff0c\u7b49\u5f85\u52a0\u5165`;
      await this.app.cloud.heartbeat(this.roomCode);
      this.watchRoom(this.roomId);
    } catch (error) {
      this.tip = `\u521b\u5efa\u5931\u8d25\uff1a${shortError(error)}`;
    } finally {
      wx.hideLoading();
    }
  }

  async quickMatch() {
    wx.showLoading({ title: "\u5339\u914d\u4e2d" });
    try {
      const result = await this.app.cloud.quickMatch(this.difficulty);
      this.roomId = result.roomId;
      this.room = result.room;
      this.role = result.role;
      this.roomCode = result.room.roomCode;
      this.phase = result.matched ? "memory" : "waiting";
      this.tip = result.matched
        ? "\u5339\u914d\u6210\u529f\uff0c\u51c6\u5907\u53d1\u8d77\u653b\u51fb"
        : `\u672a\u5339\u914d\u5230\u5bf9\u624b\uff0c\u623f\u95f4 ${this.roomCode} \u5df2\u521b\u5efa`;
      await this.app.cloud.heartbeat(this.roomCode);
      this.watchRoom(this.roomId);
      this.handleRoom(result.room);
    } catch (error) {
      this.tip = `\u5339\u914d\u5931\u8d25\uff1a${shortError(error)}`;
    } finally {
      wx.hideLoading();
    }
  }

  async joinByCode(code) {
    wx.showLoading({ title: "\u52a0\u5165\u4e2d" });
    try {
      const result = await this.app.cloud.joinRoomByCode(code);
      this.roomId = result.roomId;
      this.room = result.room;
      this.role = result.role;
      this.roomCode = result.room.roomCode;
      await this.app.cloud.heartbeat(this.roomCode);
      this.watchRoom(this.roomId);
      this.handleRoom(result.room);
    } catch (error) {
      this.phase = "lobby";
      this.tip = `\u52a0\u5165\u5931\u8d25\uff1a${shortError(error)}`;
    } finally {
      wx.hideLoading();
    }
  }

  watchRoom(roomId) {
    this.stopWatcher();
    this.watching = this.app.cloud.watchRoom(
      roomId,
      (room) => this.handleRoom(room),
      (error) => {
        this.tip = `\u623f\u95f4\u8fde\u63a5\u5f02\u5e38\uff1a${shortError(error)}`;
      }
    );
  }

  handleRoom(room) {
    const previousStatus = this.lastRoomStatus || this.phase;
    const previousIndex = this.currentIndex;

    this.room = room;
    if (!this.role) {
      this.role = room.hostId === this.app.player.id ? "host" : "guest";
    }

    const my = this.role === "host" ? room.hostState : room.guestState;
    const rival = this.role === "host" ? room.guestState : room.hostState;
    this.opponentName = this.role === "host" ? room.guestName || "\u7b49\u5f85\u52a0\u5165" : room.hostName || "\u623f\u4e3b";
    this.questions = this.mergeQuestions(room.questions || []);

    const total = this.questions.length || 1;
    this.currentIndex = Math.min(my.index || 0, Math.max(0, total - 1));
    this.correctCount = my.correctCount || 0;
    this.selfProgress = percent(my.correctCount || 0, total);
    this.rivalProgress = percent(rival.correctCount || 0, total);

    if (room.status === "waiting") {
      this.phase = "waiting";
      this.lastRoomStatus = room.status;
      return;
    }

    if (room.status === "memory") {
      this.phase = "memory";
      this.memoryLeft = Math.max(0, Math.ceil((room.memoryEndsAt - Date.now()) / 1000));
      this.tip = "\u8bb0\u4f4f\u6240\u6709\u7b97\u5f0f\uff0c\u51c6\u5907\u548c\u5bf9\u624b\u62fc\u624b\u901f";
      this.lastRoomStatus = room.status;
      return;
    }

    if (room.status === "answer") {
      this.phase = "answer";
      this.answerLeft = Math.max(0, Math.ceil((room.answerEndsAt - Date.now()) / 1000));
      if (previousStatus !== "answer") {
        this.answerStartAt = room.startedAt || Date.now();
        this.currentQuestionStartAt = Date.now();
        this.input = "";
        this.tip = "\u8f93\u5165\u7b54\u6848\u53d1\u8d77\u653b\u51fb\uff0c\u5bf9\u6218\u7981\u7528\u9053\u5177";
      } else if (my.index !== previousIndex && this.currentQuestion()) {
        this.currentQuestionStartAt = Date.now();
      }
      this.lastRoomStatus = room.status;
      return;
    }

    if (room.status === "finished") {
      this.showBattleResult(room);
      this.lastRoomStatus = room.status;
    }
  }

  noteQuestionResult(question, status, userAnswer) {
    question.userAnswer = typeof userAnswer === "number" ? userAnswer : question.userAnswer;
    question.status = status;
    question.answerMs = this.currentQuestionStartAt ? Date.now() - this.currentQuestionStartAt : 0;
    question.answeredAt = Date.now();
  }

  registerHit(answerMs) {
    if (answerMs <= 2200) {
      this.combo += 1;
    } else {
      this.combo = 1;
    }
    this.bestCombo = Math.max(this.bestCombo, this.combo);

    const crit = this.combo >= 5 && answerMs <= 1200;
    if (crit) {
      this.critCount += 1;
    }
    this.effectText = crit ? "CRIT!" : this.combo >= 3 ? `COMBO x${this.combo}` : "HIT!";
    this.effectTime = crit ? 0.46 : 0.32;
    return crit;
  }

  registerMiss() {
    this.combo = 0;
    this.effectText = "BREAK";
    this.effectTime = 0.28;
    this.shakeTime = 0.16;
    this.flashTime = 0.16;
  }

  onPadKey(key) {
    if (this.phase !== "answer") {
      return;
    }
    if (key === "clear") {
      this.input = "";
      return;
    }
    if (key === "delete") {
      this.input = this.input.slice(0, -1);
      return;
    }
    if (this.input.length >= 4) {
      return;
    }
    this.input += key;
  }

  async submitAnswer() {
    if (this.phase !== "answer" || !this.room) {
      return;
    }
    if (!this.input) {
      this.tip = "\u8bf7\u5148\u8f93\u5165\u7b54\u6848";
      return;
    }

    const question = this.currentQuestion();
    if (!question) {
      return;
    }

    const value = Number(this.input);
    const my = this.role === "host" ? this.room.hostState : this.room.guestState;
    this.input = "";

    if (value !== question.answer) {
      this.noteQuestionResult(question, "wrong", value);
      this.registerMiss();
      this.tip = "\u653b\u51fb\u843d\u7a7a\uff0c\u8fde\u51fb\u4e2d\u65ad";
      const wrong = {
        ...my,
        finished: true,
        wrong: true,
        allCorrect: false,
        finishAt: Date.now(),
      };
      await this.app.cloud.updateBattleState(this.roomId, this.role, wrong);
      return;
    }

    this.noteQuestionResult(question, "correct", value);
    const crit = this.registerHit(question.answerMs);
    this.tip = crit
      ? "\u66b4\u51fb\u547d\u4e2d\uff0c\u62a2\u5148\u538b\u5236\u5bf9\u624b"
      : this.combo >= 3
      ? `\u8fde\u51fb x${this.combo}`
      : "\u653b\u51fb\u547d\u4e2d";

    const nextCorrect = (my.correctCount || 0) + 1;
    const total = this.questions.length || 1;
    const isLast = this.currentIndex >= this.questions.length - 1;
    const state = {
      ...my,
      index: isLast ? this.currentIndex : this.currentIndex + 1,
      correctCount: nextCorrect,
      finished: isLast,
      wrong: false,
      allCorrect: isLast,
      finishAt: isLast ? Date.now() : 0,
    };

    this.correctCount = nextCorrect;
    this.selfProgress = percent(nextCorrect, total);
    if (!isLast) {
      this.currentIndex += 1;
      this.currentQuestionStartAt = Date.now();
    }

    await this.app.cloud.updateBattleState(this.roomId, this.role, state);
  }

  async submitTimeoutState() {
    if (!this.room || this.phase !== "answer") {
      return;
    }
    const my = this.role === "host" ? this.room.hostState : this.room.guestState;
    if (my.finished) {
      return;
    }

    const question = this.currentQuestion();
    if (question && (question.status === "pending" || question.status === "retry")) {
      this.noteQuestionResult(question, "timeout");
    }
    this.registerMiss();
    this.tip = "\u8d85\u65f6\uff0c\u672c\u6b21\u653b\u51fb\u7ed3\u675f";

    const timeout = {
      ...my,
      finished: true,
      wrong: true,
      allCorrect: false,
      finishAt: Date.now(),
    };
    await this.app.cloud.updateBattleState(this.roomId, this.role, timeout);
  }

  async tryFinalize(room) {
    if (!room || room.status !== "answer" || room.winner) {
      return;
    }
    const result = decideWinner(room);
    if (!result) {
      return;
    }
    try {
      await this.app.cloud.finalizeRoom(this.roomId, result);
    } catch (error) {
      // ignore if already finalized elsewhere
    }
  }

  showBattleResult(room) {
    this.phase = "result";
    this.stopWatcher();
    this.app.cloud.heartbeat("").catch(() => {});

    const my = this.role === "host" ? room.hostState : room.guestState;
    const rival = this.role === "host" ? room.guestState : room.hostState;
    const win = room.winner === this.role;
    const draw = room.winner === "draw";
    const totalCount = (room.questions || []).length;
    const elapsedMs = my.finishAt && room.startedAt ? Math.max(0, my.finishAt - room.startedAt) : 0;
    const baseReward = calcPoints({
      mode: "battle",
      correctCount: my.correctCount || 0,
      totalCount,
      elapsedMs,
      isClear: win,
      coinMultiplier: comboMultiplier(this.bestCombo),
      flatBonusCoins: this.critCount + (win ? 5 : draw ? 2 : 0),
    });
    const coins = baseReward.coins;
    const studyExp = baseReward.studyExp + (win ? 3 : draw ? 1 : 0);

    if (!this.resultSaved) {
      const update = this.app.storage.applySession(this.app.profile, {
        mode: "battle",
        difficulty: room.difficulty,
        coins,
        studyExp,
        correctCount: my.correctCount || 0,
        totalCount,
        isClear: win,
        battleWin: win,
        elapsedMs,
        comboBest: this.bestCombo,
        critCount: this.critCount,
        opponent: {
          id: this.role === "host" ? room.guestId : room.hostId,
          name: this.opponentName,
        },
        questionResults: this.questions,
      });
      this.app.profile = update.profile;
      this.resultSaved = true;
      this.result = {
        win,
        draw,
        coins,
        studyExp,
        points: coins,
        correctCount: my.correctCount || 0,
        rivalCorrect: rival.correctCount || 0,
        totalCount,
        elapsedMs,
        comboBest: this.bestCombo,
        critCount: this.critCount,
        reasonText: reasonText(room.reason),
        newTitle: update.newTitle,
      };
      this.app.latestResult = {
        mode: "battle",
        difficulty: room.difficulty,
        isClear: win,
        modeName: "\u597d\u53cb\u5bf9\u6218",
        difficultyName: DIFFICULTIES[room.difficulty].name,
        coins,
        studyExp,
        points: coins,
        comboBest: this.bestCombo,
        critCount: this.critCount,
        correctCount: my.correctCount || 0,
        rivalCorrect: rival.correctCount || 0,
        totalCount,
        elapsedMs,
        accuracy: totalCount ? percent(my.correctCount || 0, totalCount) : 0,
        reason: room.reason,
        reasonText: reasonText(room.reason),
        newTitle: update.newTitle,
      };
      return;
    }

    if (!this.result) {
      this.result = {
        win,
        draw,
        coins,
        studyExp,
        points: coins,
        correctCount: my.correctCount || 0,
        rivalCorrect: rival.correctCount || 0,
        totalCount,
        elapsedMs,
        comboBest: this.bestCombo,
        critCount: this.critCount,
        reasonText: reasonText(room.reason),
      };
    }
  }

  shareRoom() {
    if (!this.roomCode) {
      return;
    }
    wx.shareAppMessage({
      title: `\u6765\u6570\u5fc6\u6570\u548c\u6211 PK\uff0c\u623f\u95f4\u7801 ${this.roomCode}`,
      query: `roomCode=${this.roomCode}`,
    });
  }

  backLobby() {
    this.stopWatcher();
    this.room = null;
    this.roomId = "";
    this.roomCode = "";
    this.role = "";
    this.phase = "lobby";
    this.result = null;
    this.resultSaved = false;
    this.hasTimeoutSubmitted = false;
    this.questions = [];
    this.currentIndex = 0;
    this.correctCount = 0;
    this.input = "";
    this.combo = 0;
    this.bestCombo = 0;
    this.critCount = 0;
    this.effectTime = 0;
    this.flashTime = 0;
    this.shakeTime = 0;
    this.lastRoomStatus = "";
    this.app.cloud.heartbeat("").catch(() => {});
    this.loadOnlinePlayers();
  }
}

module.exports = BattleScene;
