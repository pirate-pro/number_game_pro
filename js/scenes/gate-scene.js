const BaseScene = require("../runtime/base-scene");
const {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  MAX_LEVEL,
  PET_DEFS,
  canAccessDifficulty,
  getLockReason,
  getItemAvailability,
} = require("../domain/rules");

class GateScene extends BaseScene {
  onEnter(params) {
    super.onEnter(params);
    this.subMode = "daily";
    this.selectedDifficulty = "beginner";
    this.selectedLevel = 1;
    this.refresh();
  }

  refresh() {
    this.profile = this.app.profile;
    if (!canAccessDifficulty(this.profile, this.selectedDifficulty)) {
      this.selectedDifficulty = "beginner";
    }
    this.items = getItemAvailability(this.profile, this.subMode === "daily" ? "daily" : "gate");
    this.pet = PET_DEFS[(this.profile.pets && this.profile.pets.equipped) || "pet_memory_sprite"] || PET_DEFS.pet_memory_sprite;
  }

  render(renderer) {
    this.resetButtons();
    renderer.clear("#f4f7fb");
    const W = renderer.width;
    const top = renderer.topInset;
    const bottom = renderer.bottomInset;

    renderer.panel(16, top, W - 32, 84, {
      fill: "#ffffff",
      radius: 16,
      shadow: "rgba(15,23,42,0.08)",
    });
    renderer.text("\u95ef\u5173\u6a21\u5f0f", 30, top + 40, {
      size: 26,
      weight: "700",
      color: "#111827",
    });
    renderer.text(`\u5f53\u524d\u51fa\u6218\u840c\u5ba0 ${this.pet.name}`, 30, top + 68, {
      size: 13,
      color: "#059669",
      weight: "700",
    });
    this.drawBack(renderer, W);
    this.drawModeTabs(renderer, W, top + 96);
    this.drawDifficulty(renderer, W, top + 158);
    this.drawLevels(renderer, W, top + 300);
    this.drawItems(renderer, W, top + 408);
    this.drawStart(renderer, W, renderer.height - bottom - 56);
  }

  drawBack(renderer, W) {
    const rect = { x: W - 112, y: renderer.topInset + 12, w: 84, h: 32 };
    renderer.button(rect, "\u8fd4\u56de", {
      fill: "#eef2f7",
      color: "#334155",
      fontSize: 14,
      radius: 10,
    });
    this.registerButton(rect, () => this.app.switchScene("menu"));
  }

  drawModeTabs(renderer, W, y) {
    renderer.panel(16, y, W - 32, 54, {
      fill: "#ffffff",
      radius: 14,
      shadow: "rgba(15,23,42,0.08)",
    });
    const left = { x: 22, y: y + 7, w: (W - 44) / 2 - 6, h: 40 };
    const right = { x: 22 + (W - 44) / 2 + 2, y: y + 7, w: (W - 44) / 2 - 6, h: 40 };
    renderer.button(left, "\u6bcf\u65e5\u95ef\u5173", {
      fill: this.subMode === "daily" ? "#2e8b57" : "#ecfdf3",
      color: this.subMode === "daily" ? "#fff" : "#166534",
      radius: 10,
      fontSize: 15,
    });
    renderer.button(right, "\u5173\u5361\u95ef\u5173", {
      fill: this.subMode === "gate" ? "#2e8b57" : "#ecfdf3",
      color: this.subMode === "gate" ? "#fff" : "#166534",
      radius: 10,
      fontSize: 15,
    });
    this.registerButton(left, () => {
      this.subMode = "daily";
      this.refresh();
    });
    this.registerButton(right, () => {
      this.subMode = "gate";
      this.refresh();
    });
  }

  drawDifficulty(renderer, W, y) {
    renderer.panel(16, y, W - 32, 132, {
      fill: "#ffffff",
      radius: 14,
      shadow: "rgba(15,23,42,0.08)",
    });
    renderer.text("\u9009\u62e9\u96be\u5ea6", 28, y + 30, {
      size: 18,
      weight: "700",
      color: "#111827",
    });
    const chipW = (W - 56) / 3;
    DIFFICULTY_ORDER.forEach((key, index) => {
      const item = DIFFICULTIES[key];
      const unlocked = canAccessDifficulty(this.profile, key);
      const x = 22 + index * chipW;
      const rect = { x, y: y + 42, w: chipW - 8, h: 34 };
      renderer.button(rect, item.name, {
        fill: this.selectedDifficulty === key ? "#2e8b57" : "#f1f5f9",
        color: this.selectedDifficulty === key ? "#fff" : unlocked ? "#334155" : "#94a3b8",
        radius: 10,
        fontSize: 14,
        disabled: !unlocked,
      });
      this.registerButton(
        rect,
        () => {
          this.selectedDifficulty = key;
        },
        !unlocked
      );
      if (!unlocked) {
        renderer.text(getLockReason(this.profile, key), x, y + 93, {
          size: 10,
          color: "#b45309",
        });
      }
    });
    renderer.text(DIFFICULTIES[this.selectedDifficulty].desc, 28, y + 118, {
      size: 13,
      color: "#64748b",
    });
  }

  drawLevels(renderer, W, y) {
    renderer.panel(16, y, W - 32, 100, {
      fill: "#ffffff",
      radius: 14,
      shadow: "rgba(15,23,42,0.08)",
    });
    renderer.text("\u5173\u5361 1-7", 28, y + 28, {
      size: 18,
      weight: "700",
      color: "#111827",
    });
    const cleared = this.profile.clearedLevels[this.selectedDifficulty] || 0;
    const cellW = (W - 56) / 7;
    for (let i = 1; i <= MAX_LEVEL; i += 1) {
      const x = 22 + (i - 1) * cellW;
      const locked = i > cleared + 1;
      const rect = { x, y: y + 40, w: cellW - 4, h: 42 };
      renderer.button(rect, `${i}`, {
        fill: this.selectedLevel === i ? "#2e8b57" : i <= cleared ? "#d1fae5" : "#f3f4f6",
        color: this.selectedLevel === i ? "#fff" : locked ? "#9ca3af" : "#1f2937",
        radius: 8,
        fontSize: 16,
        disabled: locked,
      });
      this.registerButton(
        rect,
        () => {
          this.selectedLevel = i;
        },
        locked
      );
    }
  }

  drawItems(renderer, W, y) {
    renderer.panel(16, y, W - 32, 118, {
      fill: "#ffffff",
      radius: 14,
      shadow: "rgba(15,23,42,0.08)",
    });
    renderer.text("\u9053\u5177\u80cc\u5305", 28, y + 28, {
      size: 18,
      weight: "700",
      color: "#111827",
    });
    renderer.text(`\u7d2f\u8ba1\u901a\u5173 ${this.items.clears} \u5173`, 28, y + 52, {
      size: 14,
      color: "#64748b",
    });
    renderer.text(`\u590d\u6d3b\u5361 x${this.items.reviveCount}`, W - 28, y + 52, {
      size: 13,
      color: this.items.reviveCount > 0 ? "#166534" : "#94a3b8",
      align: "right",
    });
    renderer.text(`\u52a0\u65f6\u5361 x${this.items.extraTimeCount}`, 28, y + 76, {
      size: 13,
      color: this.items.extraTimeCount > 0 ? "#166534" : "#94a3b8",
    });
    renderer.text(`\u8df3\u5173\u5361 x${this.items.skipLevelCount}`, W - 28, y + 76, {
      size: 13,
      color: this.items.skipLevelCount > 0 ? "#1d4ed8" : "#94a3b8",
      align: "right",
    });

    const skipRect = { x: 24, y: y + 86, w: W - 48, h: 24 };
    const canSkip = this.subMode === "gate" && this.items.skipLevelCount > 0;
    renderer.button(skipRect, canSkip ? "\u4f7f\u7528\u8df3\u5173\u5361\u76f4\u63a5\u901a\u8fc7\u5f53\u524d\u5173" : "\u8df3\u5173\u5361\u4ec5\u80fd\u5728\u5173\u5361\u95ef\u5173\u4e2d\u4f7f\u7528", {
      fill: "#ffffff",
      color: canSkip ? "#1d4ed8" : "#94a3b8",
      border: canSkip ? "#bfdbfe" : "#e5e7eb",
      radius: 10,
      fontSize: 12,
      disabled: !canSkip,
    });
    this.registerButton(skipRect, () => this.useSkipCard(), !canSkip);
  }

  drawStart(renderer, W, y) {
    const rect = { x: 20, y, w: W - 40, h: 48 };
    const label =
      this.subMode === "daily" ? "\u5f00\u59cb\u6bcf\u65e5\u95ef\u5173" : `\u5f00\u59cb\u7b2c ${this.selectedLevel} \u5173`;
    renderer.button(rect, label, {
      fill: "#2e8b57",
      color: "#fff",
      fontSize: 18,
    });
    this.registerButton(rect, () => {
      this.app.switchScene("single", {
        mode: this.subMode === "daily" ? "daily" : "gate",
        difficulty: this.selectedDifficulty,
        level: this.selectedLevel,
      });
    });
  }

  useSkipCard() {
    const result = this.app.storage.skipGateLevel(this.app.profile, this.selectedDifficulty, this.selectedLevel);
    if (!result.ok) {
      return;
    }
    this.app.profile = result.profile;
    this.selectedLevel = Math.min(MAX_LEVEL, this.selectedLevel + 1);
    this.refresh();
  }
}

module.exports = GateScene;
