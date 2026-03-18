const {
  DAILY_BONUS,
  GRADE_ORDER,
  GACHA_CONFIG,
  ITEM_DEFS,
  OPERATOR_ORDER,
  PET_DEFS,
  PET_SHARD_NEEDS,
  SKIN_DEFS,
  SKIN_SHARD_NEEDS,
  TITLES,
  currentTitleByPoints,
  detectOperator,
} = require("../domain/rules");

const PROFILE_KEY = "nm_game_profile_v1";
const DAILY_KEY = "nm_game_daily_v1";
const PLAYER_KEY = "nm_cloud_player_v1";

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(
    2,
    "0"
  )}`;
}

function randomId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultPlayer() {
  return {
    id: randomId("p"),
    name: `\u73a9\u5bb6${Math.floor(Math.random() * 9000 + 1000)}`,
  };
}

function createOpBucket() {
  return {
    attempts: 0,
    correct: 0,
    totalMs: 0,
    avgMs: 0,
    accuracy: 0,
  };
}

function createGradeBucket() {
  return {
    sessions: 0,
    answers: 0,
    correct: 0,
    totalMs: 0,
    avgMs: 0,
    accuracy: 0,
  };
}

function createModeBucket() {
  return {
    sessions: 0,
    answers: 0,
    correct: 0,
    totalMs: 0,
    avgMs: 0,
    accuracy: 0,
  };
}

function defaultInventory() {
  return {
    extra_time_card: 1,
    revive_card: 1,
    skip_level_card: 0,
  };
}

function defaultSkins() {
  return {
    owned: ["skin_basic"],
    equipped: "skin_basic",
    shards: {
      skin_candy: 0,
      skin_space: 0,
    },
  };
}

function defaultPets() {
  return {
    equipped: "pet_memory_sprite",
    owned: {
      pet_memory_sprite: {
        level: 1,
        shards: 0,
        unlockedAt: Date.now(),
      },
    },
  };
}

function defaultStudyReport() {
  const byOperator = {};
  OPERATOR_ORDER.forEach((op) => {
    byOperator[op] = createOpBucket();
  });

  const byGrade = {};
  GRADE_ORDER.forEach((gradeId) => {
    byGrade[gradeId] = createGradeBucket();
  });

  return {
    totalSessions: 0,
    totalAnswers: 0,
    totalCorrect: 0,
    totalAnswerMs: 0,
    avgAnswerMs: 0,
    bestCombo: 0,
    totalCrits: 0,
    byOperator,
    byGrade,
    byMode: {
      gate: createModeBucket(),
      daily: createModeBucket(),
      speed: createModeBucket(),
      battle: createModeBucket(),
      meteor: createModeBucket(),
    },
    recentSessions: [],
  };
}

function defaultProfile() {
  return {
    nickname: "\u73a9\u5bb6",
    coins: 0,
    gems: 0,
    studyExp: 0,
    points: 0,
    selectedGrade: "grade1",
    totalGames: 0,
    totalCorrect: 0,
    totalQuestions: 0,
    clearedLevels: {
      beginner: 0,
      advanced: 0,
      challenge: 0,
    },
    unlockedTitles: ["title_1"],
    activeTitle: "title_1",
    bestSpeedScore: 0,
    bestMeteorScore: 0,
    speedRecords: [],
    battleWins: 0,
    battleTotal: 0,
    recentOpponents: [],
    inventory: defaultInventory(),
    skins: defaultSkins(),
    pets: defaultPets(),
    studyReport: defaultStudyReport(),
    updatedAt: Date.now(),
  };
}

function normalizeBucket(bucket) {
  const safe = {
    attempts: 0,
    correct: 0,
    totalMs: 0,
    avgMs: 0,
    accuracy: 0,
    ...(bucket || {}),
  };
  safe.avgMs = safe.attempts ? Math.round(safe.totalMs / safe.attempts) : 0;
  safe.accuracy = safe.attempts ? Math.round((safe.correct / safe.attempts) * 100) : 0;
  return safe;
}

function normalizeSummaryBucket(bucket) {
  const safe = {
    sessions: 0,
    answers: 0,
    correct: 0,
    totalMs: 0,
    avgMs: 0,
    accuracy: 0,
    ...(bucket || {}),
  };
  safe.avgMs = safe.answers ? Math.round(safe.totalMs / safe.answers) : 0;
  safe.accuracy = safe.answers ? Math.round((safe.correct / safe.answers) * 100) : 0;
  return safe;
}

function normalizeStudyReport(input) {
  const base = defaultStudyReport();
  const source = input && typeof input === "object" ? input : {};
  const report = {
    ...base,
    ...source,
    byOperator: { ...base.byOperator },
    byGrade: { ...base.byGrade },
    byMode: { ...base.byMode },
    recentSessions: Array.isArray(source.recentSessions) ? source.recentSessions.slice(0, 20) : [],
  };

  OPERATOR_ORDER.forEach((op) => {
    report.byOperator[op] = normalizeBucket(source.byOperator && source.byOperator[op]);
  });
  GRADE_ORDER.forEach((gradeId) => {
    report.byGrade[gradeId] = normalizeSummaryBucket(source.byGrade && source.byGrade[gradeId]);
  });
  Object.keys(report.byMode).forEach((mode) => {
    report.byMode[mode] = normalizeSummaryBucket(source.byMode && source.byMode[mode]);
  });

  report.avgAnswerMs = report.totalAnswers ? Math.round(report.totalAnswerMs / report.totalAnswers) : 0;
  return report;
}

function mergeProfile(data) {
  const base = defaultProfile();
  const profile = data && typeof data === "object" ? data : {};
  const studyExp =
    typeof profile.studyExp === "number"
      ? profile.studyExp
      : typeof profile.points === "number"
      ? profile.points
      : base.studyExp;
  const coins =
    typeof profile.coins === "number"
      ? profile.coins
      : typeof profile.points === "number"
      ? profile.points
      : base.coins;

  const merged = {
    ...base,
    ...profile,
    coins,
    studyExp,
    points: studyExp,
    gems: typeof profile.gems === "number" ? profile.gems : base.gems,
    selectedGrade: GRADE_ORDER.indexOf(profile.selectedGrade) >= 0 ? profile.selectedGrade : base.selectedGrade,
    clearedLevels: {
      ...base.clearedLevels,
      ...(profile.clearedLevels || {}),
    },
    inventory: {
      ...base.inventory,
      ...(profile.inventory || {}),
    },
    skins: {
      ...base.skins,
      ...(profile.skins || {}),
      owned:
        profile.skins && Array.isArray(profile.skins.owned) && profile.skins.owned.length
          ? profile.skins.owned.slice()
          : base.skins.owned.slice(),
      shards: {
        ...base.skins.shards,
        ...((profile.skins && profile.skins.shards) || {}),
      },
    },
    pets: {
      ...base.pets,
      ...(profile.pets || {}),
      owned: {
        ...base.pets.owned,
        ...((profile.pets && profile.pets.owned) || {}),
      },
    },
    studyReport: normalizeStudyReport(profile.studyReport),
  };

  if (!Array.isArray(merged.unlockedTitles) || merged.unlockedTitles.length === 0) {
    merged.unlockedTitles = ["title_1"];
  }
  if (!Array.isArray(merged.speedRecords)) {
    merged.speedRecords = [];
  }
  if (!Array.isArray(merged.recentOpponents)) {
    merged.recentOpponents = [];
  }
  if (merged.skins.owned.indexOf("skin_basic") < 0) {
    merged.skins.owned.unshift("skin_basic");
  }
  if (!SKIN_DEFS[merged.skins.equipped]) {
    merged.skins.equipped = "skin_basic";
  }
  if (!merged.pets.owned.pet_memory_sprite) {
    merged.pets.owned.pet_memory_sprite = base.pets.owned.pet_memory_sprite;
  }
  if (!PET_DEFS[merged.pets.equipped] || !merged.pets.owned[merged.pets.equipped]) {
    merged.pets.equipped = "pet_memory_sprite";
  }
  return merged;
}

function getProfile() {
  const data = wx.getStorageSync(PROFILE_KEY);
  return mergeProfile(data);
}

function saveProfile(profile) {
  const finalProfile = mergeProfile(profile);
  finalProfile.points = finalProfile.studyExp;
  finalProfile.updatedAt = Date.now();
  wx.setStorageSync(PROFILE_KEY, finalProfile);
  return finalProfile;
}

function getPlayer() {
  const data = wx.getStorageSync(PLAYER_KEY);
  if (data && data.id && data.name) {
    return data;
  }
  const player = defaultPlayer();
  wx.setStorageSync(PLAYER_KEY, player);
  return player;
}

function savePlayer(player) {
  wx.setStorageSync(PLAYER_KEY, player);
  return player;
}

function getDailyState() {
  const data = wx.getStorageSync(DAILY_KEY);
  const current = today();
  if (!data || data.date !== current) {
    const next = {
      date: current,
      played: false,
      rewardClaimed: false,
      bestCorrect: 0,
    };
    wx.setStorageSync(DAILY_KEY, next);
    return next;
  }
  return data;
}

function saveDailyState(state) {
  wx.setStorageSync(DAILY_KEY, state);
  return state;
}

function touchDaily({ correctCount, isClear }) {
  const daily = getDailyState();
  daily.played = true;
  daily.bestCorrect = Math.max(daily.bestCorrect || 0, correctCount || 0);
  let bonus = 0;
  if (isClear && !daily.rewardClaimed) {
    daily.rewardClaimed = true;
    bonus = DAILY_BONUS;
  }
  saveDailyState(daily);
  return { daily, bonus };
}

function refreshTitles(profile, prevTitle) {
  const unlocked = TITLES.filter((item) => profile.studyExp >= item.threshold).map((item) => item.id);
  profile.unlockedTitles = unlocked.length ? unlocked : ["title_1"];
  const current = currentTitleByPoints(profile.studyExp);
  profile.activeTitle = current.id;
  return prevTitle !== current.id ? current : null;
}

function pushRecentOpponent(profile, opponent) {
  if (!opponent || !opponent.id) {
    return;
  }
  const next = [opponent, ...profile.recentOpponents.filter((item) => item.id !== opponent.id)];
  profile.recentOpponents = next.slice(0, 20);
}

function canAfford(profile, costCoins) {
  return Number(profile.coins || 0) >= Number(costCoins || 0);
}

function addInventoryItemToProfile(profile, itemId, count) {
  if (!ITEM_DEFS[itemId]) {
    return 0;
  }
  const nextCount = Math.max(0, Number(count || 0));
  profile.inventory[itemId] = Math.max(0, Number(profile.inventory[itemId] || 0) + nextCount);
  return profile.inventory[itemId];
}

function unlockSkinInProfile(profile, skinId) {
  if (!SKIN_DEFS[skinId]) {
    return false;
  }
  if (profile.skins.owned.indexOf(skinId) >= 0) {
    return false;
  }
  profile.skins.owned.push(skinId);
  return true;
}

function addSkinShardsToProfile(profile, skinId, count) {
  if (!SKIN_DEFS[skinId]) {
    return { unlocked: false, total: 0 };
  }
  const nextCount = Math.max(0, Number(count || 0));
  profile.skins.shards[skinId] = Math.max(0, Number(profile.skins.shards[skinId] || 0) + nextCount);
  const need = SKIN_SHARD_NEEDS[skinId] || 0;
  let unlocked = false;
  if (need > 0 && profile.skins.shards[skinId] >= need) {
    unlocked = unlockSkinInProfile(profile, skinId);
  }
  return {
    unlocked,
    total: profile.skins.shards[skinId],
    need,
  };
}

function unlockPetInProfile(profile, petId) {
  if (!PET_DEFS[petId]) {
    return false;
  }
  if (profile.pets.owned[petId]) {
    return false;
  }
  profile.pets.owned[petId] = {
    level: 1,
    shards: PET_SHARD_NEEDS[petId] || 0,
    unlockedAt: Date.now(),
  };
  return true;
}

function addPetShardsToProfile(profile, petId, count) {
  if (!PET_DEFS[petId]) {
    return { unlocked: false, total: 0 };
  }
  if (!profile.pets.owned[petId]) {
    profile.pets.owned[petId] = {
      level: 0,
      shards: 0,
      unlockedAt: 0,
    };
  }

  const pet = profile.pets.owned[petId];
  pet.shards = Math.max(0, Number(pet.shards || 0) + Math.max(0, Number(count || 0)));
  const need = PET_SHARD_NEEDS[petId] || 0;
  let unlocked = false;
  if (need > 0 && pet.shards >= need && (!pet.level || pet.level < 1)) {
    pet.level = 1;
    pet.unlockedAt = Date.now();
    unlocked = true;
  }
  return {
    unlocked,
    total: pet.shards,
    need,
  };
}

function pickWeightedReward() {
  const rewards = GACHA_CONFIG.rewards || [];
  const total = rewards.reduce((sum, item) => sum + Number(item.weight || 0), 0);
  let cursor = Math.random() * total;
  for (let i = 0; i < rewards.length; i += 1) {
    cursor -= Number(rewards[i].weight || 0);
    if (cursor <= 0) {
      return rewards[i];
    }
  }
  return rewards[rewards.length - 1];
}

function rewardSummary(base) {
  return {
    type: base.type,
    id: base.id,
    count: base.count || 1,
    label: "",
    detail: "",
    unlocked: false,
    refundCoins: 0,
  };
}

function applyGachaReward(profile, reward) {
  const result = rewardSummary(reward);
  const count = Math.max(1, Number(reward.count || 1));

  if (reward.type === "item") {
    addInventoryItemToProfile(profile, reward.id, count);
    result.label = `${ITEM_DEFS[reward.id].name} x${count}`;
    result.detail = ITEM_DEFS[reward.id].desc;
    return result;
  }

  if (reward.type === "skin") {
    const unlocked = unlockSkinInProfile(profile, reward.id);
    if (!unlocked) {
      profile.coins += 40;
      result.refundCoins = 40;
      result.label = `${SKIN_DEFS[reward.id].name} \u91cd\u590d`;
      result.detail = "\u5df2\u81ea\u52a8\u8f6c\u6362\u4e3a 40 \u91d1\u5e01";
      return result;
    }
    result.unlocked = true;
    result.label = SKIN_DEFS[reward.id].name;
    result.detail = "\u83b7\u5f97\u6c38\u4e45\u76ae\u80a4";
    return result;
  }

  if (reward.type === "skin_shard") {
    const status = addSkinShardsToProfile(profile, reward.id, count);
    result.unlocked = status.unlocked;
    result.label = `${SKIN_DEFS[reward.id].name}\u788e\u7247 x${count}`;
    result.detail = status.unlocked
      ? "\u788e\u7247\u5df2\u96c6\u9f50\uff0c\u76ae\u80a4\u5df2\u89e3\u9501"
      : `\u5f53\u524d ${status.total}/${status.need}`;
    return result;
  }

  if (reward.type === "pet_shard") {
    const status = addPetShardsToProfile(profile, reward.id, count);
    result.unlocked = status.unlocked;
    result.label = `${PET_DEFS[reward.id].name}\u788e\u7247 x${count}`;
    result.detail = status.unlocked
      ? "\u840c\u5ba0\u5df2\u89e3\u9501\uff0c\u53ef\u4ee5\u53bb\u5546\u5e97\u4f69\u6234"
      : `\u5f53\u524d ${status.total}/${status.need}`;
    return result;
  }

  result.label = "\u795e\u79d8\u5956\u52b1";
  result.detail = "\u5956\u52b1\u5df2\u6536\u5165\u80cc\u5305";
  return result;
}

function normalizeQuestionItem(question) {
  const operator = question.operator || detectOperator(question.expression);
  const answered =
    question.status === "correct" ||
    question.status === "wrong" ||
    question.status === "timeout" ||
    question.userAnswer !== null;
  const correct =
    question.status === "correct" ||
    (typeof question.userAnswer === "number" && typeof question.answer === "number" && question.userAnswer === question.answer);

  return {
    operator,
    answered,
    correct,
    answerMs: Math.max(0, Number(question.answerMs || question.responseMs || 0)),
  };
}

function createStudySessionSummary(session) {
  const questions = Array.isArray(session.questionResults)
    ? session.questionResults
    : Array.isArray(session.questions)
    ? session.questions
    : [];
  const byOperator = {};
  OPERATOR_ORDER.forEach((op) => {
    byOperator[op] = createOpBucket();
  });

  let totalAnswers = 0;
  let correctAnswers = 0;
  let totalAnswerMs = 0;

  questions.forEach((question) => {
    const item = normalizeQuestionItem(question);
    if (!item.answered || !byOperator[item.operator]) {
      return;
    }
    totalAnswers += 1;
    if (item.correct) {
      correctAnswers += 1;
    }
    totalAnswerMs += item.answerMs;

    const bucket = byOperator[item.operator];
    bucket.attempts += 1;
    if (item.correct) {
      bucket.correct += 1;
    }
    bucket.totalMs += item.answerMs;
  });

  if (!questions.length && session.totalCount) {
    totalAnswers = Number(session.totalCount || 0);
    correctAnswers = Number(session.correctCount || 0);
  }

  OPERATOR_ORDER.forEach((op) => {
    byOperator[op] = normalizeBucket(byOperator[op]);
  });

  const accuracy = totalAnswers ? Math.round((correctAnswers / totalAnswers) * 100) : 0;
  const avgAnswerMs = totalAnswers ? Math.round(totalAnswerMs / totalAnswers) : 0;

  return {
    mode: session.mode || "gate",
    gradeId: GRADE_ORDER.indexOf(session.gradeId) >= 0 ? session.gradeId : session.grade || "grade1",
    totalAnswers,
    correctAnswers,
    wrongAnswers: Math.max(0, totalAnswers - correctAnswers),
    totalAnswerMs,
    avgAnswerMs,
    accuracy,
    comboBest: Number(session.comboBest || 0),
    critCount: Number(session.critCount || 0),
    coinReward: Number(session.coins != null ? session.coins : session.points || 0),
    durationMs: Number(session.elapsedMs || session.durationMs || 0),
    byOperator,
    playedAt: Date.now(),
  };
}

function applyStudySummary(reportInput, summary) {
  const report = normalizeStudyReport(reportInput);
  report.totalSessions += 1;
  report.totalAnswers += summary.totalAnswers;
  report.totalCorrect += summary.correctAnswers;
  report.totalAnswerMs += summary.totalAnswerMs;
  report.avgAnswerMs = report.totalAnswers ? Math.round(report.totalAnswerMs / report.totalAnswers) : 0;
  report.bestCombo = Math.max(report.bestCombo || 0, summary.comboBest || 0);
  report.totalCrits += summary.critCount || 0;

  OPERATOR_ORDER.forEach((op) => {
    const target = report.byOperator[op];
    const source = summary.byOperator[op];
    target.attempts += source.attempts || 0;
    target.correct += source.correct || 0;
    target.totalMs += source.totalMs || 0;
    report.byOperator[op] = normalizeBucket(target);
  });

  const gradeId = GRADE_ORDER.indexOf(summary.gradeId) >= 0 ? summary.gradeId : "grade1";
  const gradeBucket = report.byGrade[gradeId];
  gradeBucket.sessions += 1;
  gradeBucket.answers += summary.totalAnswers;
  gradeBucket.correct += summary.correctAnswers;
  gradeBucket.totalMs += summary.totalAnswerMs;
  report.byGrade[gradeId] = normalizeSummaryBucket(gradeBucket);

  if (!report.byMode[summary.mode]) {
    report.byMode[summary.mode] = createModeBucket();
  }
  const modeBucket = report.byMode[summary.mode];
  modeBucket.sessions += 1;
  modeBucket.answers += summary.totalAnswers;
  modeBucket.correct += summary.correctAnswers;
  modeBucket.totalMs += summary.totalAnswerMs;
  report.byMode[summary.mode] = normalizeSummaryBucket(modeBucket);

  report.recentSessions.unshift(summary);
  report.recentSessions = report.recentSessions.slice(0, 20);
  return report;
}

function setSelectedGrade(profileInput, gradeId) {
  const profile = mergeProfile(profileInput);
  profile.selectedGrade = GRADE_ORDER.indexOf(gradeId) >= 0 ? gradeId : profile.selectedGrade;
  return saveProfile(profile);
}

function getStudyReport(profileInput) {
  const profile = mergeProfile(profileInput);
  return normalizeStudyReport(profile.studyReport);
}

function buyShopItem(profileInput, itemId, count) {
  const def = ITEM_DEFS[itemId];
  const profile = mergeProfile(profileInput);
  const amount = Math.max(1, Number(count || 1));
  const clears = (profile.clearedLevels.beginner || 0) + (profile.clearedLevels.advanced || 0) + (profile.clearedLevels.challenge || 0);

  if (!def) {
    return { ok: false, reason: "item_not_found", profile };
  }
  if (clears < Number(def.unlockClears || 0)) {
    return {
      ok: false,
      reason: "item_locked",
      profile,
      needClears: def.unlockClears || 0,
    };
  }
  const totalCost = def.priceCoins * amount;
  if (!canAfford(profile, totalCost)) {
    return { ok: false, reason: "coins_not_enough", profile };
  }

  profile.coins -= totalCost;
  addInventoryItemToProfile(profile, itemId, amount);
  return {
    ok: true,
    profile: saveProfile(profile),
    itemId,
    count: amount,
    costCoins: totalCost,
  };
}

function consumeInventoryItem(profileInput, itemId, count) {
  const profile = mergeProfile(profileInput);
  const amount = Math.max(1, Number(count || 1));
  const current = Math.max(0, Number(profile.inventory[itemId] || 0));
  if (current < amount) {
    return { ok: false, reason: "item_not_enough", profile };
  }
  profile.inventory[itemId] = current - amount;
  return {
    ok: true,
    profile: saveProfile(profile),
    itemId,
    count: amount,
  };
}

function equipSkin(profileInput, skinId) {
  const profile = mergeProfile(profileInput);
  if (profile.skins.owned.indexOf(skinId) < 0) {
    return { ok: false, reason: "skin_locked", profile };
  }
  profile.skins.equipped = skinId;
  return {
    ok: true,
    profile: saveProfile(profile),
    skinId,
  };
}

function equipPet(profileInput, petId) {
  const profile = mergeProfile(profileInput);
  const pet = profile.pets.owned[petId];
  if (!pet || !pet.level) {
    return { ok: false, reason: "pet_locked", profile };
  }
  profile.pets.equipped = petId;
  return {
    ok: true,
    profile: saveProfile(profile),
    petId,
  };
}

function performGacha(profileInput) {
  const profile = mergeProfile(profileInput);
  const costCoins = Number(GACHA_CONFIG.costCoins || 0);
  if (!canAfford(profile, costCoins)) {
    return { ok: false, reason: "coins_not_enough", profile };
  }

  profile.coins -= costCoins;
  const reward = pickWeightedReward();
  const outcome = applyGachaReward(profile, reward);
  return {
    ok: true,
    profile: saveProfile(profile),
    costCoins,
    reward: outcome,
  };
}

function skipGateLevel(profileInput, difficulty, level) {
  const consume = consumeInventoryItem(profileInput, "skip_level_card", 1);
  if (!consume.ok) {
    return consume;
  }
  const profile = mergeProfile(consume.profile);
  const safeLevel = Math.max(1, Number(level || 1));
  const key = difficulty || "beginner";
  profile.clearedLevels[key] = Math.max(profile.clearedLevels[key] || 0, safeLevel);
  return {
    ok: true,
    profile: saveProfile(profile),
    difficulty: key,
    level: safeLevel,
  };
}

function applySession(profileInput, session) {
  const profile = mergeProfile(profileInput);
  const prevTitle = profile.activeTitle;
  const coins = Number(session.coins != null ? session.coins : session.points || 0);
  const gems = Number(session.gems || 0);
  const studyExp = Number(session.studyExp != null ? session.studyExp : session.points || coins);
  const totalCount = Number(session.totalCount || 0);
  const correctCount = Number(session.correctCount || 0);

  profile.coins += coins;
  profile.gems += gems;
  profile.studyExp += studyExp;
  profile.points = profile.studyExp;
  profile.totalGames += 1;
  profile.totalCorrect += correctCount;
  profile.totalQuestions += totalCount;

  if (session.mode === "gate" && session.isClear && session.difficulty && session.level) {
    const old = profile.clearedLevels[session.difficulty] || 0;
    profile.clearedLevels[session.difficulty] = Math.max(old, session.level);
  }

  if (session.mode === "speed" && session.speedScore) {
    profile.bestSpeedScore = Math.max(profile.bestSpeedScore || 0, session.speedScore);
    profile.speedRecords.push({
      score: session.speedScore,
      elapsedMs: session.elapsedMs || 0,
      at: Date.now(),
    });
    profile.speedRecords.sort((a, b) => b.score - a.score || a.elapsedMs - b.elapsedMs);
    profile.speedRecords = profile.speedRecords.slice(0, 20);
  }

  if (session.mode === "meteor") {
    profile.bestMeteorScore = Math.max(profile.bestMeteorScore || 0, Number(session.meteorScore || session.score || 0));
  }

  if (session.mode === "battle") {
    profile.battleTotal += 1;
    if (session.battleWin) {
      profile.battleWins += 1;
    }
    if (session.opponent) {
      pushRecentOpponent(profile, session.opponent);
    }
  }

  if (session.gradeId && GRADE_ORDER.indexOf(session.gradeId) >= 0) {
    profile.selectedGrade = session.gradeId;
  }

  profile.studyReport = applyStudySummary(profile.studyReport, createStudySessionSummary(session));

  const newTitle = refreshTitles(profile, prevTitle);
  saveProfile(profile);
  return {
    profile,
    newTitle,
  };
}

module.exports = {
  applySession,
  buyShopItem,
  consumeInventoryItem,
  createStudySessionSummary,
  equipPet,
  equipSkin,
  getDailyState,
  getPlayer,
  getProfile,
  getStudyReport,
  performGacha,
  savePlayer,
  saveProfile,
  setSelectedGrade,
  skipGateLevel,
  touchDaily,
};
