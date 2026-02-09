import { GameLoop } from './loop.js';
import { Camera } from './camera.js';
import { Assets } from './assets.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.resize();

    this.camera = new Camera();
    this.assets = new Assets();

    this.loop = new GameLoop(
      this.update.bind(this),
      this.render.bind(this)
    );

    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  start() {
    console.log('🚀 BIGNBOT TD ENGINE ONLINE');
    this.loop.start();
  }

  update(dt) {
    this.camera.update(dt);
  }

  render() {
    const ctx = this.ctx;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    this.camera.apply(ctx);

    // TEMP VISUAL CONFIRMATION GRID
    ctx.strokeStyle = 'rgba(0,200,255,0.15)';
    ctx.lineWidth = 1;

    const grid = 64;
    for (let x = 0; x < 4000; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 4000);
      ctx.stroke();
    }

    for (let y = 0; y < 4000; y += grid) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(4000, y);
      ctx.stroke();
    }

    ctx.restore();
  }
}
