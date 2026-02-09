export class GameLoop {
  constructor(update, render) {
    this.update = update;
    this.render = render;
    this.last = performance.now();
  }

  start() {
    requestAnimationFrame(this.tick.bind(this));
  }

  tick(now) {
    const dt = (now - this.last) / 1000;
    this.last = now;

    this.update(dt);
    this.render();

    requestAnimationFrame(this.tick.bind(this));
  }
}
