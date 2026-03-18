const BaseScene = require("../runtime/base-scene");
const {
  applyCoinPetBuff,
  applyRoundPetBuff,
  DIFFICULTIES,
  calcPoints,
  generateRound,
  getEquippedPet,
  getEquippedSkin,
  getItemAvailability,
} = require("../domain/rules");

const MODE_NAME = {
  gate: "\u95ef\u5173\u8bad\u7ec3",
  daily: "\u6bcf\u65e5\u95ef\u5173",
  speed: "\u6781\u901f\u6311\u6218",
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
    return 1.6;
  }
  if (bestCombo >= 5) {
    return 1.35;
  }
  if (bestCombo >= 3) {
    return 1.15;
  }
  return 1;
}

class SingleScene extends BaseScene {
  onEnter(params) {
    super.onEnter(params);

    const mode = params.mode || "gate";
    const difficulty = params.difficulty || "beginner";
    const level = Number(params.level || 1);
    const profile = this.app.profile;
    const grade = params.grade || profile.selectedGrade || "grade1";
    this.skin = getEquippedSkin(profile);
    this.pet = getEquippedPet(profile);
    const round = generateRound({ mode, difficulty, level, grade });
    round.config = applyRoundPetBuff(round.config, this.pet, mode);

    this.mode = mode;
    this.difficulty = round.config.difficulty;
    this.level = round.config.level || level;
    this.gradeId = round.config.gradeId;
    this.gradeName = round.config.gradeName;
    this.config = round.config;
    this.questions = round.questions;
    this.phase = "ready";
    this.memoryLeft = round.config.memoryTime;
    this.answerLeft = round.config.answerTime;
    this.currentIndex = 0;
    this.correctCount = 0;
    this.input = "";
    this.tip = "\u51c6\u5907\u5f00\u59cb";
    this.isFinishing = false;
    this.answerStartAt = 0;
    this.currentQuestionStartAt = 0;
    this.tools = getItemAvailability(profile, mode);
    this.usedRevive = false;
    this.usedExtra = false;
    this.petGuardUsed = false;

    this.combo = 0;
    this.bestCombo = 0;
    this.critCount = 0;
    this.effectText = "";
    this.effectTime = 0;
    this.shakeTime = 0;
    this.flashTime = 0;
  }

  update(dt) {
    this.effectTime = Math.max(0, this.effectTime - dt);
    this.shakeTime = Math.max(0, this.shakeTime - dt);
    this.flashTime = Math.max(0, this.flashTime - dt);

    if (this.phase === "memory") {
      const left = Math.max(0, Math.ceil((this.memoryEndAt - Date.now()) / 1000));
      this.memoryLeft = left;
      if (left <= 0) {
        this.startAnswer();
      }
      return;
    }

    if (this.phase === "answer") {
      const left = Math.max(0, Math.ceil((this.answerEndAt - Date.now()) / 1000));
      this.answerLeft = left;
      if (left <= 0) {
        this.finish(false, "timeout");
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
    this.drawPetCompanion(renderer, W);

    if (this.phase === "ready") {
      this.drawReady(renderer, W, H);
    } else if (this.phase === "memory") {
      this.drawMemory(renderer, W, H);
    } else if (this.phase === "answer") {
      this.drawAnswer(renderer, W, H);
    } else {
      this.drawFinishing(renderer, W, H);
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
    gradient.addColorStop(0, "#eff6ff");
    gradient.addColorStop(1, "#f8fafc");
    renderer.clear("#f8fafc");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = style.glow || "rgba(14, 165, 233, 0.08)";
    ctx.beginPath();
    ctx.arc(W - 36, 90, 88, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(52, 211, 153, 0.08)";
    ctx.beginPath();
    ctx.arc(36, H - 120, 82, 0, Math.PI * 2);
    ctx.fill();
  }

  drawHeader(renderer, W) {
    const top = renderer.topInset;
    renderer.panel(16, top, W - 32, 92, {
      fill: "rgba(255,255,255,0.96)",
      radius: 18,
      shadow: "rgba(15,23,42,0.08)",
    });
    renderer.text(MODE_NAME[this.mode], 28, top + 30, {
      size: 25,
      weight: "700",
      color: "#111827",
    });
    const levelText =
      this.mode === "gate" ? `\u7b2c ${this.level} \u5173` : this.mode === "daily" ? "\u4eca\u65e5\u7ec3\u4e60" : "\u9650\u65f6 6 \u9898";
    renderer.text(`${DIFFICULTIES[this.difficulty].name} / ${this.gradeName} / ${levelText}`, 28, top + 58, {
      size: 14,
      color: "#64748b",
    });

    const backRect = { x: W - 112, y: top + 10, w: 84, h: 32 };
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

  drawPetCompanion(renderer, W) {
    if (!this.pet || (this.mode !== "gate" && this.mode !== "daily")) {
      return;
    }
    const x = W - 78;
    const y = renderer.topInset + 106;
    const size = 46;
    const ctx = renderer.ctx;
    ctx.save();
    ctx.fillStyle = this.pet.color || "#34d399";
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.arc(x - 8, y - 4, 4, 0, Math.PI * 2);
    ctx.arc(x + 8, y - 4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    renderer.text(this.pet.name, x, y + 38, {
      size: 11,
      align: "center",
      color: "#475569",
      weight: "700",
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
        ctx.fillRect(x + 10 + (i % 3) * 18, y + 8 + Math.floor(i / 3) * 24, 9, 3);
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
      size: Math.min(58, Math.round(h * 0.48)),
      weight: "700",
      align: "center",
      baseline: "middle",
      color: style.text,
    });
  }

  drawReady(renderer, W, H) {
    const top = renderer.topInset + 104;
    const bottom = renderer.bottomInset;
    renderer.panel(16, top, W - 32, 206, {
      fill: "rgba(255,255,255,0.96)",
      radius: 18,
      shadow: "rgba(15,23,42,0.08)",
    });
    renderer.text("\u672c\u5c40\u76ee\u6807", 28, top + 32, {
      size: 20,
      weight: "700",
      color: "#111827",
    });
    renderer.text(`\u9898\u76ee ${this.questions.length} \u9898`, 28, top + 64, {
      size: 16,
      color: "#475569",
    });
    renderer.text(`\u8bb0\u5fc6 ${this.config.memoryTime} \u79d2`, 28, top + 92, {
      size: 16,
      color: "#475569",
    });
    renderer.text(`\u4f5c\u7b54 ${this.config.answerTime} \u79d2`, 28, top + 120, {
      size: 16,
      color: "#475569",
    });
    renderer.text(`\u5e74\u7ea7\u5927\u7eb2 ${this.gradeName}`, 28, top + 148, {
      size: 16,
      color: "#1d4ed8",
      weight: "700",
    });
    renderer.text(`\u9898\u5361\u4e3b\u9898 ${this.skin.name}`, 28, top + 176, {
      size: 14,
      color: "#2563eb",
      weight: "700",
    });
    renderer.text(`\u51fa\u6218\u840c\u5ba0 ${this.pet ? this.pet.name : "\u672a\u4f69\u6234"}`, W - 28, top + 176, {
      size: 14,
      align: "right",
      color: "#059669",
      weight: "700",
    });
    renderer.text(
      this.tools.reviveCount > 0 ? `\u590d\u6d3b\u5361 x${this.tools.reviveCount}` : "\u590d\u6d3b\u5361\u4e0d\u8db3",
      28,
      top + 198,
      {
        size: 14,
        color: this.tools.reviveCount > 0 ? "#166534" : "#92400e",
      }
    );

    const startRect = { x: 24, y: H - bottom - 48, w: W - 48, h: 48 };
    renderer.button(startRect, "\u5f00\u59cb\u8bb0\u5fc6", {
      fill: "#2e8b57",
      color: "#fff",
      fontSize: 18,
      radius: 14,
    });
    this.registerButton(startRect, () => {
      this.phase = "memory";
      this.memoryEndAt = Date.now() + this.config.memoryTime * 1000;
      this.tip = "\u8bf7\u8bb0\u4f4f\u6240\u6709\u7b97\u5f0f";
    });
  }

  drawMemory(renderer, W, H) {
    const top = renderer.topInset + 104;
    const bottom = renderer.bottomInset;
    renderer.panel(16, top, W - 32, H - top - bottom - 30, {
      fill: "rgba(255,255,255,0.96)",
      radius: 18,
      shadow: "rgba(15,23,42,0.08)",
    });
    renderer.text(`\u8bb0\u5fc6\u5012\u8ba1\u65f6 ${this.memoryLeft}s`, W / 2, top + 40, {
      size: 24,
      weight: "700",
      align: "center",
      color: "#166534",
    });
    renderer.text("\u7a0d\u540e\u4f1a\u8fdb\u5165\u653b\u51fb\u4f5c\u7b54\u9636\u6bb5", W / 2, top + 68, {
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
      const y = top + 94 + row * 60;
      this.drawQuestionCard(renderer, x, y, cardW, 48, question.expression);
    });
  }

  drawAnswer(renderer, W, H) {
    const top = renderer.topInset + 104;
    const bottom = renderer.bottomInset;
    renderer.panel(16, top, W - 32, H - top - bottom - 30, {
      fill: "rgba(255,255,255,0.96)",
      radius: 18,
      shadow: "rgba(15,23,42,0.08)",
    });
    renderer.text(`\u5269\u4f59 ${this.answerLeft}s`, 28, top + 36, {
      size: 22,
      weight: "700",
      color: "#92400e",
    });
    renderer.text(`${this.currentIndex + 1}/${this.questions.length}`, W - 28, top + 36, {
      size: 15,
      align: "right",
      color: "#475569",
    });

    renderer.text(this.combo > 1 ? `Combo x${this.combo}` : "\u84c4\u529b\u4e2d", 28, top + 64, {
      size: 15,
      weight: "700",
      color: this.combo > 1 ? "#2563eb" : "#94a3b8",
    });
    renderer.text(`\u6700\u9ad8\u8fde\u51fb ${this.bestCombo}`, W - 28, top + 64, {
      size: 14,
      align: "right",
      color: "#64748b",
    });

    this.drawQuestionCard(renderer, 34, top + 92, W - 68, 64, this.questions[this.currentIndex].expression);
    renderer.text("\u7b54\u9898\u5373\u653b\u51fb", W / 2, top + 172, {
      size: 14,
      align: "center",
      color: "#64748b",
    });

    renderer.panel(26, top + 180, W - 52, 54, {
      fill: "#f8fafc",
      border: "#d1d5db",
      borderWidth: 1,
      radius: 12,
      shadow: "",
    });
    renderer.text(this.input || "\u8f93\u5165\u7b54\u6848", W / 2, top + 207, {
      size: 28,
      align: "center",
      baseline: "middle",
      color: this.input ? "#111827" : "#94a3b8",
      weight: this.input ? "700" : "normal",
    });

    if (this.mode === "gate" || this.mode === "daily") {
      const extraRect = { x: 26, y: top + 246, w: 124, h: 34 };
      renderer.button(extraRect, this.usedExtra ? "\u52a0\u65f6\u5df2\u7528" : `+2s \u52a0\u65f6 x${this.tools.extraTimeCount}`, {
        fill: this.tools.extraTimeCount > 0 && !this.usedExtra ? "#ecfdf3" : "#f1f5f9",
        color: this.tools.extraTimeCount > 0 && !this.usedExtra ? "#166534" : "#94a3b8",
        border: "#bbf7d0",
        fontSize: 13,
        radius: 8,
        disabled: !this.tools.extraTimeCount || this.usedExtra,
      });
      this.registerButton(
        extraRect,
        () => this.useExtraTime(),
        !this.tools.extraTimeCount || this.usedExtra
      );
    }

    renderer.text(this.tip, W - 26, top + 268, {
      size: 13,
      color: "#64748b",
      align: "right",
    });

    this.drawKeypad(renderer, W, H);
  }

  drawKeypad(renderer, W, H) {
    const startY = H - renderer.bottomInset - 176;
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
        const x = 26 + colIndex * (btnW + gap);
        const y = startY + rowIndex * (btnH + gap);
        const rect = { x, y, w: btnW, h: btnH };
        renderer.button(rect, this.padLabel(key), {
          fill: "#ffffff",
          color: "#1f2937",
          border: "#d1d5db",
          radius: 12,
          fontSize: 18,
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

  drawFinishing(renderer, W, H) {
    const top = renderer.topInset + 152;
    renderer.panel(16, top, W - 32, 150, {
      fill: "rgba(255,255,255,0.96)",
      radius: 18,
      shadow: "rgba(15,23,42,0.08)",
    });
    renderer.text("\u7ed3\u7b97\u4e2d...", W / 2, top + 56, {
      size: 28,
      weight: "700",
      align: "center",
      color: "#111827",
    });
    renderer.text(this.tip, W / 2, top + 92, {
      size: 14,
      align: "center",
      color: "#64748b",
    });
  }

  drawComboFrame(renderer, W, H) {
    const ctx = renderer.ctx;
    const strength = clamp((this.combo - 2) * 0.08, 0, 0.3);
    ctx.strokeStyle = `rgba(59, 130, 246, ${strength})`;
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, W - 16, H - 16);
  }

  padLabel(key) {
    if (key === "clear") {
      return "\u6e05\u7a7a";
    }
    if (key === "delete") {
      return "\u5220\u9664";
    }
    return key;
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

  useExtraTime() {
    if (this.usedExtra || !this.tools.extraTimeCount) {
      return;
    }
    const consume = this.app.storage.consumeInventoryItem(this.app.profile, "extra_time_card", 1);
    if (!consume.ok) {
      this.tip = "\u52a0\u65f6\u5361\u4e0d\u8db3";
      return;
    }
    this.app.profile = consume.profile;
    this.tools = getItemAvailability(this.app.profile, this.mode);
    this.answerEndAt += 2000;
    this.usedExtra = true;
    this.tip = "\u6218\u6597\u65f6\u95f4 +2 \u79d2";
  }

  reviveCurrentQuestion(question) {
    question.status = "retry";
    question.userAnswer = null;
    question.answerMs = 0;
    question.answeredAt = 0;
    this.currentQuestionStartAt = Date.now();
  }

  startAnswer() {
    this.phase = "answer";
    this.answerStartAt = Date.now();
    this.answerEndAt = this.answerStartAt + this.config.answerTime * 1000;
    this.answerLeft = this.config.answerTime;
    this.currentQuestionStartAt = Date.now();
    this.input = "";
    this.tip = "\u8f93\u5165\u7b54\u6848\u53d1\u8d77\u653b\u51fb";
  }

  currentQuestion() {
    return this.questions[this.currentIndex];
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
    this.effectTime = crit ? 0.45 : 0.32;
    return crit;
  }

  registerMiss() {
    this.combo = 0;
    this.effectText = "BREAK";
    this.effectTime = 0.28;
    this.shakeTime = 0.16;
    this.flashTime = 0.16;
  }

  submitAnswer() {
    if (this.phase !== "answer") {
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
    this.input = "";

    if (value === question.answer) {
      this.noteQuestionResult(question, "correct", value);
      this.correctCount += 1;
      const crit = this.registerHit(question.answerMs);
      this.tip = crit ? "\u66b4\u51fb\u547d\u4e2d\uff01" : "\u653b\u51fb\u547d\u4e2d";

      if (this.currentIndex >= this.questions.length - 1) {
        this.finish(true, "complete");
        return;
      }

      this.currentIndex += 1;
      this.currentQuestionStartAt = Date.now();
      return;
    }

    this.noteQuestionResult(question, "wrong", value);
    this.registerMiss();
    this.tip = "\u653b\u51fb\u5931\u8bef";

    if (
      (this.mode === "gate" || this.mode === "daily") &&
      this.pet &&
      this.pet.buff &&
      this.pet.buff.type === "fail_guard_chance" &&
      !this.petGuardUsed &&
      Math.random() < Number(this.pet.buff.value || 0)
    ) {
      this.petGuardUsed = true;
      this.reviveCurrentQuestion(question);
      this.tip = "\u5b88\u62a4\u86cb\u66ff\u4f60\u6321\u4e0b\u4e86\u8fd9\u6b21\u5931\u8bef";
      return;
    }

    if ((this.mode === "gate" || this.mode === "daily") && this.tools.reviveCount > 0 && !this.usedRevive) {
      wx.showModal({
        title: "\u4f7f\u7528\u590d\u6d3b\u5361",
        content: "\u53ef\u4ee5\u7acb\u5373\u91cd\u65b0\u56de\u7b54\u5f53\u524d\u9898",
        confirmText: "\u7acb\u5373\u590d\u6d3b",
        success: (res) => {
          if (res.confirm) {
            const consume = this.app.storage.consumeInventoryItem(this.app.profile, "revive_card", 1);
            if (!consume.ok) {
              this.finish(false, "wrong");
              return;
            }
            this.app.profile = consume.profile;
            this.tools = getItemAvailability(this.app.profile, this.mode);
            this.usedRevive = true;
            this.reviveCurrentQuestion(question);
            this.tip = "\u5df2\u590d\u6d3b\uff0c\u91cd\u65b0\u653b\u51fb";
            return;
          }
          this.finish(false, "wrong");
        },
      });
      return;
    }

    this.finish(false, "wrong");
  }

  markPendingAsTimeout() {
    const now = Date.now();
    this.questions.forEach((question) => {
      if (question.status === "pending" || question.status === "retry") {
        question.status = "timeout";
        question.answerMs = this.answerStartAt ? now - this.answerStartAt : 0;
        question.answeredAt = now;
      }
    });
  }

  async finish(success, reason) {
    if (this.isFinishing) {
      return;
    }
    this.isFinishing = true;

    if (reason === "timeout") {
      this.registerMiss();
      this.markPendingAsTimeout();
    }

    const totalCount = this.questions.length;
    const elapsedMs = this.answerStartAt ? Date.now() - this.answerStartAt : 0;
    const isClear = success && this.correctCount === totalCount;
    const score = calcPoints({
      mode: this.mode,
      correctCount: this.correctCount,
      totalCount,
      elapsedMs,
      isClear,
      coinMultiplier: comboMultiplier(this.bestCombo),
      flatBonusCoins: this.critCount,
    });

    let coins = score.coins;
    const baseCoins = coins;
    coins = applyCoinPetBuff(coins, this.pet, this.mode);
    const petBonusCoins = Math.max(0, coins - baseCoins);
    let dailyBonus = 0;
    if (this.mode === "daily") {
      const dailyUpdate = this.app.storage.touchDaily({
        correctCount: this.correctCount,
        isClear,
      });
      dailyBonus = dailyUpdate.bonus;
      coins += dailyBonus;
    }

    const session = {
      mode: this.mode,
      difficulty: this.difficulty,
      level: this.level,
      gradeId: this.gradeId,
      coins,
      points: coins,
      studyExp: score.studyExp,
      correctCount: this.correctCount,
      totalCount,
      isClear,
      speedScore: score.speedScore,
      elapsedMs,
      battleWin: false,
      comboBest: this.bestCombo,
      critCount: this.critCount,
      questionResults: this.questions,
    };
    const update = this.app.storage.applySession(this.app.profile, session);
    this.app.profile = update.profile;

    if (this.mode === "speed" && isClear && score.speedScore > 0) {
      try {
        await this.app.cloud.uploadSpeedRecord({
          score: score.speedScore,
          elapsedMs,
        });
      } catch (error) {
        // ignore upload failure
      }
    }

    this.app.latestResult = {
      ...session,
      modeName: MODE_NAME[this.mode],
      difficultyName: DIFFICULTIES[this.difficulty].name,
      accuracy: percent(this.correctCount, totalCount),
      reason,
      usedRevive: this.usedRevive,
      usedExtraTime: this.usedExtra,
      petBonusCoins,
      dailyBonus,
      newTitle: update.newTitle,
    };

    this.phase = "finished";
    this.tip = "\u6b63\u5728\u751f\u6210\u7ed3\u7b97...";
    setTimeout(() => {
      this.app.switchScene("result");
    }, 280);
  }
}

module.exports = SingleScene;
