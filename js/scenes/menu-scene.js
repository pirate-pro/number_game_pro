const BaseScene = require("../runtime/base-scene");
const { GRADE_ORDER, GRADE_PROFILES, PET_DEFS, SKIN_DEFS, TITLES } = require("../domain/rules");

function titleName(id) {
  const target = TITLES.find((item) => item.id === id);
  return target ? target.name : TITLES[0].name;
}

class MenuScene extends BaseScene {
  onEnter(params) {
    super.onEnter(params);
    this.refresh();
  }

  refresh() {
    this.profile = this.app.profile;
    this.daily = this.app.storage.getDailyState();
    this.pendingRoomCode = this.params && this.params.roomCode ? this.params.roomCode : "";
    if (this.pendingRoomCode) {
      this.app.switchScene("battle", { roomCode: this.pendingRoomCode });
    }
  }

  render(renderer) {
    this.resetButtons();
    const W = renderer.width;
    const H = renderer.height;
    const top = renderer.topInset;
    const bottom = renderer.bottomInset;
    const profile = this.profile || this.app.profile;
    const gradeId = profile.selectedGrade || "grade1";
    const gradeName = (GRADE_PROFILES[gradeId] || GRADE_PROFILES.grade1).name;

    renderer.clear("#eef4ff");
    this.drawBackground(renderer, W, H);

    renderer.panel(16, top, W - 32, 156, {
      fill: "rgba(255,255,255,0.94)",
      shadow: "rgba(15,23,42,0.12)",
      radius: 20,
    });
    renderer.text("\u6570\u5fc6\u6570", 28, top + 34, {
      size: 30,
      weight: "700",
      color: "#111827",
    });
    renderer.text("\u8ba9\u5fc3\u7b97\u50cf\u5192\u9669\u4e00\u6837\u6709\u8da3", 28, top + 62, {
      size: 15,
      color: "#64748b",
    });
    renderer.text(`\u91d1\u5e01 ${profile.coins || 0}`, 28, top + 96, {
      size: 16,
      weight: "700",
      color: "#0f766e",
    });
    renderer.text(`\u5b66\u4e60\u503c ${profile.studyExp || profile.points || 0}`, 28, top + 120, {
      size: 16,
      weight: "700",
      color: "#1d4ed8",
    });
    renderer.text(`\u79f0\u53f7 ${titleName(profile.activeTitle)}`, W - 28, top + 96, {
      size: 15,
      align: "right",
      color: "#475569",
    });
    renderer.text(`\u5f53\u524d\u5e74\u7ea7 ${gradeName}`, W - 28, top + 120, {
      size: 15,
      align: "right",
      color: "#7c3aed",
    });
    const skin = SKIN_DEFS[(profile.skins && profile.skins.equipped) || "skin_basic"] || SKIN_DEFS.skin_basic;
    const pet = PET_DEFS[profile.pets && profile.pets.equipped] || PET_DEFS.pet_memory_sprite;
    renderer.text(`\u4e3b\u9898 ${skin.name}`, 28, top + 144, {
      size: 13,
      color: "#2563eb",
      weight: "700",
    });
    renderer.text(`\u840c\u5ba0 ${pet.name}`, W - 28, top + 144, {
      size: 13,
      align: "right",
      color: "#059669",
      weight: "700",
    });

    const gradeRect = { x: W - 124, y: top + 12, w: 96, h: 28 };
    renderer.button(gradeRect, `\u5207\u6362 ${gradeName}`, {
      fill: "#eef2ff",
      color: "#4338ca",
      border: "#c7d2fe",
      fontSize: 12,
      radius: 12,
    });
    this.registerButton(gradeRect, () => this.cycleGrade());

    const cards = [
      {
        key: "gate",
        title: "\u95ef\u5173\u8bad\u7ec3",
        desc: "\u6bcf\u65e5\u95ef\u5173 + \u5206\u7ea7\u9898\u5355",
        accent: "#16a34a",
      },
      {
        key: "shop",
        title: "\u5546\u5e97\u76f2\u76d2",
        desc: "\u8d2d\u4e70\u9053\u5177\uff0c\u6536\u96c6\u76ae\u80a4\u4e0e\u840c\u5ba0",
        accent: "#d97706",
      },
      {
        key: "meteor",
        title: "\u661f\u7403\u5854\u9632",
        desc: "\u7b97\u5bf9\u9668\u77f3\u7b54\u6848\uff0c\u53d1\u5c04\u6fc0\u5149\u62a4\u57ce",
        accent: "#2563eb",
      },
      {
        key: "battle",
        title: "\u597d\u53cb\u5bf9\u6218",
        desc: "\u540c\u9898 PK\uff0c\u62fc\u901f\u5ea6\u4e0e\u51c6\u786e\u7387",
        accent: "#ea580c",
      },
      {
        key: "speed",
        title: "\u6781\u901f\u6a21\u5f0f",
        desc: "\u77ed\u65f6\u51b2\u5206\uff0c\u9505\u70bc\u53cd\u5e94\u529b",
        accent: "#7c3aed",
      },
      {
        key: "rank",
        title: "\u6210\u7ee9\u699c\u5355",
        desc: "\u67e5\u770b\u6781\u901f\u6392\u540d\u4e0e\u6700\u9ad8\u8bb0\u5f55",
        accent: "#0f766e",
      },
      {
        key: "report",
        title: "\u5b66\u4e60\u62a5\u544a",
        desc: "\u8ba9\u5bb6\u957f\u770b\u5230\u8fdb\u6b65\u4e0e\u8584\u5f31\u70b9",
        accent: "#0284c7",
      },
    ];

    const compact = H < 620;
    const blockTop = top + (compact ? 166 : 178);
    const gap = compact ? 8 : 10;
    const cardW = (W - 44) / 2;
    const footerH = compact ? 64 : 78;
    const footerY = H - bottom - footerH;
    const available = footerY - blockTop - gap * 3;
    const autoCardH = Math.floor(available / 4) - gap;
    const cardH = Math.max(compact ? 60 : 72, Math.min(compact ? 68 : 88, autoCardH));
    cards.forEach((item, index) => {
      const row = Math.floor(index / 2);
      const col = index % 2;
      const x = 16 + col * (cardW + gap);
      const y = blockTop + row * (cardH + gap);
      renderer.panel(x, y, cardW, cardH, {
        fill: "rgba(255,255,255,0.96)",
        radius: 18,
        shadow: "rgba(15,23,42,0.1)",
      });
      renderer.panel(x + 12, y + 14, 40, 8, {
        fill: item.accent,
        radius: 999,
        shadow: "",
      });
      renderer.text(item.title, x + 14, y + 42, {
        size: compact ? 17 : 21,
        weight: "700",
        color: "#111827",
      });
      renderer.text(item.desc, x + 14, y + (compact ? 58 : 70), {
        size: compact ? 11 : 13,
        color: "#64748b",
      });
      this.registerButton({ x, y, w: cardW, h: cardH }, () => this.enterCard(item.key));
    });

    renderer.panel(16, footerY, W - 32, footerH, {
      fill: "rgba(255,255,255,0.94)",
      radius: 18,
      shadow: "rgba(15,23,42,0.08)",
    });
    renderer.text(
      this.daily.rewardClaimed
        ? "\u4eca\u65e5\u5168\u5bf9\u5956\u52b1\u5df2\u9886\u53d6"
        : "\u4eca\u65e5\u95ef\u5173\u5168\u5bf9\u53ef\u9886\u989d\u5916\u5956\u52b1",
      28,
      footerY + (compact ? 28 : 34),
      {
        size: compact ? 13 : 15,
        color: this.daily.rewardClaimed ? "#166534" : "#92400e",
        weight: "700",
      }
    );
    renderer.text(`Date ${this.daily.date}`, W - 28, footerY + footerH - (compact ? 16 : 18), {
      size: compact ? 12 : 14,
      color: "#64748b",
      align: "right",
    });
  }

  drawBackground(renderer, W, H) {
    const ctx = renderer.ctx;
    ctx.fillStyle = "#eef4ff";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(125, 211, 252, 0.18)";
    ctx.beginPath();
    ctx.arc(W - 42, 86, 92, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(167, 139, 250, 0.14)";
    ctx.beginPath();
    ctx.arc(34, 224, 72, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(253, 224, 71, 0.12)";
    ctx.beginPath();
    ctx.arc(W / 2, H - 90, 108, 0, Math.PI * 2);
    ctx.fill();
  }

  cycleGrade() {
    const current = this.app.profile.selectedGrade || "grade1";
    const index = GRADE_ORDER.indexOf(current);
    const next = GRADE_ORDER[(index + 1 + GRADE_ORDER.length) % GRADE_ORDER.length];
    if (this.app.storage.setSelectedGrade) {
      this.app.profile = this.app.storage.setSelectedGrade(this.app.profile, next);
      this.profile = this.app.profile;
    }
  }

  enterCard(key) {
    if (key === "gate") {
      this.app.switchScene("gate");
      return;
    }
    if (key === "meteor") {
      this.app.switchScene("meteor", { grade: this.app.profile.selectedGrade });
      return;
    }
    if (key === "shop") {
      this.app.switchScene("shop");
      return;
    }
    if (key === "battle") {
      this.app.switchScene("battle");
      return;
    }
    if (key === "speed") {
      this.app.switchScene("single", { mode: "speed" });
      return;
    }
    if (key === "rank") {
      this.app.switchScene("rank");
      return;
    }
    this.app.switchScene("report");
  }
}

module.exports = MenuScene;
