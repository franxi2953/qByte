(function bootstrap() {
  const config = {
    type: Phaser.CANVAS,
    parent: "phaser-root",
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: "#000000",
    scene: [TitleScene, UIScene],
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH
    }
  };

  window.qbyteApp = new Phaser.Game(config);
})();
