const BaseScene = require("../runtime/base-scene");
const { GACHA_CONFIG, GRADE_PROFILES, OPERATOR_ORDER, formatDuration } = require("../domain/rules");

const OP_LABEL = {
  "+": "\u52a0\u6cd5",
  "-": "\u51cf\u6cd5",
  "*": "\u4e58\u6cd5",
  "/": "\u9664\u6cd5",
};

function gradeName(gradeId) {
  if (!gradeId) {
    return "";
  }
  return (GRADE_PROFILES[gradeId] || GRADE_PROFILES.grade1).name;
}

class ResultScene extends BaseScene {
  onEnter(params) {
    super.onEnter(params);
    this.result = this.app.latestResult;
    this.refreshInsights();
  }

  refreshInsights() {
    this.report = this.app.storage.getStudyReport(this.app.profile);

    const ops = OPERATOR_ORDER.map((op) => ({
      op,
      label: OP_LABEL[op],
      accuracy: this.report.byOperator[op].accuracy || 0,
      attempts: this.report.byOperator[op].attempts || 0,
    })).filter((item) => item.attempts > 0);

    this.bestOp = ops.length
      ? ops.slice().sort((a, b) => b.accuracy - a.accuracy || b.attempts - a.attempts)[0]
      : null;
    this.weakOp = ops.length
      ? ops.slice().sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts)[0]
      : null;
  }

  suggestedShopTab() {
    if (!this.result) {
      return "items";
    }
    if (this.result.usedRevive || this.result.usedExtraTime) {
      return "items";
    }
    if ((this.app.profile.coins || 0) >= GACHA_CONFIG.costCoins) {
      return "gacha";
    }
    return "skins";
  }

  shopButtonLabel() {
    const coins = this.app.profile.coins || 0;
    return coins >= GACHA_CONFIG.costCoins ? "\u53bb\u62bd\u76f2\u76d2" : "\u53bb\u5546\u5e97";
  }

  render(renderer) {
    this.resetButtons();
    const W = renderer.width;
    const H = renderer.height;
    const top = renderer.topInset;

    this.drawBackground(renderer, W, H);

    if (!this.result) {
      this.drawEmpty(renderer, W, H);
      return;
    }

    this.drawHero(renderer, W, top);
    this.drawRewards(renderer, W, top + 168);
    this.drawLearningCard(renderer, W, top + 312, H);
    this.drawActions(renderer, W, H);
  }

  drawBackground(renderer, W, H) {
    const ctx = renderer.ctx;
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, "#eef4ff");
    gradient.addColorStop(1, "#f8fbff");
    renderer.clear("#eef4ff");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(59, 130, 246, 0.08)";
    ctx.beginPath();
    ctx.arc(W - 40, 94, 100, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(168, 85, 247, 0.08)";
    ctx.beginPath();
    ctx.arc(46, H - 124, 110, 0, Math.PI * 2);
    ctx.fill();
  }

  drawEmpty(renderer, W, H) {
    renderer.modal(
      { x: 16, y: 134, w: W - 32, h: 208 },
      {
        fill: "rgba(255,255,255,0.98)",
        title: "\u6682\u65e0\u7ed3\u7b97\u6570\u636e",
        subtitle: "\u5148\u53bb\u6311\u6218\u4e00\u5c40\uff0c\u7cfb\u7edf\u5c31\u4f1a\u751f\u6210\u5956\u52b1\u548c\u5b66\u4e60\u62a5\u544a",
      }
    );

    const backRect = { x: 20, y: H - 88, w: W - 40, h: 48 };
    renderer.button(backRect, "\u56de\u5230\u9996\u9875", {
      fill: "#2563eb",
      color: "#fff",
      radius: 14,
      fontSize: 18,
    });
    this.registerButton(backRect, () => this.app.switchScene("menu"));
  }

  drawHero(renderer, W, y) {
    const result = this.result;
    const title = result.isClear ? "\u4efb\u52a1\u5b8c\u6210" : "\u518d\u63a5\u518d\u5389";
    const titleColor = result.isClear ? "#166534" : "#7c2d12";
    const grade = gradeName(result.gradeId);
    const sub = [result.modeName, result.difficultyName, grade].filter(Boolean).join(" / ");

    renderer.panel(16, y, W - 32, 152, {
      fill: "rgba(255,255,255,0.96)",
      radius: 20,
      shadow: "rgba(15,23,42,0.12)",
    });
    renderer.text(title, 28, y + 36, {
      size: 30,
      weight: "700",
      color: titleColor,
    });
    renderer.text(sub, 28, y + 66, {
      size: 14,
      color: "#64748b",
    });
    renderer.text(`\u6b63\u786e\u7387 ${result.accuracy || 0}%`, 28, y + 100, {
      size: 17,
      weight: "700",
      color: "#111827",
    });
    renderer.text(`\u7b54\u5bf9 ${result.correctCount}/${result.totalCount}`, W - 28, y + 100, {
      size: 17,
      weight: "700",
      align: "right",
      color: "#111827",
    });
    renderer.text(`\u7528\u65f6 ${formatDuration(result.elapsedMs || 0)}`, 28, y + 126, {
      size: 14,
      color: "#64748b",
    });
    if (result.newTitle) {
      renderer.text(`\u65b0\u79f0\u53f7 ${result.newTitle.name}`, W - 28, y + 126, {
        size: 14,
        align: "right",
        color: "#b45309",
      });
    }

    const shareRect = { x: W - 122, y: y + 12, w: 94, h: 30 };
    renderer.button(shareRect, "\u5206\u4eab\u6210\u7ee9", {
      fill: "#ffffff",
      color: "#1d4ed8",
      border: "#bfdbfe",
      fontSize: 13,
      radius: 10,
    });
    this.registerButton(shareRect, () => this.shareResult());
  }

  drawRewards(renderer, W, y) {
    const result = this.result;
    const coins = result.coins != null ? result.coins : result.points || 0;
    const studyExp = result.studyExp != null ? result.studyExp : result.points || 0;

    renderer.panel(16, y, W - 32, 126, {
      fill: "rgba(255,255,255,0.96)",
      radius: 18,
      shadow: "rgba(15,23,42,0.08)",
    });
    renderer.text("\u5956\u52b1\u4e0e\u8868\u73b0", 28, y + 28, {
      size: 18,
      weight: "700",
      color: "#111827",
    });

    const metrics = [
      { label: "\u91d1\u5e01", value: `+${coins}`, color: "#0f766e" },
      { label: "\u5b66\u4e60\u503c", value: `+${studyExp}`, color: "#1d4ed8" },
      { label: "Combo", value: this.result.comboBest || 0, color: "#2563eb" },
      { label: "CRIT", value: this.result.critCount || 0, color: "#7c3aed" },
    ];

    const gap = 10;
    const cardW = (W - 32 - 20 - gap * 3) / 4;
    metrics.forEach((item, index) => {
      const x = 26 + index * (cardW + gap);
      renderer.panel(x, y + 42, cardW, 70, {
        fill: "#f8fafc",
        radius: 14,
        shadow: "",
      });
      renderer.text(item.label, x + cardW / 2, y + 66, {
        size: 12,
        align: "center",
        color: "#64748b",
      });
      renderer.text(String(item.value), x + cardW / 2, y + 94, {
        size: 20,
        weight: "700",
        align: "center",
        color: item.color,
      });
    });
  }

  drawLearningCard(renderer, W, y, H) {
    const result = this.result;
    const usedLines = [];
    if (result.dailyBonus > 0) {
      usedLines.push(`\u6bcf\u65e5\u5956\u52b1 +${result.dailyBonus}`);
    }
    if (result.speedScore > 0) {
      usedLines.push(`\u6781\u901f\u5206 ${result.speedScore}`);
    }
    if (result.usedRevive) {
      usedLines.push("\u672c\u5c40\u4f7f\u7528\u4e86\u590d\u6d3b\u5361");
    }
    if (result.usedExtraTime) {
      usedLines.push("\u672c\u5c40\u4f7f\u7528\u4e86\u52a0\u65f6\u5361");
    }
    if (result.reasonText) {
      usedLines.push(result.reasonText);
    }
    if (result.petBonusCoins > 0) {
      usedLines.push(`\u840c\u5ba0\u52a0\u6210 +${result.petBonusCoins} \u91d1\u5e01`);
    }
    if ((this.app.profile.coins || 0) >= GACHA_CONFIG.costCoins) {
      usedLines.push(`\u5f53\u524d\u91d1\u5e01\u53ef\u4ee5\u53bb\u76f2\u76d2\u673a\u62bd 1 \u6b21`);
    }

    const cardH = Math.max(150, Math.min(210, H - y - renderer.bottomInset - 128));
    renderer.panel(16, y, W - 32, cardH, {
      fill: "rgba(255,255,255,0.96)",
      radius: 18,
      shadow: "rgba(15,23,42,0.08)",
    });
    renderer.text("\u5b66\u4e60\u53cd\u9988", 28, y + 28, {
      size: 18,
      weight: "700",
      color: "#111827",
    });

    const positive = this.bestOp
      ? `\u4f18\u52bf\u9879\uff1a${this.bestOp.label}\uff0c\u5f53\u524d\u7d2f\u8ba1\u6b63\u786e\u7387 ${this.bestOp.accuracy}%`
      : "\u7ee7\u7eed\u5b8c\u6210\u51e0\u5c40\uff0c\u7cfb\u7edf\u4f1a\u66f4\u51c6\u786e\u5730\u5b9a\u4f4d\u4f18\u52bf\u9879";
    const focus = this.weakOp
      ? `\u5efa\u8bae\u7ee7\u7eed\u5de9\u56fa ${this.weakOp.label}\uff0c\u5bb6\u957f\u53ef\u4ee5\u5f15\u5bfc\u5b69\u5b50\u5148\u6162\u540e\u5feb`
      : "\u76ee\u524d\u8fd8\u5728\u79ef\u7d2f\u6837\u672c\uff0c\u5148\u4fdd\u6301\u6bcf\u65e5\u7a33\u5b9a\u7ec3\u4e60";

    const positiveBlock = renderer.textWrap(positive, 28, y + 58, W - 56, 20, {
      size: 14,
      color: "#475569",
    });
    renderer.textWrap(focus, 28, y + 68 + positiveBlock.height, W - 56, 20, {
      size: 14,
      color: "#475569",
    });

    if (usedLines.length) {
      renderer.textWrap(usedLines.join("  /  "), 28, y + cardH - 40, W - 56, 18, {
        size: 13,
        color: "#64748b",
      });
    }
  }

  drawActions(renderer, W, H) {
    const bottom = renderer.bottomInset;
    const againRect = { x: 20, y: H - bottom - 104, w: W - 40, h: 48 };
    const actionW = (W - 60) / 3;
    const reportRect = { x: 20, y: H - bottom - 48, w: actionW, h: 42 };
    const shopRect = { x: reportRect.x + actionW + 10, y: H - bottom - 48, w: actionW, h: 42 };
    const homeRect = { x: shopRect.x + actionW + 10, y: H - bottom - 48, w: actionW, h: 42 };

    renderer.button(againRect, "\u518d\u6765\u4e00\u5c40", {
      fill: "#2563eb",
      color: "#fff",
      radius: 14,
      fontSize: 18,
    });
    renderer.button(reportRect, "\u5b66\u4e60\u62a5\u544a", {
      fill: "#ffffff",
      color: "#1d4ed8",
      border: "#bfdbfe",
      radius: 12,
      fontSize: 14,
    });
    renderer.button(shopRect, this.shopButtonLabel(), {
      fill: "#fff7ed",
      color: "#c2410c",
      border: "#fdba74",
      radius: 12,
      fontSize: 14,
    });
    renderer.button(homeRect, "\u8fd4\u56de\u9996\u9875", {
      fill: "#ffffff",
      color: "#334155",
      border: "#cbd5e1",
      radius: 12,
      fontSize: 14,
    });
    this.registerButton(againRect, () => this.playAgain());
    this.registerButton(reportRect, () => this.app.switchScene("report"));
    this.registerButton(shopRect, () => this.app.switchScene("shop", { tab: this.suggestedShopTab() }));
    this.registerButton(homeRect, () => this.app.switchScene("menu"));
  }

  shareResult() {
    if (!this.result) {
      return;
    }
    wx.shareAppMessage({
      title: `\u6211\u5728${this.result.modeName}\u4e2d\u7b54\u5bf9 ${this.result.correctCount}/${this.result.totalCount}\uff0c\u6765\u4e00\u8d77\u6311\u6218`,
    });
  }

  playAgain() {
    if (!this.result) {
      this.app.switchScene("menu");
      return;
    }
    if (this.result.mode === "meteor") {
      this.app.switchScene("meteor", {
        grade: this.result.gradeId || this.app.profile.selectedGrade,
      });
      return;
    }
    if (this.result.mode === "speed") {
      this.app.switchScene("single", { mode: "speed" });
      return;
    }
    if (this.result.mode === "battle") {
      this.app.switchScene("battle", {
        autoQuickMatch: true,
        difficulty: this.result.difficulty || "advanced",
      });
      return;
    }
    this.app.switchScene("single", {
      mode: this.result.mode,
      difficulty: this.result.difficulty,
      level: this.result.level,
      grade: this.result.gradeId,
    });
  }
}

module.exports = ResultScene;
