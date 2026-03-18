const BaseScene = require("../runtime/base-scene");
const { GRADE_ORDER, GRADE_PROFILES, OPERATOR_ORDER } = require("../domain/rules");

const OP_LABEL = {
  "+": "\u52a0\u6cd5",
  "-": "\u51cf\u6cd5",
  "*": "\u4e58\u6cd5",
  "/": "\u9664\u6cd5",
};

const MODE_LABEL = {
  gate: "\u95ef\u5173",
  daily: "\u6bcf\u65e5",
  speed: "\u6781\u901f",
  battle: "\u5bf9\u6218",
  meteor: "\u5854\u9632",
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function secondsText(ms) {
  if (!ms) {
    return "--";
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

function gradeText(gradeId) {
  return (GRADE_PROFILES[gradeId] || GRADE_PROFILES.grade1).name;
}

function drawBarChart(renderer, rect, items, opts) {
  const maxValue = Math.max(1, Number(opts.maxValue || 100));
  const title = opts.title || "";
  const subtitle = opts.subtitle || "";
  const formatValue = opts.formatValue || ((value) => String(value));
  const emptyText = opts.emptyText || "\u6682\u65e0\u6570\u636e";

  renderer.panel(rect.x, rect.y, rect.w, rect.h, {
    fill: "rgba(255,255,255,0.96)",
    radius: 18,
    shadow: "rgba(15,23,42,0.12)",
  });

  renderer.text(title, rect.x + 16, rect.y + 28, {
    size: 18,
    weight: "700",
    color: "#111827",
  });
  if (subtitle) {
    renderer.text(subtitle, rect.x + rect.w - 16, rect.y + 28, {
      size: 12,
      align: "right",
      color: "#64748b",
    });
  }

  if (!items.length) {
    renderer.text(emptyText, rect.x + rect.w / 2, rect.y + rect.h / 2 + 8, {
      size: 16,
      align: "center",
      color: "#94a3b8",
    });
    return;
  }

  const labelW = 52;
  const valueW = 56;
  const chartX = rect.x + 16;
  const chartY = rect.y + 52;
  const rowH = Math.max(28, Math.floor((rect.h - 68) / items.length));
  const barW = rect.w - 32 - labelW - valueW - 12;

  items.forEach((item, index) => {
    const y = chartY + index * rowH;
    const ratio = clamp(item.value / maxValue, 0, 1);
    renderer.text(item.label, chartX, y + 16, {
      size: 14,
      weight: "600",
      color: "#334155",
    });
    renderer.panel(chartX + labelW, y + 4, barW, 16, {
      fill: "#e5e7eb",
      radius: 999,
      shadow: "",
    });
    renderer.panel(chartX + labelW, y + 4, Math.max(6, barW * ratio), 16, {
      fill: item.color || "#2563eb",
      radius: 999,
      shadow: "",
    });
    renderer.text(formatValue(item.value, item), rect.x + rect.w - 16, y + 16, {
      size: 13,
      weight: "700",
      align: "right",
      color: "#111827",
    });
  });
}

class ReportScene extends BaseScene {
  onEnter() {
    this.chartTab = "accuracy";
    this.refresh();
  }

  refresh() {
    this.profile = this.app.profile;
    this.report = this.app.storage.getStudyReport(this.app.profile);
  }

  gradeBucket() {
    return this.report.byGrade[this.profile.selectedGrade] || {
      sessions: 0,
      answers: 0,
      correct: 0,
      totalMs: 0,
      avgMs: 0,
      accuracy: 0,
    };
  }

  cycleGrade() {
    const current = this.profile.selectedGrade || "grade1";
    const index = GRADE_ORDER.indexOf(current);
    const next = GRADE_ORDER[(index + 1 + GRADE_ORDER.length) % GRADE_ORDER.length];
    this.app.profile = this.app.storage.setSelectedGrade(this.app.profile, next);
    this.refresh();
  }

  getAccuracyItems() {
    const colors = {
      "+": "#34d399",
      "-": "#60a5fa",
      "*": "#f59e0b",
      "/": "#a78bfa",
    };

    return OPERATOR_ORDER.map((op) => ({
      id: op,
      label: OP_LABEL[op],
      value: this.report.byOperator[op].accuracy || 0,
      attempts: this.report.byOperator[op].attempts || 0,
      color: colors[op],
    })).filter((item) => item.attempts > 0);
  }

  getSpeedItems() {
    const colors = {
      "+": "#10b981",
      "-": "#3b82f6",
      "*": "#f97316",
      "/": "#8b5cf6",
    };
    return OPERATOR_ORDER.map((op) => ({
      id: op,
      label: OP_LABEL[op],
      value: this.report.byOperator[op].avgMs || 0,
      attempts: this.report.byOperator[op].attempts || 0,
      color: colors[op],
    })).filter((item) => item.attempts > 0);
  }

  getWeaknessLine() {
    const accuracyItems = this.getAccuracyItems();
    const gradeBucket = this.gradeBucket();
    if (!accuracyItems.length) {
      return "\u5148\u5b8c\u6210\u51e0\u5c40\u6e38\u620f\uff0c\u5c31\u80fd\u770b\u5230\u5b69\u5b50\u7684\u8584\u5f31\u70b9\u5206\u6790";
    }
    const weakest = accuracyItems.slice().sort((a, b) => a.value - b.value || b.attempts - a.attempts)[0];
    if ((gradeBucket.sessions || 0) < 3) {
      return `\u5f53\u524d${gradeText(this.profile.selectedGrade)}\u6837\u672c\u8fd8\u4e0d\u591f\uff0c\u5efa\u8bae\u518d\u7ec3 3 \u5c40\u8ba9\u5206\u6790\u66f4\u7a33`;
    }
    if (weakest.value >= 90) {
      return "\u76ee\u524d\u5404\u7c7b\u9898\u578b\u8868\u73b0\u5f88\u7a33\uff0c\u53ef\u4ee5\u9010\u6b65\u63d0\u5347\u5e74\u7ea7\u96be\u5ea6";
    }
    return `\u5f53\u524d\u9700\u8981\u91cd\u70b9\u5de9\u56fa${weakest.label}\uff0c\u5efa\u8bae\u518d\u591a\u505a 3-5 \u5c40\u540c\u7c7b\u9898\u7ec3\u4e60`;
  }

  getStrengthLine() {
    const accuracyItems = this.getAccuracyItems();
    const gradeBucket = this.gradeBucket();
    if (!accuracyItems.length) {
      return "\u7cfb\u7edf\u4f1a\u5728\u4f60\u7b2c\u4e00\u6b21\u5bf9\u5c40\u540e\u81ea\u52a8\u751f\u6210\u6210\u957f\u62a5\u544a";
    }
    const best = accuracyItems.slice().sort((a, b) => b.value - a.value || b.attempts - a.attempts)[0];
    if ((gradeBucket.sessions || 0) < 3) {
      return `${best.label}\u5f53\u524d\u5df2\u5f00\u59cb\u5c55\u73b0\u4f18\u52bf\uff0c\u5148\u4fdd\u6301\u540c\u5e74\u7ea7\u7a33\u5b9a\u7ec3\u4e60`;
    }
    return `${best.label}\u662f\u76ee\u524d\u4f18\u52bf\u9879\uff0c\u53ef\u4ee5\u5f15\u5bfc\u5b69\u5b50\u5728\u81ea\u4fe1\u611f\u6700\u5f3a\u7684\u9898\u578b\u4e2d\u7ee7\u7eed\u7a4d\u7d2f`;
  }

  drawSummary(renderer, W, y, h) {
    const height = h || 92;
    const gradeBucket = this.gradeBucket();
    renderer.panel(16, y, W - 32, height, {
      fill: "rgba(255,255,255,0.96)",
      radius: 18,
      shadow: "rgba(15,23,42,0.12)",
    });

    const metrics = [
      { label: "\u603b\u5c40\u6570", value: this.report.totalSessions || 0, color: "#0f766e" },
      { label: "\u5e74\u7ea7\u6b63\u786e\u7387", value: `${gradeBucket.accuracy || 0}%`, color: "#2563eb" },
      { label: "\u5e73\u5747\u53cd\u5e94", value: secondsText(this.report.avgAnswerMs || 0), color: "#7c3aed" },
      { label: "\u5e74\u7ea7\u5c40\u6570", value: gradeBucket.sessions || 0, color: "#ea580c" },
    ];

    const gap = 10;
    const metricW = (W - 32 - 20 - gap * 3) / 4;
    metrics.forEach((item, index) => {
      const x = 26 + index * (metricW + gap);
      const innerY = y + 10;
      const innerH = height - 20;
      renderer.panel(x, innerY, metricW, innerH, {
        fill: "#f8fafc",
        radius: 14,
        shadow: "",
      });
      renderer.text(item.label, x + metricW / 2, innerY + 20, {
        size: 12,
        align: "center",
        color: "#64748b",
      });
      renderer.text(String(item.value), x + metricW / 2, innerY + innerH - 18, {
        size: 18,
        weight: "700",
        align: "center",
        color: item.color,
      });
    });
  }

  overallAccuracy() {
    return this.report.totalAnswers
      ? Math.round((this.report.totalCorrect / this.report.totalAnswers) * 100)
      : 0;
  }

  drawTabs(renderer, W, y) {
    renderer.panel(16, y, W - 32, 54, {
      fill: "rgba(255,255,255,0.96)",
      radius: 16,
      shadow: "rgba(15,23,42,0.08)",
    });
    const left = { x: 22, y: y + 7, w: (W - 44) / 2 - 6, h: 40 };
    const right = { x: 22 + (W - 44) / 2 + 2, y: y + 7, w: (W - 44) / 2 - 6, h: 40 };
    renderer.button(left, "\u6b63\u786e\u7387", {
      fill: this.chartTab === "accuracy" ? "#2563eb" : "#eff6ff",
      color: this.chartTab === "accuracy" ? "#fff" : "#1e3a8a",
      radius: 10,
      fontSize: 15,
    });
    renderer.button(right, "\u901f\u5ea6", {
      fill: this.chartTab === "speed" ? "#2563eb" : "#eff6ff",
      color: this.chartTab === "speed" ? "#fff" : "#1e3a8a",
      radius: 10,
      fontSize: 15,
    });
    this.registerButton(left, () => {
      this.chartTab = "accuracy";
    });
    this.registerButton(right, () => {
      this.chartTab = "speed";
    });
  }

  drawInsights(renderer, W, y, h) {
    const height = h || 106;
    renderer.panel(16, y, W - 32, height, {
      fill: "rgba(255,255,255,0.96)",
      radius: 18,
      shadow: "rgba(15,23,42,0.08)",
    });
    renderer.text("\u5bb6\u957f\u5efa\u8bae", 30, y + 28, {
      size: 18,
      weight: "700",
      color: "#111827",
    });
    const weakBlock = renderer.textWrap(this.getWeaknessLine(), 30, y + 56, W - 76, 18, {
      size: 14,
      color: "#475569",
    });
    renderer.textWrap(this.getStrengthLine(), 30, y + 64 + weakBlock.height, W - 76, 18, {
      size: 14,
      color: "#475569",
    });

    const btnY = y + height - 44;
    const left = { x: 28, y: btnY, w: (W - 72) / 2, h: 32 };
    const right = { x: left.x + left.w + 16, y: btnY, w: (W - 72) / 2, h: 32 };
    renderer.button(left, "\u95ef\u5173\u5de9\u56fa", {
      fill: "#2563eb",
      color: "#fff",
      radius: 10,
      fontSize: 14,
    });
    renderer.button(right, "\u5854\u9632\u63d0\u901f", {
      fill: "#ffffff",
      color: "#1d4ed8",
      border: "#bfdbfe",
      radius: 10,
      fontSize: 14,
    });
    this.registerButton(left, () => this.app.switchScene("gate"));
    this.registerButton(right, () =>
      this.app.switchScene("meteor", {
        grade: this.profile.selectedGrade,
      })
    );
  }

  drawRecent(renderer, W, y, h) {
    const height = h || 124;
    renderer.panel(16, y, W - 32, height, {
      fill: "rgba(255,255,255,0.96)",
      radius: 18,
      shadow: "rgba(15,23,42,0.08)",
    });
    renderer.text("\u6700\u8fd1 3 \u5c40", 30, y + 28, {
      size: 18,
      weight: "700",
      color: "#111827",
    });

    const sessions = (this.report.recentSessions || []).slice(0, height < 100 ? 2 : 3);
    if (!sessions.length) {
      renderer.text("\u8fd8\u6ca1\u6709\u8db3\u591f\u6570\u636e\uff0c\u5148\u53bb\u73a9\u4e00\u5c40\u5427", 30, y + 62, {
        size: 14,
        color: "#94a3b8",
      });
      return;
    }

    sessions.forEach((session, index) => {
      const lineY = y + 56 + index * 22;
      const mode = MODE_LABEL[session.mode] || session.mode;
      const grade = gradeText(session.gradeId);
      const text = `${mode} / ${grade}  \u6b63\u786e\u7387 ${session.accuracy}%  \u5e73\u5747 ${secondsText(session.avgAnswerMs)}`;
      renderer.text(text, 30, lineY, {
        size: 13,
        color: "#475569",
      });
    });
  }

  render(renderer) {
    this.resetButtons();
    const W = renderer.width;
    const H = renderer.height;
    const top = renderer.topInset;
    const bottom = renderer.bottomInset;
    const report = this.report;
    const summaryH = H < 640 ? 82 : 92;
    const recentH = H < 640 ? 84 : 110;
    const insightsH = H < 640 ? 110 : 132;
    const summaryY = top + 100;
    const tabsY = summaryY + summaryH + 12;
    const chartY = tabsY + 64;
    const recentY = H - bottom - recentH - 8;
    const insightsY = recentY - insightsH - 10;
    const chartH = Math.max(96, insightsY - chartY - 10);

    renderer.clear("#eef4ff");
    this.drawBackground(renderer, W, H);

    renderer.panel(16, top, W - 32, 88, {
      fill: "rgba(255,255,255,0.96)",
      radius: 20,
      shadow: "rgba(15,23,42,0.12)",
    });
    renderer.text("\u5b66\u4e60\u62a5\u544a", 28, top + 32, {
      size: 28,
      weight: "700",
      color: "#111827",
    });
    renderer.text(
      `\u5f53\u524d\u5e74\u7ea7 ${gradeText(this.profile.selectedGrade)}  |  \u7d2f\u79ef\u66b4\u51fb ${report.totalCrits || 0}`,
      28,
      top + 60,
      {
        size: 14,
        color: "#64748b",
      }
    );

    const gradeRect = { x: W - 228, y: top + 8, w: 106, h: 32 };
    renderer.button(gradeRect, `\u5207\u6362 ${gradeText(this.profile.selectedGrade)}`, {
      fill: "#eef2ff",
      color: "#4338ca",
      border: "#c7d2fe",
      fontSize: 12,
      radius: 10,
    });
    this.registerButton(gradeRect, () => this.cycleGrade());

    const backRect = { x: W - 112, y: top + 8, w: 84, h: 32 };
    renderer.button(backRect, "\u8fd4\u56de", {
      fill: "#e2e8f0",
      color: "#334155",
      fontSize: 14,
      radius: 10,
    });
    this.registerButton(backRect, () => {
      this.app.switchScene("menu");
    });

    this.drawSummary(renderer, W, summaryY, summaryH);
    this.drawTabs(renderer, W, tabsY);

    if (this.chartTab === "accuracy") {
      drawBarChart(
        renderer,
        { x: 16, y: chartY, w: W - 32, h: chartH },
        this.getAccuracyItems(),
        {
          title: "\u5404\u9898\u578b\u6b63\u786e\u7387",
          subtitle: "\u8d8a\u9ad8\u8d8a\u7a33",
          maxValue: 100,
          formatValue: (value, item) => `${value}%`,
          emptyText: "\u5b8c\u6210\u4e00\u5c40\u540e\u5373\u53ef\u770b\u5230\u9898\u578b\u6b63\u786e\u7387",
        }
      );
    } else {
      const speedItems = this.getSpeedItems();
      const maxMs = speedItems.reduce((max, item) => Math.max(max, item.value), 1000);
      drawBarChart(
        renderer,
        { x: 16, y: chartY, w: W - 32, h: chartH },
        speedItems,
        {
          title: "\u5404\u9898\u578b\u5e73\u5747\u53cd\u5e94\u65f6\u957f",
          subtitle: "\u8d8a\u4f4e\u8d8a\u5feb",
          maxValue: maxMs,
          formatValue: (value) => secondsText(value),
          emptyText: "\u518d\u73a9\u51e0\u5c40\uff0c\u5c31\u80fd\u770b\u5230\u901f\u5ea6\u5206\u6790",
        }
      );
    }

    this.drawInsights(renderer, W, insightsY, insightsH);
    this.drawRecent(renderer, W, recentY, recentH);
  }

  drawBackground(renderer, W, H) {
    const ctx = renderer.ctx;
    ctx.fillStyle = "#eef4ff";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(59, 130, 246, 0.12)";
    ctx.beginPath();
    ctx.arc(W - 48, 86, 88, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(20, 184, 166, 0.12)";
    ctx.beginPath();
    ctx.arc(34, H - 120, 96, 0, Math.PI * 2);
    ctx.fill();
  }
}

module.exports = ReportScene;
