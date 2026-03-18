function roundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

class Renderer {
  constructor() {
    const info = wx.getSystemInfoSync();
    this.width = info.windowWidth;
    this.height = info.windowHeight;
    this.dpr = info.pixelRatio || 1;
    this.safeArea = info.safeArea || {
      top: 0,
      left: 0,
      right: this.width,
      bottom: this.height,
    };
    this.menuButtonRect = null;
    try {
      this.menuButtonRect = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
    } catch (error) {
      this.menuButtonRect = null;
    }
    this.topInset = Math.max(
      16,
      Number(this.safeArea.top || 0) + 10,
      this.menuButtonRect ? Number(this.menuButtonRect.bottom || 0) + 8 : 16
    );
    this.bottomInset = Math.max(16, this.height - Number(this.safeArea.bottom || this.height) + 12);
    this.canvas = wx.createCanvas();
    this.ctx = this.canvas.getContext("2d");
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.scale(this.dpr, this.dpr);
  }

  applyTextStyle(opts) {
    const ctx = this.ctx;
    const size = (opts && opts.size) || 16;
    const weight = (opts && opts.weight) || "normal";
    ctx.font = `${weight} ${size}px sans-serif`;
    ctx.fillStyle = (opts && opts.color) || "#1f2937";
    ctx.textAlign = (opts && opts.align) || "left";
    ctx.textBaseline = (opts && opts.baseline) || "alphabetic";
  }

  clear(color) {
    const ctx = this.ctx;
    ctx.fillStyle = color || "#f4f6fb";
    ctx.fillRect(0, 0, this.width, this.height);
  }

  overlay(color) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = color || "rgba(15,23,42,0.42)";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  }

  panel(x, y, width, height, opts) {
    const ctx = this.ctx;
    roundedRectPath(ctx, x, y, width, height, (opts && opts.radius) || 14);
    if (opts && opts.shadow) {
      ctx.shadowColor = opts.shadow;
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;
    }
    ctx.fillStyle = (opts && opts.fill) || "#ffffff";
    ctx.fill();
    ctx.shadowColor = "transparent";
    if (opts && opts.border) {
      ctx.lineWidth = opts.borderWidth || 1;
      ctx.strokeStyle = opts.border;
      ctx.stroke();
    }
  }

  text(text, x, y, opts) {
    const ctx = this.ctx;
    this.applyTextStyle(opts);
    ctx.fillText(String(text), x, y);
  }

  textMulti(lines, x, y, lineHeight, opts) {
    for (let i = 0; i < lines.length; i += 1) {
      this.text(lines[i], x, y + i * lineHeight, opts);
    }
  }

  wrapLines(text, maxWidth, opts) {
    const ctx = this.ctx;
    const content = String(text || "");
    if (!content) {
      return [];
    }
    this.applyTextStyle(opts);
    const paragraphs = content.split(/\n/);
    const lines = [];

    paragraphs.forEach((paragraph, index) => {
      let line = "";
      for (const char of paragraph) {
        const trial = line + char;
        if (line && ctx.measureText(trial).width > maxWidth) {
          lines.push(line);
          line = char;
        } else {
          line = trial;
        }
      }
      if (line || !paragraph) {
        lines.push(line || "");
      }
      if (index < paragraphs.length - 1) {
        lines.push("");
      }
    });

    return lines;
  }

  textWrap(text, x, y, maxWidth, lineHeight, opts) {
    const lines = this.wrapLines(text, maxWidth, opts);
    lines.forEach((line, index) => {
      this.text(line, x, y + index * lineHeight, opts);
    });
    return {
      lines,
      height: lines.length * lineHeight,
    };
  }

  progress(rect, ratio, opts) {
    const value = Math.max(0, Math.min(1, Number(ratio || 0)));
    const bgFill = (opts && opts.bgFill) || "#e5e7eb";
    const fill = (opts && opts.fill) || "#2563eb";
    const radius = (opts && opts.radius) || 999;
    const minFill = opts && opts.minFill ? opts.minFill : 8;

    this.panel(rect.x, rect.y, rect.w, rect.h, {
      fill: bgFill,
      radius,
      shadow: "",
    });

    if (value > 0) {
      this.panel(rect.x, rect.y, Math.max(minFill, rect.w * value), rect.h, {
        fill,
        radius,
        shadow: "",
      });
    }
  }

  modal(rect, opts) {
    if (opts && opts.overlay) {
      this.overlay(opts.overlay);
    }

    this.panel(rect.x, rect.y, rect.w, rect.h, {
      fill: (opts && opts.fill) || "rgba(255,255,255,0.98)",
      radius: (opts && opts.radius) || 20,
      border: opts && opts.border ? opts.border : "",
      borderWidth: opts && opts.borderWidth ? opts.borderWidth : 1,
      shadow: (opts && opts.shadow) || "rgba(15,23,42,0.2)",
    });

    if (opts && opts.title) {
      this.text(opts.title, rect.x + rect.w / 2, rect.y + 34, {
        size: (opts && opts.titleSize) || 24,
        weight: "700",
        align: "center",
        color: (opts && opts.titleColor) || "#111827",
      });
    }
    if (opts && opts.subtitle) {
      this.text(opts.subtitle, rect.x + rect.w / 2, rect.y + 62, {
        size: (opts && opts.subtitleSize) || 13,
        align: "center",
        color: (opts && opts.subtitleColor) || "#64748b",
      });
    }

    return {
      x: rect.x + 18,
      y: rect.y + (opts && (opts.title || opts.subtitle) ? 76 : 18),
      w: rect.w - 36,
      h: rect.h - (opts && (opts.title || opts.subtitle) ? 94 : 36),
    };
  }

  button(rect, label, opts) {
    const fill = opts && opts.fill ? opts.fill : "#2e8b57";
    const color = opts && opts.color ? opts.color : "#ffffff";
    const disabled = opts && opts.disabled;
    this.panel(rect.x, rect.y, rect.w, rect.h, {
      fill: disabled ? "#d1d5db" : fill,
      border: opts && opts.border ? opts.border : "",
      borderWidth: 1.5,
      radius: (opts && opts.radius) || 999,
      shadow: disabled ? "" : "rgba(31,41,55,0.1)",
    });
    this.text(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1, {
      size: (opts && opts.fontSize) || 18,
      weight: "600",
      align: "center",
      baseline: "middle",
      color,
    });
  }
}

module.exports = Renderer;
