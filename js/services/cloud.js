const { generateRound } = require("../domain/rules");

const CLOUD_ENV_ID = "";
const BRIDGE_FN_NAME = "nm_bridge";

function roomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function shortError(error) {
  if (!error) {
    return "unknown";
  }
  const msg = error.errMsg || error.message || String(error);
  const lower = String(msg).toLowerCase();
  if (msg.includes("没有权限")) {
    return `没有权限，请确认该小游戏AppID已开通云开发且绑定环境（${msg}）`;
  }
  if (lower.includes("permission")) {
    return `权限不足，请检查集合权限规则（${msg}）`;
  }
  if (msg.includes("集合") && msg.includes("不存在")) {
    return `集合不存在，请先创建 players / rooms / speed_records（${msg}）`;
  }
  if (lower.includes("does not exist")) {
    return `集合不存在，请先创建 players / rooms / speed_records（${msg}）`;
  }
  if (msg.includes("invalid env")) {
    return `云环境无效，请检查 env 配置（${msg}）`;
  }
  if (msg.includes("云函数") && msg.includes("不存在")) {
    return `云函数 ${BRIDGE_FN_NAME} 未部署（${msg}）`;
  }
  if (lower.includes("function") && lower.includes("not found")) {
    return `云函数 ${BRIDGE_FN_NAME} 未部署（${msg}）`;
  }
  if (msg.includes("watch")) {
    return `实时监听失败，已使用轮询兜底（${msg}）`;
  }
  return msg;
}

function isBridgeMissing(error) {
  const msg = shortError(error);
  return msg.includes("云函数") && msg.includes("未部署");
}

function buildEmptyBattleState() {
  return {
    index: 0,
    correctCount: 0,
    finished: false,
    wrong: false,
    allCorrect: false,
    finishAt: 0,
    updatedAt: Date.now(),
  };
}

function decideWinner(room) {
  const host = room.hostState || {};
  const guest = room.guestState || {};
  const hostFinished = !!host.finished;
  const guestFinished = !!guest.finished;

  if (hostFinished && host.allCorrect && !guestFinished) {
    return { winner: "host", reason: "host_first" };
  }
  if (guestFinished && guest.allCorrect && !hostFinished) {
    return { winner: "guest", reason: "guest_first" };
  }

  if (hostFinished && guestFinished) {
    if (host.allCorrect && guest.allCorrect) {
      if (host.finishAt === guest.finishAt) {
        return { winner: "draw", reason: "same_time" };
      }
      return host.finishAt < guest.finishAt
        ? { winner: "host", reason: "faster" }
        : { winner: "guest", reason: "faster" };
    }
    if (host.allCorrect) {
      return { winner: "host", reason: "guest_wrong" };
    }
    if (guest.allCorrect) {
      return { winner: "guest", reason: "host_wrong" };
    }
    return { winner: "draw", reason: "both_wrong" };
  }

  if (room.status === "answer" && room.answerEndsAt && Date.now() > room.answerEndsAt) {
    if ((host.correctCount || 0) === (guest.correctCount || 0)) {
      return { winner: "draw", reason: "time_up_draw" };
    }
    return (host.correctCount || 0) > (guest.correctCount || 0)
      ? { winner: "host", reason: "time_up_score" }
      : { winner: "guest", reason: "time_up_score" };
  }

  return null;
}

class CloudService {
  constructor() {
    this.ready = false;
    this.reason = "";
    this.db = null;
    this.command = null;
    this.player = null;
    this.env = "";
    this.bridgeEnabled = true;
    this.bridgeReason = "";
  }

  init() {
    if (!wx.cloud || !wx.cloud.database) {
      this.ready = false;
      this.reason = "基础库未启用云开发";
      return this.ready;
    }

    try {
      const envFromStorage = wx.getStorageSync ? wx.getStorageSync("cloud_env_id") : "";
      const env = CLOUD_ENV_ID || envFromStorage || wx.cloud.DYNAMIC_CURRENT_ENV || "";
      const initOptions = {
        traceUser: true,
      };
      if (env) {
        initOptions.env = env;
      }
      wx.cloud.init(initOptions);
      this.db = env ? wx.cloud.database({ env }) : wx.cloud.database();
      this.command = this.db.command;
      this.ready = true;
      this.reason = "";
      this.env = env || "AUTO";
    } catch (error) {
      this.ready = false;
      this.reason = shortError(error);
    }
    return this.ready;
  }

  setPlayer(player) {
    this.player = player;
  }

  async callBridge(action, payload) {
    const res = await wx.cloud.callFunction({
      name: BRIDGE_FN_NAME,
      data: {
        action,
        payload: payload || {},
      },
    });
    const result = res && res.result ? res.result : null;
    if (!result) {
      return null;
    }
    if (result.ok === false) {
      throw new Error(result.message || "bridge_error");
    }
    return result.data !== undefined ? result.data : result;
  }

  async bridgeOrDirect(action, payload, directFn) {
    if (this.bridgeEnabled) {
      try {
        return await this.callBridge(action, payload);
      } catch (error) {
        const bridgeErr = shortError(error);
        this.bridgeEnabled = false;
        if (isBridgeMissing(error)) {
          this.bridgeReason = `云函数 ${BRIDGE_FN_NAME} 未部署，已降级为数据库直连模式`;
        } else {
          this.bridgeReason = `云函数桥接失败，已降级数据库直连：${bridgeErr}`;
        }
        try {
          return await directFn();
        } catch (directError) {
          const directErr = shortError(directError);
          throw new Error(`云函数失败：${bridgeErr}；直连失败：${directErr}`);
        }
      }
    }
    return directFn();
  }

  async diagnose() {
    if (!this.ready) {
      return {
        ok: false,
        reason: this.reason || "cloud_not_ready",
      };
    }
    try {
      await this.bridgeOrDirect(
        "health",
        {
          env: this.env,
        },
        async () => {
          await this.db.collection("players").limit(1).get();
          await this.db.collection("rooms").limit(1).get();
          return { ok: true };
        }
      );
      return {
        ok: true,
        reason: this.bridgeReason || "",
      };
    } catch (error) {
      return {
        ok: false,
        reason: `${shortError(error)}${this.bridgeReason ? `；${this.bridgeReason}` : ""}`,
      };
    }
  }

  async heartbeat(roomCodeValue = "") {
    if (!this.ready || !this.player) {
      return;
    }
    return this.bridgeOrDirect(
      "heartbeat",
      {
        player: this.player,
        roomCode: roomCodeValue,
      },
      async () => {
        await this.db.collection("players").doc(this.player.id).set({
          data: {
            playerId: this.player.id,
            nickName: this.player.name,
            roomCode: roomCodeValue,
            onlineAt: Date.now(),
            updatedAt: Date.now(),
          },
        });
      }
    );
  }

  async fetchOnlinePlayers() {
    if (!this.ready) {
      throw new Error(this.reason || "cloud_not_ready");
    }
    return this.bridgeOrDirect("fetchOnlinePlayers", { playerId: this.player.id }, async () => {
      const threshold = Date.now() - 30000;
      const res = await this.db
        .collection("players")
        .where({
          onlineAt: this.command.gt(threshold),
        })
        .limit(80)
        .get();

      const list = (res.data || [])
        .filter((item) => item.playerId !== this.player.id)
        .sort((a, b) => (b.onlineAt || 0) - (a.onlineAt || 0));
      return list.slice(0, 40);
    });
  }

  buildBattlePayload(difficulty) {
    const { config, questions } = generateRound({
      mode: "gate",
      difficulty,
      level: 3,
    });
    return {
      config: {
        memoryTime: config.memoryTime,
        answerTime: config.answerTime,
        questionCount: questions.length,
      },
      questions: questions.map((q) => ({
        expression: q.expression,
        answer: q.answer,
      })),
    };
  }

  async createBattleRoom(difficulty) {
    const base = this.buildBattlePayload(difficulty);
    return this.bridgeOrDirect(
      "createBattleRoom",
      {
        player: this.player,
        difficulty,
        base,
      },
      async () => {
        const now = Date.now();
        const data = {
          roomCode: roomCode(),
          difficulty,
          status: "waiting",
          hostId: this.player.id,
          hostName: this.player.name,
          guestId: "",
          guestName: "",
          config: base.config,
          questions: base.questions,
          memoryEndsAt: 0,
          answerEndsAt: 0,
          startedAt: 0,
          winner: "",
          reason: "",
          hostState: buildEmptyBattleState(),
          guestState: buildEmptyBattleState(),
          createdAt: now,
          updatedAt: now,
        };
        const res = await this.db.collection("rooms").add({ data });
        return {
          roomId: res._id,
          room: {
            ...data,
            _id: res._id,
          },
        };
      }
    );
  }

  async findWaitingRoom(difficulty) {
    const res = await this.db
      .collection("rooms")
      .where({
        status: "waiting",
        difficulty,
      })
      .limit(40)
      .get();
    const list = (res.data || []).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    return list.find((item) => item.hostId !== this.player.id) || null;
  }

  async activateRoomAsGuest(roomId) {
    const roomRes = await this.db.collection("rooms").doc(roomId).get();
    const room = roomRes.data;
    if (!room) {
      throw new Error("room_not_found");
    }
    if (room.status !== "waiting") {
      throw new Error("room_not_waiting");
    }
    const memoryEndsAt = Date.now() + room.config.memoryTime * 1000;
    await this.db.collection("rooms").doc(roomId).update({
      data: {
        status: "memory",
        guestId: this.player.id,
        guestName: this.player.name,
        guestState: buildEmptyBattleState(),
        memoryEndsAt,
        updatedAt: Date.now(),
      },
    });
    return {
      ...room,
      status: "memory",
      guestId: this.player.id,
      guestName: this.player.name,
      memoryEndsAt,
    };
  }

  async quickMatch(difficulty) {
    const base = this.buildBattlePayload(difficulty);
    return this.bridgeOrDirect(
      "quickMatch",
      {
        player: this.player,
        difficulty,
        base,
      },
      async () => {
        const waiting = await this.findWaitingRoom(difficulty);
        if (waiting) {
          const room = await this.activateRoomAsGuest(waiting._id);
          return {
            roomId: waiting._id,
            role: "guest",
            room,
            matched: true,
          };
        }
        const created = await this.createBattleRoom(difficulty);
        return {
          roomId: created.roomId,
          role: "host",
          room: created.room,
          matched: false,
        };
      }
    );
  }

  async joinRoomByCode(code) {
    return this.bridgeOrDirect(
      "joinRoomByCode",
      {
        player: this.player,
        roomCode: code,
      },
      async () => {
        const res = await this.db
          .collection("rooms")
          .where({
            roomCode: code,
          })
          .limit(20)
          .get();
        const list = (res.data || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        const room = list[0];
        if (!room) {
          throw new Error("room_not_found");
        }
        if (room.hostId === this.player.id) {
          return { roomId: room._id, role: "host", room };
        }
        if (room.status === "waiting") {
          const active = await this.activateRoomAsGuest(room._id);
          return { roomId: room._id, role: "guest", room: active };
        }
        if (room.guestId && room.guestId !== this.player.id) {
          throw new Error("room_full");
        }
        return { roomId: room._id, role: "guest", room };
      }
    );
  }

  async getRoom(roomId) {
    return this.bridgeOrDirect(
      "getRoom",
      { roomId },
      async () => {
        const doc = await this.db.collection("rooms").doc(roomId).get();
        return doc ? doc.data : null;
      }
    );
  }

  watchRoom(roomId, onRoom, onError) {
    let closed = false;
    let watchHandler = null;
    let latestUpdatedAt = 0;

    const safeOnRoom = (room) => {
      if (!room || closed) {
        return;
      }
      const marker = room.updatedAt || room.finishedAt || 0;
      if (marker && marker === latestUpdatedAt) {
        return;
      }
      latestUpdatedAt = marker;
      if (onRoom) {
        onRoom(room);
      }
    };

    const poll = async () => {
      if (closed) {
        return;
      }
      try {
        const room = await this.getRoom(roomId);
        if (room) {
          safeOnRoom(room);
        }
      } catch (error) {
        if (onError) {
          onError(error);
        }
      }
    };

    const timer = setInterval(poll, 700);
    poll();

    if (!this.bridgeEnabled) {
      try {
        watchHandler = this.db.collection("rooms").doc(roomId).watch({
          onChange(snapshot) {
            const docs = snapshot.docs || [];
            if (docs.length) {
              safeOnRoom(docs[0]);
            }
          },
          onError(err) {
            if (onError) {
              onError(err);
            }
          },
        });
      } catch (error) {
        if (onError) {
          onError(error);
        }
      }
    }

    return {
      close() {
        closed = true;
        clearInterval(timer);
        if (watchHandler && watchHandler.close) {
          watchHandler.close();
        }
      },
    };
  }

  async startAnswer(roomId, answerTime) {
    return this.bridgeOrDirect(
      "startAnswer",
      {
        roomId,
        answerTime,
      },
      async () => {
        const startedAt = Date.now();
        await this.db.collection("rooms").doc(roomId).update({
          data: {
            status: "answer",
            startedAt,
            answerEndsAt: startedAt + answerTime * 1000,
            updatedAt: Date.now(),
          },
        });
      }
    );
  }

  async updateBattleState(roomId, role, state) {
    return this.bridgeOrDirect(
      "updateBattleState",
      {
        roomId,
        role,
        state,
      },
      async () => {
        const key = role === "host" ? "hostState" : "guestState";
        await this.db.collection("rooms").doc(roomId).update({
          data: {
            [key]: {
              ...state,
              updatedAt: Date.now(),
            },
            updatedAt: Date.now(),
          },
        });
      }
    );
  }

  async finalizeRoom(roomId, result) {
    return this.bridgeOrDirect(
      "finalizeRoom",
      {
        roomId,
        result,
      },
      async () => {
        await this.db.collection("rooms").doc(roomId).update({
          data: {
            status: "finished",
            winner: result.winner,
            reason: result.reason,
            finishedAt: Date.now(),
            updatedAt: Date.now(),
          },
        });
      }
    );
  }

  async uploadSpeedRecord(payload) {
    if (!this.ready || !this.player) {
      return;
    }
    return this.bridgeOrDirect(
      "uploadSpeedRecord",
      {
        player: this.player,
        payload,
      },
      async () => {
        await this.db.collection("speed_records").add({
          data: {
            playerId: this.player.id,
            nickName: this.player.name,
            score: payload.score,
            elapsedMs: payload.elapsedMs,
            createdAt: Date.now(),
          },
        });
      }
    );
  }

  async fetchSpeedRankings() {
    if (!this.ready) {
      return [];
    }
    return this.bridgeOrDirect("fetchSpeedRankings", { playerId: this.player.id }, async () => {
      const res = await this.db.collection("speed_records").limit(200).get();
      const seen = {};
      const rows = [];
      (res.data || [])
        .sort((a, b) => {
          const scoreDiff = (b.score || 0) - (a.score || 0);
          if (scoreDiff !== 0) {
            return scoreDiff;
          }
          return (a.elapsedMs || 0) - (b.elapsedMs || 0);
        })
        .forEach((row) => {
          if (seen[row.playerId]) {
            return;
          }
          seen[row.playerId] = true;
          rows.push({
            playerId: row.playerId,
            nickName: row.nickName || "玩家",
            score: row.score || 0,
            elapsedMs: row.elapsedMs || 0,
          });
        });
      return rows.slice(0, 20).map((item, index) => ({
        ...item,
        rank: index + 1,
        isSelf: item.playerId === this.player.id,
      }));
    });
  }

  async markOffline() {
    if (!this.ready || !this.player) {
      return;
    }
    try {
      await this.bridgeOrDirect(
        "markOffline",
        {
          player: this.player,
        },
        async () => {
          await this.db.collection("players").doc(this.player.id).update({
            data: {
              roomCode: "",
              onlineAt: Date.now() - 120000,
              updatedAt: Date.now(),
            },
          });
        }
      );
    } catch (error) {
      // ignore
    }
  }
}

module.exports = {
  CloudService,
  decideWinner,
  shortError,
};
