class BaseScene {
  constructor(app) {
    this.app = app;
    this.buttons = [];
  }

  onEnter(params) {
    this.params = params || {};
  }

  onExit() {}

  update() {}

  render() {}

  resetButtons() {
    this.buttons = [];
  }

  registerButton(rect, onTap, disabled) {
    this.buttons.push({
      ...rect,
      onTap,
      disabled: !!disabled,
    });
  }

  hitButton(x, y) {
    for (let i = this.buttons.length - 1; i >= 0; i -= 1) {
      const item = this.buttons[i];
      if (item.disabled) {
        continue;
      }
      if (x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h) {
        if (item.onTap) {
          item.onTap();
        }
        return true;
      }
    }
    return false;
  }

  onTap(x, y) {
    this.hitButton(x, y);
  }
}

module.exports = BaseScene;
