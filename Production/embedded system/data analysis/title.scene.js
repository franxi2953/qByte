class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: "TitleScene" });
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0d1320, 0x0d1320, 0x0a1824, 0x0a1824, 1);
    bg.fillRect(0, 0, w, h);

    this.add.text(w / 2, h / 2 - 62, "qByte", {
      fontFamily: "Avenir Next, Segoe UI, sans-serif",
      fontStyle: "700",
      fontSize: "58px",
      color: "#f3f9ff"
    }).setOrigin(0.5);

    const status = this.add.text(w / 2, h / 2 - 10, "Booting offline analyzer...", {
      fontFamily: "Avenir Next, Segoe UI, sans-serif",
      fontSize: "14px",
      color: "#a8bad3"
    }).setOrigin(0.5);

    const barW = Math.min(420, w * 0.74);
    const barH = 8;
    const x = w / 2 - barW / 2;
    const y = h / 2 + 18;

    const track = this.add.graphics();
    track.fillStyle(0x1e2a40, 0.95);
    track.fillRoundedRect(x, y, barW, barH, 4);

    const fill = this.add.graphics();

    const phases = [
      { p: 0.2, label: "Loading Phaser UI..." },
      { p: 0.5, label: "Preparing chart pipeline..." },
      { p: 0.8, label: "Preparing sample editor..." },
      { p: 1.0, label: "Ready" }
    ];

    let idx = 0;
    const timer = this.time.addEvent({
      delay: 230,
      loop: true,
      callback: () => {
        if (idx >= phases.length) {
          timer.remove(false);
          this.time.delayedCall(180, () => this.scene.start("UIScene"));
          return;
        }

        const phase = phases[idx];
        status.setText(phase.label);
        fill.clear();
        fill.fillStyle(0x4fd2c2, 1);
        fill.fillRoundedRect(x, y, barW * phase.p, barH, 4);
        idx += 1;
      }
    });
  }
}
