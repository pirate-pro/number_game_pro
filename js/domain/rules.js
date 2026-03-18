const DIFFICULTY_ORDER = ["beginner", "advanced", "challenge"];
const GRADE_ORDER = ["grade1", "grade2", "grade3"];
const OPERATOR_ORDER = ["+", "-", "*", "/"];
const MAX_LEVEL = 7;
const LEVEL_COUNTS = [3, 4, 5, 6, 7, 8, 10];
const DAILY_BONUS = 12;
const ITEM_UNLOCK_CLEARS = 5;
const MODE_FEATURE_POLICY = {
  gate: { items: true, pets: true },
  daily: { items: true, pets: true },
  speed: { items: false, pets: false },
  battle: { items: false, pets: false },
  meteor: { items: false, pets: false },
};

const ITEM_DEFS = {
  extra_time_card: {
    id: "extra_time_card",
    name: "\u52a0\u65f6\u5361",
    desc: "\u4f5c\u7b54\u65f6\u95f4 +2 \u79d2",
    priceCoins: 60,
    unlockClears: ITEM_UNLOCK_CLEARS,
    allowedModes: ["gate", "daily"],
  },
  revive_card: {
    id: "revive_card",
    name: "\u590d\u6d3b\u5361",
    desc: "\u7b54\u9519\u540e\u53ef\u4ee5\u91cd\u65b0\u653b\u51fb\u4e00\u6b21",
    priceCoins: 90,
    unlockClears: ITEM_UNLOCK_CLEARS,
    allowedModes: ["gate", "daily"],
  },
  skip_level_card: {
    id: "skip_level_card",
    name: "\u8df3\u5173\u5361",
    desc: "\u5728\u95ef\u5173\u6a21\u5f0f\u4e2d\u76f4\u63a5\u8dc3\u8fc7\u5f53\u524d\u5173\u5361",
    priceCoins: 180,
    unlockClears: 2,
    allowedModes: ["gate"],
  },
};

const SKIN_SHARD_NEEDS = {
  skin_candy: 8,
  skin_space: 16,
};

const SKIN_DEFS = {
  skin_basic: {
    id: "skin_basic",
    name: "\u57fa\u7840\u6b3e",
    rarity: "common",
    cardStyle: {
      fill: "#f8fafc",
      border: "#dbe4ea",
      text: "#111827",
      accent: "#2563eb",
      glow: "rgba(37,99,235,0.16)",
      pattern: "plain",
    },
  },
  skin_candy: {
    id: "skin_candy",
    name: "\u7cd6\u679c\u98ce",
    rarity: "rare",
    cardStyle: {
      fill: "#fff1f6",
      border: "#f9a8d4",
      text: "#831843",
      accent: "#fb7185",
      glow: "rgba(251,113,133,0.18)",
      pattern: "sprinkles",
    },
  },
  skin_space: {
    id: "skin_space",
    name: "\u5b87\u5b99\u98ce",
    rarity: "epic",
    cardStyle: {
      fill: "#0f172a",
      border: "#60a5fa",
      text: "#e0e7ff",
      accent: "#8b5cf6",
      glow: "rgba(139,92,246,0.22)",
      pattern: "stars",
    },
  },
};

const PET_SHARD_NEEDS = {
  pet_memory_sprite: 0,
  pet_math_dino: 10,
  pet_guardian_egg: 10,
};

const PET_DEFS = {
  pet_memory_sprite: {
    id: "pet_memory_sprite",
    name: "\u8bb0\u5fc6\u7cbe\u7075",
    desc: "\u95ef\u5173\u6a21\u5f0f\u4e0b\uff0c\u8bb0\u5fc6\u9636\u6bb5 +1 \u79d2",
    rarity: "starter",
    buff: { type: "memory_time_bonus", value: 1 },
    color: "#34d399",
  },
  pet_math_dino: {
    id: "pet_math_dino",
    name: "\u7b97\u672f\u5c0f\u6050\u9f99",
    desc: "\u95ef\u5173\u7ed3\u7b97\u91d1\u5e01 +15%",
    rarity: "rare",
    buff: { type: "coin_bonus_rate", value: 0.15 },
    color: "#fb923c",
  },
  pet_guardian_egg: {
    id: "pet_guardian_egg",
    name: "\u5b88\u62a4\u86cb",
    desc: "\u7b54\u9519\u65f6 10% \u6982\u7387\u89e6\u53d1\u4e00\u6b21\u514d\u6b7b",
    rarity: "rare",
    buff: { type: "fail_guard_chance", value: 0.1 },
    color: "#a78bfa",
  },
};

const GACHA_CONFIG = {
  costCoins: 120,
  animationMs: 1800,
  rewards: [
    { type: "item", id: "extra_time_card", count: 1, weight: 34 },
    { type: "item", id: "revive_card", count: 1, weight: 24 },
    { type: "item", id: "skip_level_card", count: 1, weight: 10 },
    { type: "skin_shard", id: "skin_candy", count: 1, weight: 14 },
    { type: "skin_shard", id: "skin_space", count: 1, weight: 8 },
    { type: "skin", id: "skin_candy", count: 1, weight: 3 },
    { type: "skin", id: "skin_space", count: 1, weight: 1 },
    { type: "pet_shard", id: "pet_math_dino", count: 2, weight: 4 },
    { type: "pet_shard", id: "pet_guardian_egg", count: 2, weight: 2 },
  ],
};

const DIFFICULTIES = {
  beginner: {
    key: "beginner",
    name: "\u5165\u95e8",
    desc: "\u8282\u594f\u66f4\u6162\uff0c\u9002\u5408\u521d\u6b65\u5fc3\u7b97",
    memoryTime: 8,
    answerTime: 30,
    defaultGrade: "grade1",
    tierOffset: 0,
  },
  advanced: {
    key: "advanced",
    name: "\u8fdb\u9636",
    desc: "\u9898\u76ee\u66f4\u5bc6\u96c6\uff0c\u8fdb\u5165\u4e58\u6cd5\u8bad\u7ec3",
    memoryTime: 6,
    answerTime: 22,
    defaultGrade: "grade2",
    tierOffset: 1,
  },
  challenge: {
    key: "challenge",
    name: "\u6311\u6218",
    desc: "\u6df7\u5408\u8fd0\u7b97\u4e0e\u9ad8\u538b\u8282\u594f",
    memoryTime: 5,
    answerTime: 18,
    defaultGrade: "grade3",
    tierOffset: 2,
  },
};

const GRADE_PROFILES = {
  grade1: {
    id: "grade1",
    name: "\u4e00\u5e74\u7ea7",
    desc: "20\u4ee5\u5185\u52a0\u51cf",
  },
  grade2: {
    id: "grade2",
    name: "\u4e8c\u5e74\u7ea7",
    desc: "\u8868\u5185\u4e58\u6cd5",
  },
  grade3: {
    id: "grade3",
    name: "\u4e09\u5e74\u7ea7",
    desc: "\u6df7\u5408\u8fd0\u7b97",
  },
};

const TITLES = [
  { id: "title_1", name: "\u8bb0\u5fc6\u65b0\u82bd", threshold: 0 },
  { id: "title_2", name: "\u5fc3\u7b97\u5b66\u5f92", threshold: 20 },
  { id: "title_3", name: "\u95ef\u5173\u884c\u8005", threshold: 60 },
  { id: "title_4", name: "\u901f\u7b97\u9a91\u58eb", threshold: 120 },
  { id: "title_5", name: "\u8bb0\u5fc6\u730e\u624b", threshold: 200 },
  { id: "title_6", name: "\u7b97\u5f0f\u5b97\u5e08", threshold: 320 },
  { id: "title_7", name: "\u51b2\u699c\u4f20\u5947", threshold: 460 },
  { id: "title_8", name: "\u6570\u5fc6\u4e4b\u738b", threshold: 640 },
];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(list) {
  return list[randInt(0, list.length - 1)];
}

function symbolFor(op) {
  if (op === "*") {
    return "\u00d7";
  }
  if (op === "/") {
    return "\u00f7";
  }
  return op;
}

function difficultyTierOffset(difficulty) {
  const item = DIFFICULTIES[difficulty] || DIFFICULTIES.beginner;
  return item.tierOffset || 0;
}

function resolveGradeId(params) {
  const gradeId = params && params.grade ? params.grade : "";
  if (gradeId && GRADE_PROFILES[gradeId]) {
    return gradeId;
  }
  const difficulty = params && params.difficulty ? params.difficulty : "beginner";
  return (DIFFICULTIES[difficulty] || DIFFICULTIES.beginner).defaultGrade;
}

function getGradeProfile(gradeId) {
  return GRADE_PROFILES[gradeId] || GRADE_PROFILES.grade1;
}

function resolveTier(level, difficulty, mode) {
  if (mode === "speed") {
    return 4;
  }
  const safeLevel = Math.max(1, Math.min(MAX_LEVEL, Number(level) || 1));
  return safeLevel + difficultyTierOffset(difficulty);
}

function resolveOperationPool(gradeId, tier, mode) {
  if (mode === "speed") {
    return ["+", "-", "*"];
  }
  if (gradeId === "grade1") {
    return ["+", "-"];
  }
  if (gradeId === "grade2") {
    return ["*"];
  }
  if (tier <= 3) {
    return ["+", "-", "*"];
  }
  return ["+", "-", "*", "/"];
}

function createAddQuestion(maxSum) {
  const a = randInt(0, maxSum);
  const b = randInt(0, maxSum - a);
  return { left: a, right: b, operator: "+", answer: a + b };
}

function createSubQuestion(maxValue) {
  const a = randInt(0, maxValue);
  const b = randInt(0, a);
  return { left: a, right: b, operator: "-", answer: a - b };
}

function createMulQuestion(maxFactor) {
  const a = randInt(1, maxFactor);
  const b = randInt(1, maxFactor);
  return { left: a, right: b, operator: "*", answer: a * b };
}

function createDivQuestion(maxFactor) {
  const divisor = randInt(2, maxFactor);
  const quotient = randInt(2, maxFactor);
  return {
    left: divisor * quotient,
    right: divisor,
    operator: "/",
    answer: quotient,
  };
}

function createGradeQuestion(gradeId, operator, tier) {
  if (gradeId === "grade1") {
    const maxValue = tier <= 2 ? 10 : 20;
    return operator === "+" ? createAddQuestion(maxValue) : createSubQuestion(maxValue);
  }

  if (gradeId === "grade2") {
    const maxFactor = tier <= 2 ? 5 : 9;
    return createMulQuestion(maxFactor);
  }

  if (operator === "+") {
    return createAddQuestion(tier <= 3 ? 30 : tier <= 5 ? 50 : 100);
  }
  if (operator === "-") {
    return createSubQuestion(tier <= 3 ? 30 : tier <= 5 ? 50 : 100);
  }
  if (operator === "*") {
    return createMulQuestion(tier <= 4 ? 9 : 12);
  }
  return createDivQuestion(tier <= 4 ? 9 : 12);
}

function withQuestionMeta(base, gradeId, tier, mode, index) {
  return {
    id: `q_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
    expression: `${base.left}${symbolFor(base.operator)}${base.right}`,
    answer: base.answer,
    operator: base.operator,
    operands: [base.left, base.right],
    syllabusId: gradeId,
    tier,
    sourceMode: mode,
    userAnswer: null,
    status: "pending",
    answerMs: 0,
    answeredAt: 0,
  };
}

function generateQuestion({ mode, difficulty, level, grade, tier, index }) {
  const resolvedGradeId = resolveGradeId({ difficulty, grade });
  const resolvedTier =
    typeof tier === "number" && tier > 0
      ? tier
      : resolveTier(level || 1, difficulty || "beginner", mode || "gate");
  const operator = pick(resolveOperationPool(resolvedGradeId, resolvedTier, mode || "gate"));
  const core = createGradeQuestion(resolvedGradeId, operator, resolvedTier);
  return withQuestionMeta(core, resolvedGradeId, resolvedTier, mode || "gate", index || 0);
}

function buildRoundConfig({ mode, difficulty, level, grade }) {
  if (mode === "speed") {
    const speedGrade = resolveGradeId({ difficulty: "advanced", grade: grade || "grade2" });
    return {
      mode: "speed",
      difficulty: "advanced",
      difficultyName: DIFFICULTIES.advanced.name,
      level: 0,
      gradeId: speedGrade,
      gradeName: getGradeProfile(speedGrade).name,
      tier: 4,
      memoryTime: 5,
      answerTime: 20,
      questionCount: 6,
      ops: ["+", "-", "*"],
    };
  }

  const safeLevel = Math.max(1, Math.min(MAX_LEVEL, Number(level) || 1));
  const difficultyCfg = DIFFICULTIES[difficulty] || DIFFICULTIES.beginner;
  const gradeId = resolveGradeId({ difficulty: difficultyCfg.key, grade });
  const tier = resolveTier(safeLevel, difficultyCfg.key, mode);
  const memoryPenalty = Math.floor((safeLevel - 1) / 3);
  const answerPenalty = Math.floor((safeLevel - 1) / 2);
  let questionCount = LEVEL_COUNTS[safeLevel - 1] || 6;
  if (mode === "daily") {
    questionCount = Math.min(questionCount + 1, 10);
  }

  return {
    mode,
    difficulty: difficultyCfg.key,
    difficultyName: difficultyCfg.name,
    level: safeLevel,
    gradeId,
    gradeName: getGradeProfile(gradeId).name,
    tier,
    memoryTime: Math.max(3, difficultyCfg.memoryTime - memoryPenalty),
    answerTime: Math.max(10, difficultyCfg.answerTime - answerPenalty),
    questionCount,
    ops: resolveOperationPool(gradeId, tier, mode),
  };
}

function generateRound({ mode, difficulty, level, grade }) {
  const config = buildRoundConfig({ mode, difficulty, level, grade });
  const questions = [];
  for (let i = 0; i < config.questionCount; i += 1) {
    questions.push(
      generateQuestion({
        mode: config.mode,
        difficulty: config.difficulty,
        level: config.level,
        grade: config.gradeId,
        tier: config.tier,
        index: i,
      })
    );
  }
  return { config, questions };
}

function calcPoints({
  mode,
  correctCount,
  totalCount,
  elapsedMs,
  isClear,
  coinMultiplier,
  flatBonusCoins,
}) {
  const baseStudyExp = isClear ? correctCount * 2 : correctCount;
  const baseCoins = isClear ? correctCount * 2 : correctCount;
  const multiplier = typeof coinMultiplier === "number" ? coinMultiplier : 1;
  const extraCoins = typeof flatBonusCoins === "number" ? flatBonusCoins : 0;

  if (mode === "speed") {
    const speedBase = correctCount * 2;
    const timeBonus = Math.max(0, Math.round((20000 - elapsedMs) / 120));
    const clearBonus = isClear ? 60 : 0;
    const coins = Math.max(0, Math.round(baseCoins * multiplier) + extraCoins);
    return {
      coins,
      points: baseStudyExp,
      studyExp: baseStudyExp,
      speedScore: speedBase + timeBonus + clearBonus,
    };
  }

  const coins = Math.max(0, Math.round(baseCoins * multiplier) + extraCoins);
  return {
    coins,
    points: baseStudyExp,
    studyExp: baseStudyExp,
    speedScore: 0,
  };
}

function canAccessDifficulty(profile, difficulty) {
  if (difficulty === "beginner") {
    return true;
  }
  if (difficulty === "advanced") {
    return (profile.clearedLevels.beginner || 0) >= MAX_LEVEL;
  }
  return (profile.clearedLevels.advanced || 0) >= MAX_LEVEL;
}

function getLockReason(profile, difficulty) {
  if (difficulty === "advanced" && !canAccessDifficulty(profile, "advanced")) {
    return "\u5148\u901a\u5173\u5165\u95e8 1-7 \u5173";
  }
  if (difficulty === "challenge" && !canAccessDifficulty(profile, "challenge")) {
    return "\u5148\u901a\u5173\u8fdb\u9636 1-7 \u5173";
  }
  return "";
}

function getTotalClears(profile) {
  return DIFFICULTY_ORDER.reduce((acc, key) => acc + (profile.clearedLevels[key] || 0), 0);
}

function getModePolicy(mode) {
  return MODE_FEATURE_POLICY[mode] || MODE_FEATURE_POLICY.gate;
}

function canUseItemsInMode(mode) {
  return !!getModePolicy(mode).items;
}

function canUsePetsInMode(mode) {
  return !!getModePolicy(mode).pets;
}

function getItemAvailability(profile, mode) {
  const clears = getTotalClears(profile);
  const inventory = (profile && profile.inventory) || {};
  const safeMode = mode || "gate";
  const itemState = {};

  Object.keys(ITEM_DEFS).forEach((id) => {
    const def = ITEM_DEFS[id];
    const unlocked = clears >= (def.unlockClears || 0);
    const count = Math.max(0, Number(inventory[id] || 0));
    const allowedMode = def.allowedModes.indexOf(safeMode) >= 0;
    itemState[id] = {
      ...def,
      count,
      unlocked,
      canUse: unlocked && allowedMode && canUseItemsInMode(safeMode) && count > 0,
    };
  });

  return {
    revive: !!itemState.revive_card.canUse,
    extraTime: !!itemState.extra_time_card.canUse,
    skipLevel: !!itemState.skip_level_card.canUse,
    reviveCount: itemState.revive_card.count,
    extraTimeCount: itemState.extra_time_card.count,
    skipLevelCount: itemState.skip_level_card.count,
    items: itemState,
    clears,
  };
}

function getSkinShardNeed(skinId) {
  return SKIN_SHARD_NEEDS[skinId] || 0;
}

function getPetShardNeed(petId) {
  return PET_SHARD_NEEDS[petId] || 0;
}

function getEquippedSkin(profile) {
  const id = profile && profile.skins ? profile.skins.equipped : "skin_basic";
  return SKIN_DEFS[id] || SKIN_DEFS.skin_basic;
}

function getEquippedPet(profile) {
  const id = profile && profile.pets ? profile.pets.equipped : "";
  if (!id) {
    return null;
  }
  return PET_DEFS[id] || null;
}

function applyRoundPetBuff(config, pet, mode) {
  if (!pet || !canUsePetsInMode(mode)) {
    return config;
  }
  const next = { ...config };
  if (pet.buff && pet.buff.type === "memory_time_bonus") {
    next.memoryTime += Number(pet.buff.value || 0);
  }
  return next;
}

function applyCoinPetBuff(coins, pet, mode) {
  if (!pet || !canUsePetsInMode(mode)) {
    return coins;
  }
  if (pet.buff && pet.buff.type === "coin_bonus_rate") {
    return Math.max(0, Math.round(coins * (1 + Number(pet.buff.value || 0))));
  }
  return coins;
}

function currentTitleByPoints(points) {
  let current = TITLES[0];
  for (let i = 0; i < TITLES.length; i += 1) {
    if (points >= TITLES[i].threshold) {
      current = TITLES[i];
    }
  }
  return current;
}

function detectOperator(expression) {
  if (!expression) {
    return "";
  }
  if (expression.indexOf("\u00d7") >= 0 || expression.indexOf("*") >= 0) {
    return "*";
  }
  if (expression.indexOf("\u00f7") >= 0 || expression.indexOf("/") >= 0) {
    return "/";
  }
  if (expression.indexOf("-") >= 0) {
    return "-";
  }
  if (expression.indexOf("+") >= 0) {
    return "+";
  }
  return "";
}

function summarizeQuestionSet(questions) {
  const stats = {};
  OPERATOR_ORDER.forEach((op) => {
    stats[op] = {
      attempts: 0,
      correct: 0,
      totalMs: 0,
      avgMs: 0,
      accuracy: 0,
    };
  });

  (questions || []).forEach((question) => {
    const op = question.operator || detectOperator(question.expression);
    if (!stats[op]) {
      return;
    }
    const answered =
      question.status === "correct" ||
      question.status === "wrong" ||
      question.status === "timeout" ||
      question.userAnswer !== null;
    if (!answered) {
      return;
    }
    const bucket = stats[op];
    bucket.attempts += 1;
    if (question.status === "correct") {
      bucket.correct += 1;
    }
    bucket.totalMs += Math.max(0, Number(question.answerMs || 0));
  });

  OPERATOR_ORDER.forEach((op) => {
    const bucket = stats[op];
    bucket.avgMs = bucket.attempts ? Math.round(bucket.totalMs / bucket.attempts) : 0;
    bucket.accuracy = bucket.attempts ? Math.round((bucket.correct / bucket.attempts) * 100) : 0;
  });
  return stats;
}

function formatDuration(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

module.exports = {
  DAILY_BONUS,
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  GACHA_CONFIG,
  GRADE_ORDER,
  GRADE_PROFILES,
  ITEM_DEFS,
  MAX_LEVEL,
  MODE_FEATURE_POLICY,
  OPERATOR_ORDER,
  PET_DEFS,
  PET_SHARD_NEEDS,
  SKIN_DEFS,
  SKIN_SHARD_NEEDS,
  TITLES,
  applyCoinPetBuff,
  applyRoundPetBuff,
  buildRoundConfig,
  calcPoints,
  canAccessDifficulty,
  canUseItemsInMode,
  canUsePetsInMode,
  currentTitleByPoints,
  detectOperator,
  formatDuration,
  generateQuestion,
  generateRound,
  getEquippedPet,
  getEquippedSkin,
  getGradeProfile,
  getItemAvailability,
  getLockReason,
  getModePolicy,
  getPetShardNeed,
  getSkinShardNeed,
  resolveGradeId,
  summarizeQuestionSet,
};
