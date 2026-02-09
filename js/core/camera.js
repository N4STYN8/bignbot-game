export class Camera {
  constructor() {
    this.x = 2000;
    this.y = 2000;
    this.zoom = 1;
  }

  apply(ctx) {
    ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }

  update(dt) {
    // Pan / zoom logic comes later
  }
}
