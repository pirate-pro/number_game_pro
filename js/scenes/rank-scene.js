const BaseScene = require("../runtime/base-scene");
const { formatDuration } = require("../domain/rules");

class RankScene extends BaseScene {
  onEnter() {
    this.tab = "global";
    this.loading = true;
    this.error = "";
    this.globalRows = [];
    this.friendRows = [];
    this.loadRank();
  }

  async loadRank() {
    this.loading = true;
    this.error = "";
    const profile = this.app.profile;
    const selfId = this.app.player.id;

    try {
      const globalRows = await this.app.cloud.fetchSpeedRankings();
      this.globalRows = globalRows;

      const recentMap = {};
      (profile.recentOpponents || []).forEach((item) => {
        recentMap[item.id] = true;
      });
      recentMap[selfId] = true;

      this.friendRows = globalRows.filter((item) => recentMap[item.playerId]).slice(0, 20);
      if (!this.friendRows.length) {
        this.friendRows = globalRows.filter((item) => item.isSelf).slice(0, 1);
      }
    } catch (error) {
      this.error = "排行榜加载失败，已切换到本地成绩。";
      const localRows = (profile.speedRecords || []).slice(0, 20).map((item, index) => ({
        rank: index + 1,
        playerId: selfId,
        nickName: "我",
        score: item.score,
        elapsedMs: item.elapsedMs,
        isSelf: true,
      }));
      this.globalRows = localRows;
      this.friendRows = localRows;
    } finally {
      this.loading = false;
    }
  }

  render(renderer) {
    this.resetButtons();
    const W = renderer.width;
    const H = renderer.height;
    const top = renderer.topInset;
    const bottom = renderer.bottomInset;
    const profile = this.app.profile;
    const heroY = top;
    const heroH = 128;
    const tabsY = heroY + heroH + 12;
    const listY = tabsY + 64;

    renderer.clear("#f4f7fb");
    this.drawBackground(renderer, W, H);

    renderer.panel(16, heroY, W - 32, heroH, {
      fill: "#ffffff",
      radius: 18,
      shadow: "rgba(15,23,42,0.08)",
    });
    renderer.text("极速排行榜", 28, heroY + 34, {
      size: 28,
      weight: "700",
      color: "#111827",
    });
    renderer.text(`我的最高分 ${profile.bestSpeedScore || 0}`, 28, heroY + 66, {
      size: 16,
      color: "#166534",
      weight: "600",
    });
    renderer.text(this.tab === "global" ? "查看全网最快玩家" : "查看最近好友成绩", 28, heroY + 94, {
      size: 14,
      color: "#64748b",
    });

    const homeRect = { x: W - 152, y: heroY + 16, w: 124, h: 36 };
    const speedRect = { x: W - 152, y: heroY + 66, w: 124, h: 36 };
    renderer.button(homeRect, "返回主页", {
      fill: "#2e8b57",
      color: "#fff",
      fontSize: 15,
      radius: 12,
    });
    renderer.button(speedRect, "极速练习", {
      fill: "#ffffff",
      color: "#166534",
      border: "#bbf7d0",
      fontSize: 15,
      radius: 12,
    });
    this.registerButton(homeRect, () => this.app.switchScene("menu"));
    this.registerButton(speedRect, () => this.app.switchScene("single", { mode: "speed" }));

    this.drawRefresh(renderer, W, tabsY - 4);
    this.drawTabs(renderer, W, tabsY);
    this.drawList(renderer, W, H, listY, bottom);
    this.drawFooter(renderer, W, H, bottom);
  }

  drawBackground(renderer, W, H) {
    const ctx = renderer.ctx;
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, "#eff6ff");
    gradient.addColorStop(1, "#f8fafc");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(34, 197, 94, 0.08)";
    ctx.beginPath();
    ctx.arc(W - 24, 116, 92, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(59, 130, 246, 0.08)";
    ctx.beginPath();
    ctx.arc(26, H - 140, 120, 0, Math.PI * 2);
    ctx.fill();
  }

  drawRefresh(renderer, W, y) {
    const refreshRect = { x: W - 108, y, w: 88, h: 34 };
    renderer.button(refreshRect, "刷新", {
      fill: "#eef2f7",
      color: "#334155",
      fontSize: 14,
      radius: 10,
    });
    this.registerButton(refreshRect, () => this.loadRank());
  }

  drawTabs(renderer, W, y) {
    renderer.panel(16, y, W - 32, 54, {
      fill: "#ffffff",
      radius: 14,
      shadow: "rgba(15,23,42,0.08)",
    });

    const left = { x: 22, y: y + 7, w: (W - 44) / 2 - 6, h: 40 };
    const right = { x: 22 + (W - 44) / 2 + 2, y: y + 7, w: (W - 44) / 2 - 6, h: 40 };

    renderer.button(left, "全网榜", {
      fill: this.tab === "global" ? "#2e8b57" : "#ecfdf3",
      color: this.tab === "global" ? "#fff" : "#166534",
      radius: 10,
      fontSize: 15,
    });
    renderer.button(right, "好友榜", {
      fill: this.tab === "friend" ? "#2e8b57" : "#ecfdf3",
      color: this.tab === "friend" ? "#fff" : "#166534",
      radius: 10,
      fontSize: 15,
    });

    this.registerButton(left, () => {
      this.tab = "global";
    });
    this.registerButton(right, () => {
      this.tab = "friend";
    });
  }

  drawList(renderer, W, H, topY, bottom) {
    const rows = this.tab === "global" ? this.globalRows : this.friendRows;
    const panelHeight = H - topY - bottom - 68;

    renderer.panel(16, topY, W - 32, panelHeight, {
      fill: "#ffffff",
      radius: 14,
      shadow: "rgba(15,23,42,0.08)",
    });

    if (this.loading) {
      renderer.text("排行榜加载中...", W / 2, topY + 62, {
        size: 18,
        align: "center",
        color: "#64748b",
      });
      return;
    }

    if (this.error) {
      renderer.text(this.error, W / 2, topY + 62, {
        size: 15,
        align: "center",
        color: "#b45309",
      });
    }

    if (!rows.length) {
      renderer.text("还没有成绩，先去挑战一局吧", W / 2, topY + 98, {
        size: 18,
        align: "center",
        color: "#64748b",
      });
      return;
    }

    renderer.text("排名", 30, topY + 32, {
      size: 14,
      color: "#64748b",
    });
    renderer.text("玩家", 96, topY + 32, {
      size: 14,
      color: "#64748b",
    });
    renderer.text("分数", W - 122, topY + 32, {
      size: 14,
      color: "#64748b",
    });
    renderer.text("用时", W - 34, topY + 32, {
      size: 14,
      color: "#64748b",
      align: "right",
    });

    const startY = topY + 56;
    const rowH = 34;
    const maxRows = Math.max(1, Math.floor((panelHeight - 78) / rowH));

    rows.slice(0, maxRows).forEach((row, idx) => {
      const y = startY + idx * rowH;
      if (row.isSelf) {
        renderer.panel(22, y - 22, W - 44, 30, {
          fill: "#ecfdf3",
          radius: 8,
          shadow: "",
        });
      }
      renderer.text(String(row.rank || idx + 1), 30, y, {
        size: 14,
        color: "#1f2937",
      });
      renderer.text(row.nickName || "玩家", 96, y, {
        size: 14,
        color: "#1f2937",
      });
      renderer.text(String(row.score || 0), W - 110, y, {
        size: 14,
        color: "#14532d",
        weight: "700",
      });
      renderer.text(formatDuration(row.elapsedMs || 0), W - 34, y, {
        size: 14,
        color: "#475569",
        align: "right",
      });
    });
  }

  drawFooter(renderer, W, H, bottom) {
    const homeRect = { x: 20, y: H - bottom - 44, w: W - 40, h: 44 };
    renderer.button(homeRect, "返回主页", {
      fill: "#ffffff",
      color: "#334155",
      border: "#cbd5e1",
      radius: 12,
      fontSize: 17,
    });
    this.registerButton(homeRect, () => this.app.switchScene("menu"));
  }
}

module.exports = RankScene;
