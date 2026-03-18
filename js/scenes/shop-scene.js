const BaseScene = require("../runtime/base-scene");
const {
  GACHA_CONFIG,
  ITEM_DEFS,
  PET_DEFS,
  SKIN_DEFS,
  getPetShardNeed,
  getSkinShardNeed,
} = require("../domain/rules");

const TAB_ORDER = ["items", "gacha", "skins", "pets"];
const TAB_LABEL = {
  items: "\u9053\u5177",
  gacha: "\u76f2\u76d2",
  skins: "\u76ae\u80a4",
  pets: "\u840c\u5ba0",
};

function rarityColor(rarity) {
  if (rarity === "epic") {
    return "#7c3aed";
  }
  if (rarity === "rare") {
    return "#2563eb";
  }
  if (rarity === "starter") {
    return "#059669";
  }
  return "#475569";
}

function itemList() {
  return Object.keys(ITEM_DEFS).map((id) => ITEM_DEFS[id]);
}

function skinList() {
  return Object.keys(SKIN_DEFS).map((id) => SKIN_DEFS[id]);
}

function petList() {
  return Object.keys(PET_DEFS).map((id) => PET_DEFS[id]);
}

function totalClears(profile) {
  const clears = (profile && profile.clearedLevels) || {};
  return Number(clears.beginner || 0) + Number(clears.advanced || 0) + Number(clears.challenge || 0);
}

function rewardLabel(reward) {
  if (!reward) {
    return "\u795e\u79d8\u5956\u52b1";
  }
  if (reward.label) {
    return reward.label;
  }
  if (reward.type === "item" && ITEM_DEFS[reward.id]) {
    return ITEM_DEFS[reward.id].name;
  }
  if ((reward.type === "skin" || reward.type === "skin_shard") && SKIN_DEFS[reward.id]) {
    return SKIN_DEFS[reward.id].name;
  }
  if (reward.type === "pet_shard" && PET_DEFS[reward.id]) {
    return PET_DEFS[reward.id].name;
  }
  return "\u795e\u79d8\u5956\u52b1";
}

function rewardTargetTab(reward) {
  if (!reward) {
    return "items";
  }
  if (reward.type === "item") {
    return "items";
  }
  if (reward.type === "pet_shard") {
    return "pets";
  }
  return "skins";
}

function rewardActionLabel(reward) {
  const tab = rewardTargetTab(reward);
  if (tab === "items") {
    return "\u53bb\u770b\u9053\u5177";
  }
  if (tab === "pets") {
    return "\u53bb\u770b\u840c\u5ba0";
  }
  return "\u53bb\u770b\u76ae\u80a4";
}

class ShopScene extends BaseScene {
  onEnter(params) {
    super.onEnter(params);
    this.tab = (params && params.tab) || "items";
    this.notice = "";
    this.noticeTime = 0;
    this.pendingReward = null;
    this.revealReward = null;
    this.gachaTime = 0;
    this.gachaTicker = 0;
    this.gachaPreview = 0;
    this.refresh();
  }

  refresh() {
    this.profile = this.app.profile;
  }

  update(dt) {
    this.noticeTime = Math.max(0, this.noticeTime - dt);
    if (this.gachaTime > 0) {
      this.gachaTime = Math.max(0, this.gachaTime - dt);
      this.gachaTicker -= dt;
      if (this.gachaTicker <= 0) {
        this.gachaTicker = 0.08;
        this.gachaPreview = (this.gachaPreview + 1) % GACHA_CONFIG.rewards.length;
      }
      if (this.gachaTime <= 0 && this.pendingReward) {
        this.revealReward = this.pendingReward;
        this.pendingReward = null;
        this.notice = `\u606d\u559c\u83b7\u5f97 ${rewardLabel(this.revealReward)}`;
        this.noticeTime = 2.4;
      }
    }
  }

  render(renderer) {
    this.resetButtons();
    const W = renderer.width;
    const H = renderer.height;
    const top = renderer.topInset;

    this.drawBackground(renderer, W, H);
    this.drawHeader(renderer, W, top);
    this.drawTabs(renderer, W, top + 126);

    if (this.tab === "items") {
      this.drawItems(renderer, W, H, top + 192);
    } else if (this.tab === "gacha") {
      this.drawGacha(renderer, W, H, top + 192);
    } else if (this.tab === "skins") {
      this.drawSkins(renderer, W, H, top + 192);
    } else {
      this.drawPets(renderer, W, H, top + 192);
    }

    if (this.noticeTime > 0 && this.notice) {
      renderer.text(this.notice, W / 2, H - renderer.bottomInset - 92, {
        size: 14,
        align: "center",
        color: "#1d4ed8",
        weight: "700",
      });
    }
    if (this.revealReward) {
      this.drawRewardModal(renderer, W, H);
    }
  }

  drawBackground(renderer, W, H) {
    const ctx = renderer.ctx;
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, "#fff7ed");
    gradient.addColorStop(1, "#eff6ff");
    renderer.clear("#f8fafc");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(251, 191, 36, 0.14)";
    ctx.beginPath();
    ctx.arc(W - 36, 98, 88, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(96, 165, 250, 0.12)";
    ctx.beginPath();
    ctx.arc(44, H - 120, 106, 0, Math.PI * 2);
    ctx.fill();
  }

  drawHeader(renderer, W, y) {
    const equippedSkin = SKIN_DEFS[(this.profile.skins && this.profile.skins.equipped) || "skin_basic"] || SKIN_DEFS.skin_basic;
    const equippedPet = PET_DEFS[(this.profile.pets && this.profile.pets.equipped) || "pet_memory_sprite"] || PET_DEFS.pet_memory_sprite;
    renderer.panel(16, y, W - 32, 112, {
      fill: "rgba(255,255,255,0.96)",
      radius: 20,
      shadow: "rgba(15,23,42,0.12)",
    });
    renderer.text("\u5546\u5e97\u4e0e\u88c5\u626e", 28, y + 32, {
      size: 28,
      weight: "700",
      color: "#111827",
    });
    renderer.text("\u7528\u91d1\u5e01\u5151\u6362\u6210\u957f\u76ee\u6807\uff0c\u8ba9\u7ec3\u4e60\u66f4\u6709\u671f\u5f85", 28, y + 60, {
      size: 14,
      color: "#64748b",
    });
    renderer.text(`\u91d1\u5e01 ${this.profile.coins || 0}`, W - 28, y + 32, {
      size: 17,
      align: "right",
      color: "#0f766e",
      weight: "700",
    });
    renderer.text(`\u94bb\u77f3 ${this.profile.gems || 0}`, W - 28, y + 60, {
      size: 14,
      align: "right",
      color: "#7c3aed",
    });
    renderer.text(`\u4e3b\u9898 ${equippedSkin.name}`, 28, y + 82, {
      size: 12,
      color: "#2563eb",
      weight: "700",
    });
    renderer.text(`\u840c\u5ba0 ${equippedPet.name}`, W - 28, y + 82, {
      size: 12,
      align: "right",
      color: "#059669",
      weight: "700",
    });

    const backRect = { x: W - 112, y: y + 10, w: 84, h: 30 };
    renderer.button(backRect, "\u8fd4\u56de", {
      fill: "#ffffff",
      color: "#334155",
      border: "#cbd5e1",
      radius: 10,
      fontSize: 14,
    });
    this.registerButton(backRect, () => this.app.switchScene("menu"));
  }

  drawTabs(renderer, W, y) {
    renderer.panel(16, y, W - 32, 52, {
      fill: "rgba(255,255,255,0.96)",
      radius: 16,
      shadow: "rgba(15,23,42,0.08)",
    });
    const gap = 8;
    const chipW = (W - 32 - 12 - gap * 3) / 4;
    TAB_ORDER.forEach((key, index) => {
      const rect = {
        x: 22 + index * (chipW + gap),
        y: y + 6,
        w: chipW,
        h: 40,
      };
      renderer.button(rect, TAB_LABEL[key], {
        fill: this.tab === key ? "#2563eb" : "#eff6ff",
        color: this.tab === key ? "#fff" : "#1e3a8a",
        radius: 10,
        fontSize: 14,
      });
      this.registerButton(rect, () => {
        this.tab = key;
      });
    });
  }

  drawItems(renderer, W, H, top) {
    const cards = itemList();
    const clears = totalClears(this.profile);
    cards.forEach((item, index) => {
      const y = top + index * 102;
      const unlocked = clears >= Number(item.unlockClears || 0);
      renderer.panel(16, y, W - 32, 90, {
        fill: "rgba(255,255,255,0.96)",
        radius: 18,
        shadow: "rgba(15,23,42,0.08)",
      });
      renderer.panel(28, y + 18, 48, 48, {
        fill: "#ecfeff",
        radius: 16,
        shadow: "",
      });
      renderer.text(item.name, 90, y + 34, {
        size: 20,
        weight: "700",
        color: "#111827",
      });
      renderer.textWrap(item.desc, 90, y + 58, W - 220, 16, {
        size: 13,
        color: "#64748b",
      });
      renderer.text(
        unlocked
          ? `\u62e5\u6709 ${this.profile.inventory[item.id] || 0}`
          : `\u9700\u7d2f\u8ba1\u901a\u5173 ${item.unlockClears} \u5173`,
        90,
        y + 78,
        {
          size: 13,
          color: unlocked ? "#0f766e" : "#b45309",
          weight: "700",
        }
      );
      const buyRect = { x: W - 112, y: y + 24, w: 84, h: 36 };
      renderer.button(buyRect, unlocked ? `${item.priceCoins}\u91d1\u5e01` : "\u672a\u89e3\u9501", {
        fill: unlocked ? "#2563eb" : "#f8fafc",
        color: unlocked ? "#fff" : "#94a3b8",
        border: unlocked ? "" : "#e5e7eb",
        radius: 10,
        fontSize: 13,
        disabled: !unlocked || (this.profile.coins || 0) < item.priceCoins,
      });
      this.registerButton(
        buyRect,
        () => this.buyItem(item.id),
        !unlocked || (this.profile.coins || 0) < item.priceCoins
      );
    });

    renderer.textWrap("\u95ef\u5173\u4e0e\u6bcf\u65e5\u6a21\u5f0f\u53ef\u4f7f\u7528\u9053\u5177\uff0c\u597d\u53cb\u5bf9\u6218\u4e0e\u5854\u9632\u6a21\u5f0f\u7981\u7528", 20, H - renderer.bottomInset - 18, W - 40, 16, {
      size: 12,
      color: "#64748b",
    });
  }

  drawGacha(renderer, W, H, top) {
    renderer.panel(16, top, W - 32, H - top - renderer.bottomInset - 30, {
      fill: "rgba(255,255,255,0.96)",
      radius: 20,
      shadow: "rgba(15,23,42,0.08)",
    });
    renderer.text("\u5f69\u8679\u76f2\u76d2\u673a", W / 2, top + 36, {
      size: 26,
      align: "center",
      weight: "700",
      color: "#111827",
    });
    renderer.text(`\u6bcf\u6b21 ${GACHA_CONFIG.costCoins} \u91d1\u5e01\uff0c\u53ef\u80fd\u83b7\u5f97\u9053\u5177 / \u76ae\u80a4 / \u840c\u5ba0\u788e\u7247`, W / 2, top + 62, {
      size: 13,
      align: "center",
      color: "#64748b",
    });
    renderer.text(`\u5f53\u524d\u53ef\u62bd ${Math.floor((this.profile.coins || 0) / GACHA_CONFIG.costCoins)} \u6b21`, W / 2, top + 82, {
      size: 13,
      align: "center",
      color: "#b45309",
      weight: "700",
    });

    renderer.panel(W / 2 - 92, top + 96, 184, 144, {
      fill: "#eff6ff",
      radius: 22,
      shadow: "",
    });
    renderer.panel(W / 2 - 74, top + 114, 148, 92, {
      fill: "#ffffff",
      radius: 18,
      shadow: "",
    });

    const previewReward =
      this.gachaTime > 0 ? GACHA_CONFIG.rewards[this.gachaPreview] : this.revealReward || GACHA_CONFIG.rewards[0];
    renderer.text(this.gachaTime > 0 ? "\u62bd\u53d6\u4e2d..." : "\u672c\u6b21\u5956\u6c60\u805a\u7126", W / 2, top + 138, {
      size: 14,
      align: "center",
      color: "#64748b",
    });
    renderer.text(rewardLabel(previewReward), W / 2, top + 174, {
      size: 22,
      align: "center",
      weight: "700",
      color: "#2563eb",
    });
    renderer.text(this.gachaTime > 0 ? "\u661f\u5149\u6b63\u5728\u51dd\u805a..." : "\u70b9\u51fb\u4e0b\u65b9\u6309\u94ae\u5f00\u76d2", W / 2, top + 206, {
      size: 13,
      align: "center",
      color: "#64748b",
    });

    if ((this.profile.coins || 0) < GACHA_CONFIG.costCoins) {
      const earnRect = { x: 24, y: H - renderer.bottomInset - 106, w: W - 48, h: 38 };
      renderer.button(earnRect, "\u53bb\u95ef\u5173\u8d5a\u91d1\u5e01", {
        fill: "#ffffff",
        color: "#1d4ed8",
        border: "#bfdbfe",
        radius: 12,
        fontSize: 15,
      });
      this.registerButton(earnRect, () => this.app.switchScene("gate"));
    }

    const drawRect = { x: 24, y: H - renderer.bottomInset - 54, w: W - 48, h: 48 };
    renderer.button(drawRect, `\u62bd\u4e00\u6b21  ${GACHA_CONFIG.costCoins} \u91d1\u5e01`, {
      fill: "#2563eb",
      color: "#fff",
      radius: 14,
      fontSize: 18,
      disabled: this.gachaTime > 0 || (this.profile.coins || 0) < GACHA_CONFIG.costCoins,
    });
    this.registerButton(
      drawRect,
      () => this.startGacha(),
      this.gachaTime > 0 || (this.profile.coins || 0) < GACHA_CONFIG.costCoins
    );
  }

  drawSkins(renderer, W, H, top) {
    const cards = skinList();
    cards.forEach((skin, index) => {
      const y = top + index * 124;
      const style = skin.cardStyle;
      const owned = (this.profile.skins.owned || []).indexOf(skin.id) >= 0;
      const equipped = this.profile.skins.equipped === skin.id;
      const shards = (this.profile.skins.shards && this.profile.skins.shards[skin.id]) || 0;
      const need = getSkinShardNeed(skin.id);

      renderer.panel(16, y, W - 32, 112, {
        fill: "rgba(255,255,255,0.96)",
        radius: 18,
        shadow: "rgba(15,23,42,0.08)",
      });
      this.drawSkinSample(renderer, 28, y + 18, 78, 70, style);
      renderer.text(skin.name, 118, y + 34, {
        size: 20,
        weight: "700",
        color: "#111827",
      });
      renderer.text(skin.rarity.toUpperCase(), 118, y + 56, {
        size: 12,
        color: rarityColor(skin.rarity),
        weight: "700",
      });
      renderer.text(owned ? "\u5df2\u62e5\u6709\uff0c\u53ef\u4f5c\u4e3a\u9898\u5361\u4e3b\u9898" : `\u788e\u7247 ${shards}/${need}`, 118, y + 78, {
        size: 13,
        color: "#64748b",
      });
      if (!owned && need > 0) {
        renderer.progress({ x: 118, y: y + 88, w: W - 258, h: 8 }, shards / need, {
          fill: style.accent,
          bgFill: "#e5e7eb",
          minFill: 0,
        });
        renderer.text(`${Math.min(shards, need)}/${need}`, W - 118, y + 96, {
          size: 12,
          align: "right",
          color: "#64748b",
        });
      }
      const equipRect = { x: W - 108, y: y + 34, w: 80, h: 34 };
      renderer.button(equipRect, equipped ? "\u4f7f\u7528\u4e2d" : owned ? "\u4f69\u6234" : "\u672a\u89e3\u9501", {
        fill: equipped ? "#dcfce7" : "#ffffff",
        color: equipped ? "#166534" : owned ? "#1d4ed8" : "#94a3b8",
        border: equipped ? "#bbf7d0" : "#cbd5e1",
        radius: 10,
        fontSize: 13,
        disabled: !owned || equipped,
      });
      this.registerButton(equipRect, () => this.selectSkin(skin.id), !owned || equipped);
    });
  }

  drawPets(renderer, W, H, top) {
    const cards = petList();
    cards.forEach((pet, index) => {
      const y = top + index * 122;
      const petState = (this.profile.pets && this.profile.pets.owned && this.profile.pets.owned[pet.id]) || null;
      const owned = !!(petState && petState.level);
      const equipped = this.profile.pets && this.profile.pets.equipped === pet.id;
      const shards = petState ? Number(petState.shards || 0) : 0;
      const need = getPetShardNeed(pet.id);

      renderer.panel(16, y, W - 32, 110, {
        fill: "rgba(255,255,255,0.96)",
        radius: 18,
        shadow: "rgba(15,23,42,0.08)",
      });
      this.drawPetBadge(renderer, 30, y + 24, 52, pet.color);
      renderer.text(pet.name, 96, y + 34, {
        size: 19,
        weight: "700",
        color: "#111827",
      });
      renderer.textWrap(pet.desc, 96, y + 58, W - 212, 16, {
        size: 13,
        color: "#64748b",
      });
      renderer.text(owned ? `Lv.${petState.level || 1}` : `\u788e\u7247 ${shards}/${need}`, 96, y + 80, {
        size: 13,
        color: rarityColor(pet.rarity),
        weight: "700",
      });
      if (!owned && need > 0) {
        renderer.progress({ x: 96, y: y + 88, w: W - 236, h: 8 }, shards / need, {
          fill: pet.color,
          bgFill: "#e5e7eb",
          minFill: 0,
        });
        renderer.text(`${Math.min(shards, need)}/${need}`, W - 106, y + 96, {
          size: 12,
          align: "right",
          color: "#64748b",
        });
      }

      const equipRect = { x: W - 108, y: y + 34, w: 80, h: 34 };
      renderer.button(equipRect, equipped ? "\u51fa\u6218\u4e2d" : owned ? "\u51fa\u6218" : "\u672a\u89e3\u9501", {
        fill: equipped ? "#dcfce7" : "#ffffff",
        color: equipped ? "#166534" : owned ? "#1d4ed8" : "#94a3b8",
        border: equipped ? "#bbf7d0" : "#cbd5e1",
        radius: 10,
        fontSize: 13,
        disabled: !owned || equipped,
      });
      this.registerButton(equipRect, () => this.selectPet(pet.id), !owned || equipped);
    });

    renderer.textWrap("\u840c\u5ba0 Buff \u53ea\u5728\u95ef\u5173 / \u6bcf\u65e5\u8bad\u7ec3\u751f\u6548\uff0c\u5bf9\u6218\u6a21\u5f0f\u4e0d\u542f\u7528", 20, H - renderer.bottomInset - 18, W - 40, 16, {
      size: 12,
      color: "#64748b",
    });
  }

  drawRewardModal(renderer, W, H) {
    const body = renderer.modal(
      { x: 26, y: H / 2 - 142, w: W - 52, h: 256 },
      {
        overlay: "rgba(15,23,42,0.42)",
        title: "\u76f2\u76d2\u5f00\u51fa\u4e86",
        subtitle: "\u5c0f\u670b\u53cb\u53ef\u4ee5\u5728\u5546\u5e97\u91cc\u7ee7\u7eed\u4f69\u6234\u6216\u4f7f\u7528",
      }
    );
    renderer.text(rewardLabel(this.revealReward), W / 2, body.y + 48, {
      size: 24,
      align: "center",
      weight: "700",
      color: "#2563eb",
    });
    renderer.text(this.revealReward.detail || "\u5956\u52b1\u5df2\u6536\u5165", W / 2, body.y + 82, {
      size: 14,
      align: "center",
      color: "#64748b",
    });
    const leftRect = { x: body.x + 18, y: body.y + 120, w: (body.w - 48) / 2, h: 42 };
    const rightRect = { x: leftRect.x + leftRect.w + 12, y: body.y + 120, w: (body.w - 48) / 2, h: 42 };
    renderer.button(leftRect, "\u7ee7\u7eed\u62bd\u76d2", {
      fill: "#2563eb",
      color: "#fff",
      radius: 14,
      fontSize: 16,
      disabled: (this.profile.coins || 0) < GACHA_CONFIG.costCoins,
    });
    renderer.button(rightRect, rewardActionLabel(this.revealReward), {
      fill: "#ffffff",
      color: "#1d4ed8",
      border: "#bfdbfe",
      radius: 14,
      fontSize: 15,
    });
    this.registerButton(leftRect, () => this.startGacha(), (this.profile.coins || 0) < GACHA_CONFIG.costCoins);
    this.registerButton(rightRect, () => {
      this.tab = rewardTargetTab(this.revealReward);
      this.revealReward = null;
    });

    const closeRect = { x: body.x + 18, y: body.y + 172, w: body.w - 36, h: 38 };
    renderer.button(closeRect, "\u7a0d\u540e\u518d\u770b", {
      fill: "#f8fafc",
      color: "#475569",
      border: "#cbd5e1",
      radius: 12,
      fontSize: 14,
    });
    this.registerButton(closeRect, () => {
      this.revealReward = null;
    });
  }

  drawSkinSample(renderer, x, y, w, h, style) {
    renderer.panel(x, y, w, h, {
      fill: style.fill,
      border: style.border,
      borderWidth: 1,
      radius: 16,
      shadow: "",
    });
    if (style.pattern === "sprinkles") {
      const ctx = renderer.ctx;
      const colors = ["#fb7185", "#fbbf24", "#60a5fa"];
      for (let i = 0; i < 8; i += 1) {
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(x + 10 + (i % 4) * 14, y + 10 + Math.floor(i / 4) * 20, 8, 3);
      }
    } else if (style.pattern === "stars") {
      const ctx = renderer.ctx;
      ctx.fillStyle = "#bfdbfe";
      for (let i = 0; i < 6; i += 1) {
        ctx.beginPath();
        ctx.arc(x + 12 + (i % 3) * 20, y + 14 + Math.floor(i / 3) * 24, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    renderer.text("8+5", x + w / 2, y + h / 2 + 2, {
      size: 24,
      align: "center",
      baseline: "middle",
      weight: "700",
      color: style.text,
    });
  }

  drawPetBadge(renderer, x, y, size, color) {
    const ctx = renderer.ctx;
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.arc(x + size / 2 - 8, y + size / 2 - 5, 4, 0, Math.PI * 2);
    ctx.arc(x + size / 2 + 8, y + size / 2 - 5, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  buyItem(itemId) {
    const result = this.app.storage.buyShopItem(this.app.profile, itemId, 1);
    if (!result.ok) {
      this.notice =
        result.reason === "item_locked"
          ? `\u518d\u901a\u5173 ${result.needClears} \u5173\u540e\u624d\u80fd\u8d2d\u4e70`
          : "\u91d1\u5e01\u4e0d\u8db3\uff0c\u5148\u53bb\u95ef\u5173\u631a\u91d1\u5e01\u5427";
      this.noticeTime = 2;
      return;
    }
    this.app.profile = result.profile;
    this.refresh();
    this.notice = `\u5df2\u8d2d\u4e70 ${ITEM_DEFS[itemId].name}`;
    this.noticeTime = 2;
  }

  selectSkin(skinId) {
    const result = this.app.storage.equipSkin(this.app.profile, skinId);
    if (!result.ok) {
      return;
    }
    this.app.profile = result.profile;
    this.refresh();
    this.notice = "\u65b0\u9898\u5361\u4e3b\u9898\u5df2\u4f69\u6234";
    this.noticeTime = 1.8;
  }

  selectPet(petId) {
    const result = this.app.storage.equipPet(this.app.profile, petId);
    if (!result.ok) {
      return;
    }
    this.app.profile = result.profile;
    this.refresh();
    this.notice = `${PET_DEFS[petId].name} \u5df2\u51fa\u6218`;
    this.noticeTime = 1.8;
  }

  startGacha() {
    const result = this.app.storage.performGacha(this.app.profile);
    if (!result.ok) {
      this.notice = "\u91d1\u5e01\u4e0d\u591f\u62bd\u76f2\u76d2\u4e86";
      this.noticeTime = 2;
      return;
    }
    this.app.profile = result.profile;
    this.refresh();
    this.revealReward = null;
    this.pendingReward = result.reward;
    this.gachaTime = GACHA_CONFIG.animationMs / 1000;
    this.gachaTicker = 0.06;
    this.gachaPreview = 0;
  }
}

module.exports = ShopScene;
