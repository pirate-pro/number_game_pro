const Renderer = require("./renderer");
const { CloudService } = require("../services/cloud");
const storage = require("../services/storage");

const MenuScene = require("../scenes/menu-scene");
const GateScene = require("../scenes/gate-scene");
const SingleScene = require("../scenes/single-scene");
const BattleScene = require("../scenes/battle-scene");
const MeteorScene = require("../scenes/meteor-scene");
const RankScene = require("../scenes/rank-scene");
const ReportScene = require("../scenes/report-scene");
const ResultScene = require("../scenes/result-scene");
const ShopScene = require("../scenes/shop-scene");

class GameApp {
  constructor() {
    this.renderer = new Renderer();
    this.storage = storage;
    this.profile = this.storage.getProfile();
    this.player = this.storage.getPlayer();
    this.latestResult = null;

    this.cloud = new CloudService();
    this.cloud.init();
    this.cloud.setPlayer(this.player);

    this.sceneMap = {
      menu: MenuScene,
      gate: GateScene,
      single: SingleScene,
      battle: BattleScene,
      meteor: MeteorScene,
      rank: RankScene,
      report: ReportScene,
      shop: ShopScene,
      result: ResultScene,
    };
    this.currentScene = null;

    this.bindEvents();
    this.bootstrap();
    this.startLoop();
  }

  bindEvents() {
    wx.onTouchStart((res) => {
      const t = res.touches && res.touches[0];
      if (!t || !this.currentScene || !this.currentScene.onTap) {
        return;
      }
      this.currentScene.onTap(t.clientX, t.clientY);
    });

    wx.onShow((options) => {
      const code = options && options.query ? options.query.roomCode : "";
      if (code) {
        this.switchScene("battle", { roomCode: code });
      }
    });

    wx.onHide(() => {
      this.cloud.heartbeat("").catch(() => {});
    });

    wx.onError((error) => {
      console.error("game error:", error);
    });

    if (wx.showShareMenu) {
      wx.showShareMenu({
        withShareTicket: true,
      });
    }
  }

  bootstrap() {
    const launch = wx.getLaunchOptionsSync ? wx.getLaunchOptionsSync() : {};
    const roomCode = launch && launch.query ? launch.query.roomCode : "";
    if (roomCode) {
      this.switchScene("battle", { roomCode });
      return;
    }
    this.switchScene("menu");
  }

  switchScene(name, params) {
    const SceneCtor = this.sceneMap[name];
    if (!SceneCtor) {
      return;
    }
    if (this.currentScene && this.currentScene.onExit) {
      this.currentScene.onExit();
    }
    this.currentScene = new SceneCtor(this);
    if (this.currentScene.onEnter) {
      this.currentScene.onEnter(params || {});
    }
  }

  startLoop() {
    this.lastTs = Date.now();
    const tick = (ts) => {
      const now = ts || Date.now();
      const dt = (now - this.lastTs) / 1000;
      this.lastTs = now;

      if (this.currentScene) {
        if (this.currentScene.update) {
          this.currentScene.update(dt);
        }
        if (this.currentScene.render) {
          this.currentScene.render(this.renderer);
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

module.exports = GameApp;
