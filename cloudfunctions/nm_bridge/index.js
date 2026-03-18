const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;

function ok(data) {
  return { ok: true, data };
}

function fail(message) {
  return { ok: false, message };
}

function roomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function emptyState() {
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

function sortBy(list, field, desc) {
  return list.slice().sort((a, b) => {
    const av = a[field] || 0;
    const bv = b[field] || 0;
    return desc ? bv - av : av - bv;
  });
}

async function actionHealth() {
  return ok({
    env: process.env.TCB_ENV || "",
    at: Date.now(),
  });
}

async function actionHeartbeat(payload) {
  const player = payload.player || {};
  const roomCodeValue = payload.roomCode || "";
  if (!player.id) {
    return fail("player_id_missing");
  }
  await db.collection("players").doc(player.id).set({
    data: {
      playerId: player.id,
      nickName: player.name || "玩家",
      roomCode: roomCodeValue,
      onlineAt: Date.now(),
      updatedAt: Date.now(),
    },
  });
  return ok({ success: true });
}

async function actionFetchOnlinePlayers(payload) {
  const playerId = payload.playerId || "";
  const threshold = Date.now() - 30000;
  const res = await db
    .collection("players")
    .where({
      onlineAt: _.gt(threshold),
    })
    .limit(100)
    .get();
  const list = sortBy(res.data || [], "onlineAt", true).filter((item) => item.playerId !== playerId);
  return ok(list.slice(0, 40));
}

async function createRoomInternal(player, difficulty, base) {
  const now = Date.now();
  const data = {
    roomCode: roomCode(),
    difficulty,
    status: "waiting",
    hostId: player.id,
    hostName: player.name || "玩家",
    guestId: "",
    guestName: "",
    config: base.config,
    questions: base.questions,
    memoryEndsAt: 0,
    answerEndsAt: 0,
    startedAt: 0,
    winner: "",
    reason: "",
    hostState: emptyState(),
    guestState: emptyState(),
    createdAt: now,
    updatedAt: now,
  };
  const add = await db.collection("rooms").add({ data });
  return {
    roomId: add._id,
    room: {
      ...data,
      _id: add._id,
    },
  };
}

async function activateAsGuest(roomId, player) {
  const roomRes = await db.collection("rooms").doc(roomId).get();
  const room = roomRes.data;
  if (!room) {
    throw new Error("room_not_found");
  }
  if (room.status !== "waiting") {
    throw new Error("room_not_waiting");
  }
  const memoryEndsAt = Date.now() + room.config.memoryTime * 1000;
  await db.collection("rooms").doc(roomId).update({
    data: {
      status: "memory",
      guestId: player.id,
      guestName: player.name || "玩家",
      guestState: emptyState(),
      memoryEndsAt,
      updatedAt: Date.now(),
    },
  });
  return {
    ...room,
    status: "memory",
    guestId: player.id,
    guestName: player.name || "玩家",
    memoryEndsAt,
  };
}

async function actionCreateBattleRoom(payload) {
  const player = payload.player || {};
  const difficulty = payload.difficulty || "advanced";
  const base = payload.base || {};
  if (!player.id || !base.config || !base.questions) {
    return fail("create_room_payload_invalid");
  }
  const created = await createRoomInternal(player, difficulty, base);
  return ok(created);
}

async function actionQuickMatch(payload) {
  const player = payload.player || {};
  const difficulty = payload.difficulty || "advanced";
  const base = payload.base || {};
  if (!player.id || !base.config || !base.questions) {
    return fail("quick_match_payload_invalid");
  }
  const res = await db
    .collection("rooms")
    .where({
      status: "waiting",
      difficulty,
    })
    .limit(100)
    .get();
  const waiting = sortBy(res.data || [], "createdAt", false).find((item) => item.hostId !== player.id) || null;
  if (waiting) {
    const room = await activateAsGuest(waiting._id, player);
    return ok({
      roomId: waiting._id,
      role: "guest",
      room,
      matched: true,
    });
  }
  const created = await createRoomInternal(player, difficulty, base);
  return ok({
    roomId: created.roomId,
    role: "host",
    room: created.room,
    matched: false,
  });
}

async function actionJoinRoomByCode(payload) {
  const player = payload.player || {};
  const code = payload.roomCode || "";
  if (!player.id || !code) {
    return fail("join_payload_invalid");
  }
  const res = await db
    .collection("rooms")
    .where({
      roomCode: code,
    })
    .limit(50)
    .get();
  const list = sortBy(res.data || [], "createdAt", true);
  const room = list[0];
  if (!room) {
    return fail("room_not_found");
  }
  if (room.hostId === player.id) {
    return ok({
      roomId: room._id,
      role: "host",
      room,
    });
  }
  if (room.status === "waiting") {
    const active = await activateAsGuest(room._id, player);
    return ok({
      roomId: room._id,
      role: "guest",
      room: active,
    });
  }
  if (room.guestId && room.guestId !== player.id) {
    return fail("room_full");
  }
  return ok({
    roomId: room._id,
    role: "guest",
    room,
  });
}

async function actionGetRoom(payload) {
  const roomId = payload.roomId || "";
  if (!roomId) {
    return fail("room_id_missing");
  }
  const res = await db.collection("rooms").doc(roomId).get();
  return ok(res.data || null);
}

async function actionStartAnswer(payload) {
  const roomId = payload.roomId || "";
  const answerTime = Number(payload.answerTime || 20);
  if (!roomId) {
    return fail("room_id_missing");
  }
  const startedAt = Date.now();
  await db.collection("rooms").doc(roomId).update({
    data: {
      status: "answer",
      startedAt,
      answerEndsAt: startedAt + answerTime * 1000,
      updatedAt: Date.now(),
    },
  });
  return ok({ success: true });
}

async function actionUpdateBattleState(payload) {
  const roomId = payload.roomId || "";
  const role = payload.role || "host";
  const state = payload.state || {};
  if (!roomId) {
    return fail("room_id_missing");
  }
  const key = role === "host" ? "hostState" : "guestState";
  await db.collection("rooms").doc(roomId).update({
    data: {
      [key]: {
        ...state,
        updatedAt: Date.now(),
      },
      updatedAt: Date.now(),
    },
  });
  return ok({ success: true });
}

async function actionFinalizeRoom(payload) {
  const roomId = payload.roomId || "";
  const result = payload.result || {};
  if (!roomId) {
    return fail("room_id_missing");
  }
  await db.collection("rooms").doc(roomId).update({
    data: {
      status: "finished",
      winner: result.winner || "",
      reason: result.reason || "",
      finishedAt: Date.now(),
      updatedAt: Date.now(),
    },
  });
  return ok({ success: true });
}

async function actionUploadSpeedRecord(payload) {
  const player = payload.player || {};
  const p = payload.payload || {};
  if (!player.id) {
    return fail("player_id_missing");
  }
  await db.collection("speed_records").add({
    data: {
      playerId: player.id,
      nickName: player.name || "玩家",
      score: p.score || 0,
      elapsedMs: p.elapsedMs || 0,
      createdAt: Date.now(),
    },
  });
  return ok({ success: true });
}

async function actionFetchSpeedRankings(payload) {
  const playerId = payload.playerId || "";
  const res = await db.collection("speed_records").limit(300).get();
  const seen = {};
  const rows = [];
  sortBy(res.data || [], "score", true)
    .sort((a, b) => {
      const sd = (b.score || 0) - (a.score || 0);
      if (sd !== 0) {
        return sd;
      }
      return (a.elapsedMs || 0) - (b.elapsedMs || 0);
    })
    .forEach((item) => {
      if (seen[item.playerId]) {
        return;
      }
      seen[item.playerId] = true;
      rows.push({
        playerId: item.playerId,
        nickName: item.nickName || "玩家",
        score: item.score || 0,
        elapsedMs: item.elapsedMs || 0,
      });
    });
  return ok(
    rows.slice(0, 20).map((item, index) => ({
      ...item,
      rank: index + 1,
      isSelf: item.playerId === playerId,
    }))
  );
}

async function actionMarkOffline(payload) {
  const player = payload.player || {};
  if (!player.id) {
    return fail("player_id_missing");
  }
  await db.collection("players").doc(player.id).set({
    data: {
      playerId: player.id,
      nickName: player.name || "玩家",
      roomCode: "",
      onlineAt: Date.now() - 120000,
      updatedAt: Date.now(),
    },
  });
  return ok({ success: true });
}

exports.main = async (event) => {
  try {
    const action = event.action || "";
    const payload = event.payload || {};
    if (action === "health") {
      return actionHealth(payload);
    }
    if (action === "heartbeat") {
      return actionHeartbeat(payload);
    }
    if (action === "fetchOnlinePlayers") {
      return actionFetchOnlinePlayers(payload);
    }
    if (action === "createBattleRoom") {
      return actionCreateBattleRoom(payload);
    }
    if (action === "quickMatch") {
      return actionQuickMatch(payload);
    }
    if (action === "joinRoomByCode") {
      return actionJoinRoomByCode(payload);
    }
    if (action === "getRoom") {
      return actionGetRoom(payload);
    }
    if (action === "startAnswer") {
      return actionStartAnswer(payload);
    }
    if (action === "updateBattleState") {
      return actionUpdateBattleState(payload);
    }
    if (action === "finalizeRoom") {
      return actionFinalizeRoom(payload);
    }
    if (action === "uploadSpeedRecord") {
      return actionUploadSpeedRecord(payload);
    }
    if (action === "fetchSpeedRankings") {
      return actionFetchSpeedRankings(payload);
    }
    if (action === "markOffline") {
      return actionMarkOffline(payload);
    }
    return fail(`unknown_action:${action}`);
  } catch (error) {
    return fail(error && error.message ? error.message : String(error));
  }
};
