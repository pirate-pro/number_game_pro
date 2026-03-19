const BaseScene = require("../runtime/base-scene");
const { GRADE_ORDER, GRADE_PROFILES, generateQuestion } = require("../domain/rules");

const MODE_NAME = "\u661f\u7403\u5854\u9632";
const BASE_MAX_HP = 5;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

class Meteor {
  constructor(payload) {
    this.id = payload.id;
    this.question = payload.question;
    this.expression = payload.question.expression;
    this.answer = payload.question.answer;
    this.operator = payload.question.operator;
    this.x = payload.x;
    this.y = payload.y;
    this.radius = payload.radius;
    this.speedY = payload.speedY;
    this.driftX = payload.driftX;
    this.wobbleAmp = payload.wobbleAmp;
    this.wobbleFreq = payload.wobbleFreq;
    this.phase = payload.phase;
    this.rotation = 0;
    this.age = 0;
    this.spawnedAt = payload.spawnedAt;
    this.tint = payload.tint;
  }

  update(dt) {
    this.age += dt;
    this.y += this.speedY * dt;
    this.x += Math.sin(this.phase + this.age * this.wobbleFreq) * this.wobbleAmp * dt;
    this.rotation += this.driftX * 0.003 * dt;
  }

  isAtBase(baseY) {
    return this.y + this.radius >= baseY;
  }

  render(renderer) {
    const ctx = renderer.ctx;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    ctx.beginPath();
    ctx.fillStyle = this.tint.fill;
    ctx.strokeStyle = this.tint.stroke;
    ctx.lineWidth = 3;
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = this.tint.crater;
    ctx.globalAlpha = 0.32;
    ctx.arc(-this.radius * 0.28, -this.radius * 0.18, this.radius * 0.18, 0, Math.PI * 2);
    ctx.arc(this.radius * 0.22, this.radius * 0.12, this.radius * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    renderer.text(this.expression, 0, -2, {
      size: Math.max(14, Math.floor(this.radius * 0.48)),
      weight: "700",
      align: "center",
      baseline: "middle",
      color: this.tint.text,
    });
    renderer.text("=?", 0, this.radius * 0.34, {
      size: Math.max(10, Math.floor(this.radius * 0.26)),
      weight: "600",
      align: "center",
      baseline: "middle",
      color: this.tint.text,
    });
    ctx.restore();
  }
}

class MeteorScene extends BaseScene {
  getLayout(renderer) {
    const view = renderer || this.app.renderer;
    const H = view.height;
    const compact = H <= 700;
    const playTop = view.topInset + 102;
    const inputH = compact ? 30 : 34;
    const btnH = compact ? 24 : 28;
    const gridGap = compact ? 6 : 8;
    const submitW = compact ? 92 : 98;
    const inputTop = 14;
    const inputGap = compact ? 8 : 10;
    const panelH = inputTop + inputH + inputGap + btnH * 4 + gridGap * 3 + 14;
    const panelY = H - view.bottomInset - panelH;
    const baseY = panelY - 88;
    const playfieldH = Math.max(180, baseY - playTop - 10);

    return {
      playTop,
      playfieldH,
      baseY,
      keypad: {
        compact,
        panelY,
        panelH,
        inputH,
        btnH,
        gridGap,
        submitW,
      },
    };
  }

  onEnter(params) {
    super.onEnter(params);
    this.gradeId = params.grade || this.app.profile.selectedGrade || "grade1";
    this.stars = this.buildStars();
    this.meteorSeq = 0;
    this.resetRound();
  }

  onExit() {
    this.persistGrade();
  }

  buildStars() {
    const W = this.app.renderer.width;
    const H = this.app.renderer.height;
    const stars = [];
    for (let i = 0; i < 42; i += 1) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.8 + 0.6,
        alpha: Math.random() * 0.6 + 0.2,
        speed: Math.random() * 3 + 2,
      });
    }
    return stars;
  }

  resetRound() {
    this.phase = "ready";
    this.elapsed = 0;
    this.score = 0;
    this.baseHp = BASE_MAX_HP;
    this.input = "";
    this.meteors = [];
    this.lasers = [];
    this.fragments = [];
    this.spawnTimer = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.totalCrits = 0;
    this.totalAnswers = 0;
    this.correctAnswers = 0;
    this.questionResults = [];
    this.flashTime = 0;
    this.shakeTime = 0;
    this.savedResult = null;
    this.isSettled = false;
  }

  persistGrade() {
    if (this.app.storage.setSelectedGrade) {
      this.app.profile = this.app.storage.setSelectedGrade(this.app.profile, this.gradeId);
    }
  }

  startGame() {
    this.persistGrade();
    this.resetRound();
    this.phase = "playing";
    this.roundStartAt = Date.now();
    this.baseY = this.getLayout(this.app.renderer).baseY;
  }

  difficultyState() {
    const pressure = clamp(this.elapsed / 60, 0, 1);
    const tier = 1 + Math.floor(this.elapsed / 18);
    return {
      tier,
      spawnInterval: lerp(1.55, 0.58, pressure),
      maxOnScreen: 3 + Math.min(4, Math.floor(this.elapsed / 15)),
      speedBase: lerp(42, 108, pressure) + Math.floor(this.elapsed / 14) * 6,
      radius: clamp(38 - Math.floor(this.elapsed / 20), 24, 38),
    };
  }

  buildMeteorTint() {
    const colors = [
      { fill: "#fecdd3", stroke: "#fb7185", crater: "#fda4af", text: "#4c0519" },
      { fill: "#fde68a", stroke: "#f59e0b", crater: "#fcd34d", text: "#422006" },
      { fill: "#bfdbfe", stroke: "#60a5fa", crater: "#93c5fd", text: "#172554" },
      { fill: "#ddd6fe", stroke: "#8b5cf6", crater: "#c4b5fd", text: "#2e1065" },
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  buildLaneCenters() {
    const W = this.app.renderer.width;
    const padding = 34;
    const laneCount = 4;
    const usableWidth = W - padding * 2;
    const step = usableWidth / (laneCount - 1);
    const lanes = [];
    for (let i = 0; i < laneCount; i += 1) {
      lanes.push(padding + step * i);
    }
    return lanes;
  }

  pickMeteorX(radius) {
    const lanes = this.buildLaneCenters();
    const candidates = lanes
      .map((x) => {
        let congestion = 0;
        this.meteors.forEach((meteor) => {
          const dx = Math.abs(meteor.x - x);
          if (dx < radius * 1.8) {
            congestion += Math.max(0, 180 - meteor.y);
          }
        });
        return { x, congestion };
      })
      .sort((a, b) => a.congestion - b.congestion);
    return candidates[0].x + randOffset(radius * 0.28);
  }

  spawnMeteor() {
    const difficulty = this.difficultyState();
    if (this.meteors.length >= difficulty.maxOnScreen) {
      return;
    }

    const question = generateQuestion({
      mode: "meteor",
      difficulty: "advanced",
      grade: this.gradeId,
      tier: difficulty.tier,
      index: this.meteorSeq,
    });

    const radius = difficulty.radius + randOffset(3);
    const meteor = new Meteor({
      id: `meteor_${this.meteorSeq}`,
      question,
      x: this.pickMeteorX(radius),
      y: -radius - 12,
      radius,
      speedY: difficulty.speedBase + Math.random() * 14,
      driftX: randOffset(16),
      wobbleAmp: 10 + Math.random() * 14,
      wobbleFreq: 2 + Math.random() * 2.6,
      phase: Math.random() * Math.PI * 2,
      spawnedAt: Date.now(),
      tint: this.buildMeteorTint(),
    });

    this.meteors.push(meteor);
    this.meteorSeq += 1;
  }

  update(dt) {
    this.updateStars(dt);
    this.updateEffects(dt);

    if (this.phase !== "playing") {
      return;
    }

    this.elapsed += dt;
    this.spawnTimer += dt;
    const difficulty = this.difficultyState();

    while (this.spawnTimer >= difficulty.spawnInterval) {
      this.spawnTimer -= difficulty.spawnInterval;
      this.spawnMeteor();
    }

    const survivors = [];
    for (let i = 0; i < this.meteors.length; i += 1) {
      const meteor = this.meteors[i];
      meteor.update(dt);
      if (meteor.isAtBase(this.baseY)) {
        this.handleMeteorImpact(meteor);
        continue;
      }
      survivors.push(meteor);
    }
    this.meteors = survivors;

    if (this.baseHp <= 0) {
      this.finishRound();
    }
  }

  updateStars(dt) {
    const H = this.app.renderer.height;
    this.stars.forEach((star) => {
      star.y += star.speed * dt;
      if (star.y > H) {
        star.y = -4;
      }
    });
  }

  updateEffects(dt) {
    this.flashTime = Math.max(0, this.flashTime - dt);
    this.shakeTime = Math.max(0, this.shakeTime - dt);

    this.lasers = this.lasers
      .map((laser) => ({
        ...laser,
        life: laser.life - dt,
      }))
      .filter((laser) => laser.life > 0);

    this.fragments = this.fragments
      .map((fragment) => ({
        ...fragment,
        x: fragment.x + fragment.vx * dt,
        y: fragment.y + fragment.vy * dt,
        vy: fragment.vy + 24 * dt,
        life: fragment.life - dt,
      }))
      .filter((fragment) => fragment.life > 0);
  }

  handleMeteorImpact(meteor) {
    this.baseHp = Math.max(0, this.baseHp - 1);
    this.combo = 0;
    this.flashTime = 0.22;
    this.shakeTime = 0.18;
    this.createExplosion(meteor.x, this.baseY - 6, "#fb7185");

    this.totalAnswers += 1;
    this.questionResults.push({
      ...meteor.question,
      userAnswer: null,
      status: "timeout",
      answerMs: Date.now() - meteor.spawnedAt,
    });

    if (wx.vibrateShort) {
      wx.vibrateShort({ type: "medium" });
    }
  }

  getLauncherPoint() {
    const layout = this.getLayout(this.app.renderer);
    const W = this.app.renderer.width;
    return {
      x: W / 2,
      y: layout.baseY + 44,
    };
  }

  getFocusMeteor() {
    if (!this.meteors.length) {
      return null;
    }
    return this.meteors
      .slice()
      .sort((a, b) => b.y - a.y || a.spawnedAt - b.spawnedAt)[0];
  }

  findMatchedMeteor(answer) {
    return this.meteors
      .filter((meteor) => meteor.answer === answer)
      .sort((a, b) => b.y - a.y || a.spawnedAt - b.spawnedAt)[0];
  }

  submitInput() {
    if (this.phase !== "playing") {
      return;
    }
    if (!this.input) {
      return;
    }

    const answer = Number(this.input);
    this.input = "";

    const target = this.findMatchedMeteor(answer);
    if (target) {
      this.handleCorrectAnswer(target, answer);
      return;
    }
    this.handleWrongAnswer(answer);
  }

  handleCorrectAnswer(meteor, answer) {
    this.totalAnswers += 1;
    this.correctAnswers += 1;
    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);

    const comboBonus = Math.max(0, (this.combo - 1) * 2);
    const crit = this.combo >= 5 && Math.random() < 0.2;
    if (crit) {
      this.totalCrits += 1;
    }
    const gain = 10 + comboBonus + (crit ? 8 : 0);
    this.score += gain;

    this.questionResults.push({
      ...meteor.question,
      userAnswer: answer,
      status: "correct",
      answerMs: Date.now() - meteor.spawnedAt,
    });

    this.createLaser(meteor, crit);
    this.createExplosion(meteor.x, meteor.y, crit ? "#fde68a" : "#93c5fd");
    this.meteors = this.meteors.filter((item) => item.id !== meteor.id);

    if (wx.vibrateShort) {
      wx.vibrateShort({ type: crit ? "heavy" : "light" });
    }
  }

  handleWrongAnswer(answer) {
    this.totalAnswers += 1;
    const focus = this.getFocusMeteor();
    if (focus) {
      this.questionResults.push({
        ...focus.question,
        userAnswer: answer,
        status: "wrong",
        answerMs: Date.now() - focus.spawnedAt,
      });
    }
    this.combo = 0;
    this.flashTime = 0.16;
    this.shakeTime = 0.14;

    if (wx.vibrateShort) {
      wx.vibrateShort({ type: "medium" });
    }
  }

  createLaser(meteor, crit) {
    const start = this.getLauncherPoint();
    this.lasers.push({
      fromX: start.x,
      fromY: start.y,
      toX: meteor.x,
      toY: meteor.y,
      life: crit ? 0.2 : 0.14,
      maxLife: crit ? 0.2 : 0.14,
      color: crit ? "#fde68a" : "#93c5fd",
    });
  }

  createExplosion(x, y, color) {
    for (let i = 0; i < 10; i += 1) {
      this.fragments.push({
        x,
        y,
        vx: randOffset(84),
        vy: randOffset(84),
        radius: Math.random() * 3 + 1.5,
        life: Math.random() * 0.45 + 0.2,
        color,
      });
    }
  }

  finishRound() {
    if (this.isSettled) {
      return;
    }
    this.isSettled = true;
    this.phase = "gameover";

    const coins = Math.max(3, Math.round(this.score / 12));
    const studyExp = Math.max(1, Math.round(this.correctAnswers * 1.4));
    const elapsedMs = Math.round(this.elapsed * 1000);
    const session = {
      mode: "meteor",
      difficulty: "advanced",
      level: 1,
      gradeId: this.gradeId,
      coins,
      studyExp,
      correctCount: this.correctAnswers,
      totalCount: this.totalAnswers,
      elapsedMs,
      meteorScore: this.score,
      comboBest: this.bestCombo,
      critCount: this.totalCrits,
      questionResults: this.questionResults,
    };
    const update = this.app.storage.applySession(this.app.profile, session);
    this.app.profile = update.profile;
    this.savedResult = {
      coins,
      studyExp,
      accuracy: this.totalAnswers ? Math.round((this.correctAnswers / this.totalAnswers) * 100) : 0,
    };
  }

  onPadKey(key) {
    if (this.phase !== "playing") {
      return;
    }
    if (key === "clear") {
      this.input = "";
      return;
    }
    if (key === "delete") {
      this.input = this.input.slice(0, -1);
      return;
    }
    if (this.input.length >= 4) {
      return;
    }
    this.input += key;
  }

  render(renderer) {
    this.resetButtons();
    const W = renderer.width;
    const H = renderer.height;
    const ctx = renderer.ctx;
    const shakeX = this.shakeTime > 0 ? randOffset(4) : 0;
    const shakeY = this.shakeTime > 0 ? randOffset(2) : 0;

    ctx.save();
    ctx.translate(shakeX, shakeY);
    this.drawBackground(renderer, W, H);
    this.drawHeader(renderer, W);
    this.drawPlayfield(renderer, W, H);
    this.drawBase(renderer, W, H);
    this.drawKeypad(renderer, W, H);

    if (this.phase === "ready") {
      this.drawReadyOverlay(renderer, W, H);
    }
    if (this.phase === "gameover") {
      this.drawGameOverOverlay(renderer, W, H);
    }

    if (this.flashTime > 0) {
      ctx.fillStyle = `rgba(248, 113, 113, ${this.flashTime * 0.55})`;
      ctx.fillRect(-12, -12, W + 24, H + 24);
    }
    ctx.restore();
  }

  drawBackground(renderer, W, H) {
    const ctx = renderer.ctx;
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, "#0f172a");
    gradient.addColorStop(0.55, "#13203f");
    gradient.addColorStop(1, "#1d4b6e");
    renderer.clear("#0f172a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.8)";
    this.stars.forEach((star) => {
      ctx.globalAlpha = star.alpha;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.fillStyle = "rgba(168, 85, 247, 0.08)";
    ctx.beginPath();
    ctx.arc(W - 34, 96, 92, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(56, 189, 248, 0.12)";
    ctx.beginPath();
    ctx.arc(52, 168, 68, 0, Math.PI * 2);
    ctx.fill();
  }

  drawHeader(renderer, W) {
    const top = renderer.topInset;
    renderer.panel(16, top, W - 32, 92, {
      fill: "rgba(255,255,255,0.92)",
      radius: 18,
      shadow: "rgba(15,23,42,0.22)",
    });
    renderer.text(MODE_NAME, 30, top + 30, {
      size: 26,
      weight: "700",
      color: "#111827",
    });
    renderer.text(GRADE_PROFILES[this.gradeId].name, 30, top + 58, {
      size: 14,
      color: "#475569",
    });
    renderer.text(`Score ${this.score}`, W - 28, top + 28, {
      size: 22,
      weight: "700",
      align: "right",
      color: "#0f766e",
    });
    renderer.text(`Time ${Math.floor(this.elapsed)}s`, W - 28, top + 56, {
      size: 14,
      align: "right",
      color: "#64748b",
    });

    const backRect = { x: W - 112, y: top + 6, w: 84, h: 30 };
    renderer.button(backRect, "\u8fd4\u56de", {
      fill: "#e2e8f0",
      color: "#334155",
      fontSize: 14,
      radius: 10,
    });
    this.registerButton(backRect, () => {
      this.app.switchScene("menu");
    });
  }

  drawPlayfield(renderer, W, H) {
    const ctx = renderer.ctx;
    const layout = this.getLayout(renderer);
    const top = layout.playTop;
    const fieldH = layout.playfieldH;

    renderer.panel(16, top, W - 32, fieldH, {
      fill: "rgba(255,255,255,0.08)",
      border: "rgba(255,255,255,0.14)",
      borderWidth: 1,
      radius: 18,
      shadow: "",
    });

    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i += 1) {
      const x = 16 + ((W - 32) / 5) * i;
      ctx.beginPath();
      ctx.moveTo(x, top + 10);
      ctx.lineTo(x, top + fieldH - 10);
      ctx.stroke();
    }

    this.drawLasers(renderer);
    this.meteors.forEach((meteor) => meteor.render(renderer));
    this.drawFragments(renderer);
    this.drawComboHalo(renderer, W, H);
  }

  drawLasers(renderer) {
    const ctx = renderer.ctx;
    this.lasers.forEach((laser) => {
      const alpha = clamp(laser.life / laser.maxLife, 0, 1);
      ctx.strokeStyle = laser.color;
      ctx.lineWidth = 3 + alpha * 4;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(laser.fromX, laser.fromY);
      ctx.lineTo(laser.toX, laser.toY);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
  }

  drawFragments(renderer) {
    const ctx = renderer.ctx;
    this.fragments.forEach((fragment) => {
      ctx.globalAlpha = clamp(fragment.life * 1.8, 0, 1);
      ctx.fillStyle = fragment.color;
      ctx.beginPath();
      ctx.arc(fragment.x, fragment.y, fragment.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  drawComboHalo(renderer, W, H) {
    if (this.combo < 3) {
      return;
    }
    const ctx = renderer.ctx;
    const alpha = clamp((this.combo - 2) * 0.08, 0, 0.28);
    ctx.strokeStyle = `rgba(251, 191, 36, ${alpha})`;
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, W - 16, H - 16);

    renderer.text(`COMBO x${this.combo}`, W / 2, 140, {
      size: this.combo >= 5 ? 24 : 20,
      weight: "700",
      align: "center",
      color: this.combo >= 5 ? "#fde68a" : "#fef3c7",
    });
  }

  drawBase(renderer, W, H) {
    const ctx = renderer.ctx;
    const layout = this.getLayout(renderer);
    const baseY = layout.baseY;
    const launcher = this.getLauncherPoint();

    ctx.fillStyle = "rgba(15, 23, 42, 0.42)";
    ctx.fillRect(16, baseY, W - 32, 8);
    renderer.panel(18, baseY + 10, W - 36, 66, {
      fill: "rgba(15,23,42,0.55)",
      border: "rgba(255,255,255,0.08)",
      borderWidth: 1,
      radius: 16,
      shadow: "",
    });

    renderer.text("\u57fa\u5730\u62a4\u76fe", 30, baseY + 36, {
      size: 16,
      weight: "700",
      color: "#f8fafc",
    });
    renderer.text(this.buildHpLabel(), 30, baseY + 60, {
      size: 16,
      color: "#fef08a",
    });
    renderer.text(`Hits ${this.correctAnswers}`, W - 30, baseY + 36, {
      size: 16,
      weight: "700",
      align: "right",
      color: "#bfdbfe",
    });
    renderer.text(`Best Combo ${this.bestCombo}`, W - 30, baseY + 60, {
      size: 14,
      align: "right",
      color: "#cbd5e1",
    });

    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.moveTo(launcher.x - 18, launcher.y + 18);
    ctx.lineTo(launcher.x + 18, launcher.y + 18);
    ctx.lineTo(launcher.x, launcher.y - 16);
    ctx.closePath();
    ctx.fill();
  }

  buildHpLabel() {
    let text = "";
    for (let i = 0; i < BASE_MAX_HP; i += 1) {
      text += i < this.baseHp ? "\u25cf " : "\u25cb ";
    }
    return text.trim();
  }

  drawKeypad(renderer, W, H) {
    if (this.phase !== "playing") {
      return;
    }

    const layout = this.getLayout(renderer);
    const panelY = layout.keypad.panelY;
    const panelH = layout.keypad.panelH;
    renderer.panel(16, panelY, W - 32, panelH, {
      fill: "rgba(255,255,255,0.95)",
      radius: 22,
      shadow: "rgba(15,23,42,0.25)",
    });

    renderer.panel(28, panelY + 14, W - 56, layout.keypad.inputH, {
      fill: "#eff6ff",
      border: "#bfdbfe",
      borderWidth: 1.5,
      radius: 12,
      shadow: "",
    });
    renderer.text(this.input || "\u8f93\u5165\u7b54\u6848", W / 2, panelY + 14 + layout.keypad.inputH / 2 + 1, {
      size: layout.keypad.compact ? 20 : 22,
      weight: "700",
      align: "center",
      baseline: "middle",
      color: this.input ? "#111827" : "#94a3b8",
    });

    const rows = [
      ["1", "2", "3"],
      ["4", "5", "6"],
      ["7", "8", "9"],
      ["clear", "0", "delete"],
    ];
    const startY = panelY + 14 + layout.keypad.inputH + (layout.keypad.compact ? 8 : 10);
    const gap = layout.keypad.gridGap;
    const submitW = layout.keypad.submitW;
    const btnW = (W - 52 - gap * 3 - submitW) / 3;
    const btnH = layout.keypad.btnH;

    rows.forEach((row, rowIndex) => {
      row.forEach((key, colIndex) => {
        const x = 28 + colIndex * (btnW + gap);
        const y = startY + rowIndex * (btnH + gap);
        const rect = { x, y, w: btnW, h: btnH };
        renderer.button(rect, this.padLabel(key), {
          fill: "#ffffff",
          color: "#111827",
          border: "#dbe4ea",
          radius: 10,
          fontSize: layout.keypad.compact ? 13 : 14,
          disabled: this.phase !== "playing",
        });
        this.registerButton(rect, () => this.onPadKey(key), this.phase !== "playing");
      });
    });

    const submitRect = { x: W - 28 - submitW, y: startY, w: submitW, h: btnH * 4 + gap * 3 };
    renderer.button(submitRect, "\u53d1\u5c04", {
      fill: this.phase === "playing" ? "#2563eb" : "#cbd5e1",
      color: "#ffffff",
      radius: 16,
      fontSize: 18,
      disabled: this.phase !== "playing",
    });
    this.registerButton(submitRect, () => this.submitInput(), this.phase !== "playing");
  }

  padLabel(key) {
    if (key === "clear") {
      return "\u6e05\u7a7a";
    }
    if (key === "delete") {
      return "\u5220\u9664";
    }
    return key;
  }

  drawReadyOverlay(renderer, W, H) {
    const top = renderer.topInset + 152;
    renderer.panel(34, top, W - 68, 280, {
      fill: "rgba(255,255,255,0.96)",
      radius: 22,
      shadow: "rgba(15,23,42,0.25)",
    });
    renderer.text("\u4fdd\u536b\u5fc3\u7b97\u661f\u7403", W / 2, top + 44, {
      size: 28,
      weight: "700",
      align: "center",
      color: "#111827",
    });
    renderer.text("\u8ba1\u7b97\u51fa\u9668\u77f3\u7b54\u6848\uff0c\u7528\u6fc0\u5149\u51fb\u788e\u5b83\u4eec", W / 2, top + 76, {
      size: 15,
      align: "center",
      color: "#475569",
    });
    renderer.text("\u9668\u77f3\u89e6\u5e95\u4f1a\u6263\u57fa\u5730\u8840\u91cf\uff0c\u6bd4\u62fc\u5b58\u6d3b\u4e0e\u53cd\u5e94", W / 2, top + 98, {
      size: 15,
      align: "center",
      color: "#475569",
    });

    renderer.text("\u9009\u62e9\u5e74\u7ea7\u9898\u7eb2", 54, top + 140, {
      size: 16,
      weight: "700",
      color: "#111827",
    });

    const chipY = top + 154;
    const chipW = (W - 132) / 3;
    GRADE_ORDER.forEach((gradeId, index) => {
      const rect = { x: 50 + index * (chipW + 8), y: chipY, w: chipW, h: 38 };
      const active = this.gradeId === gradeId;
      renderer.button(rect, GRADE_PROFILES[gradeId].name, {
        fill: active ? "#1d4ed8" : "#eff6ff",
        color: active ? "#fff" : "#1e3a8a",
        radius: 12,
        fontSize: 14,
      });
      this.registerButton(rect, () => {
        this.gradeId = gradeId;
      });
    });

    renderer.text(GRADE_PROFILES[this.gradeId].desc, W / 2, top + 216, {
      size: 15,
      align: "center",
      color: "#64748b",
    });

    const startRect = { x: 56, y: top + 240, w: W - 112, h: 48 };
    renderer.button(startRect, "\u5f00\u59cb\u5854\u9632", {
      fill: "#2563eb",
      color: "#fff",
      fontSize: 18,
      radius: 14,
    });
    this.registerButton(startRect, () => this.startGame());
  }

  drawGameOverOverlay(renderer, W, H) {
    const top = renderer.topInset + 154;
    renderer.panel(34, top, W - 68, 266, {
      fill: "rgba(15,23,42,0.92)",
      radius: 22,
      shadow: "rgba(15,23,42,0.25)",
    });
    renderer.text("\u57fa\u5730\u5931\u5b88", W / 2, top + 44, {
      size: 28,
      weight: "700",
      align: "center",
      color: "#f8fafc",
    });
    renderer.text(`Score ${this.score}`, W / 2, top + 76, {
      size: 24,
      weight: "700",
      align: "center",
      color: "#fde68a",
    });
    renderer.text(
      `\u7b54\u5bf9 ${this.correctAnswers} / ${this.totalAnswers}  |  Combo ${this.bestCombo}`,
      W / 2,
      top + 106,
      {
        size: 15,
        align: "center",
        color: "#cbd5e1",
      }
    );

    if (this.savedResult) {
      renderer.text(
        `+\u91d1\u5e01 ${this.savedResult.coins}   +\u5b66\u4e60\u503c ${this.savedResult.studyExp}`,
        W / 2,
        top + 136,
        {
          size: 16,
          align: "center",
          color: "#86efac",
        }
      );
      renderer.text(
        `\u672c\u5c40\u6b63\u786e\u7387 ${this.savedResult.accuracy}%`,
        W / 2,
        top + 162,
        {
          size: 15,
          align: "center",
          color: "#bfdbfe",
        }
      );
    }

    const restartRect = { x: 56, y: top + 194, w: W - 112, h: 46 };
    renderer.button(restartRect, "\u518d\u6765\u4e00\u5c40", {
      fill: "#2563eb",
      color: "#fff",
      fontSize: 18,
      radius: 14,
    });
    this.registerButton(restartRect, () => this.startGame());
  }
}

function randOffset(amount) {
  return (Math.random() * 2 - 1) * amount;
}

module.exports = MeteorScene;
