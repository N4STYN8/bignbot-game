console.log("🚨 NEBULA TD LIVE BUILD: turret_1 animated");
document.title = "Nebula TD — Turret 1 Animated";

(() => {
'use strict';

/* ============================================================
   SPRITESHEET (GLOBAL — DO NOT MOVE)
============================================================ */
class SpriteSheet {
  constructor(img, frameW, frameH, frames, fps = 8) {
    this.img = img;
    this.frameW = frameW;
    this.frameH = frameH;
    this.frames = frames;
    this.fps = fps;
  }
  draw(ctx, timeSec, x, y, sizePx, rotationRad = 0) {
    const frame = Math.floor(timeSec * this.fps) % this.frames;
    const sx = frame * this.frameW;
    ctx.save();
    ctx.translate(x, y);
    if (rotationRad) ctx.rotate(rotationRad);
    ctx.drawImage(
      this.img,
      sx, 0, this.frameW, this.frameH,
      -sizePx / 2, -sizePx / 2,
      sizePx, sizePx
    );
    ctx.restore();
  }
}

/* ============================================================
   HELPERS
============================================================ */
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const dist2=(ax,ay,bx,by)=>{const dx=ax-bx,dy=ay-by;return dx*dx+dy*dy};

/* ============================================================
   DOM
============================================================ */
const canvas=document.getElementById('game');
const ctx=canvas.getContext('2d');

/* ============================================================
   ASSETS
============================================================ */
const ASSET={
  bg:new Image(),
  turret:[],
  enemy:{
    drone:new Image(),
    walker:new Image(),
    tank:new Image()
  }
};

ASSET.bg.src='assets/images/background.png';

for(let i=1;i<=5;i++){
  const im=new Image();
  im.src=`assets/images/turret_${i}.png`;
  ASSET.turret.push(im);
}

ASSET.enemy.drone.src='assets/images/enemy_drone.png';
ASSET.enemy.walker.src='assets/images/enemy_walker.png';
ASSET.enemy.tank.src='assets/images/enemy_tank.png';

/* === ANIMATED TURRET 1 === */
ASSET.turret1_idle = new Image();
ASSET.turret1_idle.src = 'assets/images/turret_1_idle.png';
let SPR_TURRET1 = null;
ASSET.turret1_idle.onload = () => {
  SPR_TURRET1 = new SpriteSheet(ASSET.turret1_idle,128,128,12,8);
};

/* ============================================================
   WORLD / STATE
============================================================ */
const WORLD_W=2400, WORLD_H=1400;
const GRID=56;

const state={
  running:false,
  paused:false,
  wave:1,
  lives:20,
  money:350,
  camX:900,
  camY:700,
  zoom:1,
  enemies:[],
  turrets:[],
  spawnQueue:[]
};

/* ============================================================
   TURRET DEFS
============================================================ */
const TurretDefs=[
  {id:'laser',icon:0,baseRange:210},
  {id:'cannon',icon:1,baseRange:240},
  {id:'missile',icon:2,baseRange:260},
  {id:'slow',icon:3,baseRange:210},
  {id:'tesla',icon:4,baseRange:230}
];

/* ============================================================
   DRAW
============================================================ */
function drawTurrets(){
  const tSec = performance.now()/1000;

  for(const t of state.turrets){
    const def=TurretDefs[t.defIdx];
    const img=ASSET.turret[def.icon];
    const s=54;

    // base glow
    ctx.save();
    ctx.globalAlpha=0.25;
    ctx.fillStyle='rgba(0,200,255,0.25)';
    ctx.beginPath();
    ctx.arc(t.x,t.y,26,0,Math.PI*2);
    ctx.fill();
    ctx.restore();

    // === ANIMATED TURRET 1 ===
    if(t.defIdx===0 && SPR_TURRET1){
      SPR_TURRET1.draw(ctx,tSec,t.x,t.y,s,0);
    }
    else if(img.complete){
      ctx.drawImage(img,t.x-s/2,t.y-s/2,s,s);
    }

    // range ring
    ctx.save();
    ctx.globalAlpha=0.12;
    ctx.strokeStyle='rgba(0,200,255,0.8)';
    ctx.setLineDash([10,10]);
    ctx.beginPath();
    ctx.arc(t.x,t.y,def.baseRange,0,Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawEnemies(){
  for(const e of state.enemies){
    const img=ASSET.enemy[e.sprite];
    const s=e.size*2.2;
    if(img.complete){
      ctx.drawImage(img,e.x-s/2,e.y-s/2,s,s);
    }
  }
}

/* ============================================================
   MAIN RENDER
============================================================ */
function render(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // background
  if(ASSET.bg.complete){
    ctx.drawImage(ASSET.bg,0,0,canvas.width,canvas.height);
  }

  ctx.save();
  ctx.translate(canvas.width/2,canvas.height/2);
  ctx.scale(state.zoom,state.zoom);
  ctx.translate(-state.camX,-state.camY);

  drawTurrets();
  drawEnemies();

  ctx.restore();
}

/* ============================================================
   TEST DATA (SO YOU SEE IT WORK)
============================================================ */
state.turrets.push({x:900,y:700,defIdx:0});
state.turrets.push({x:980,y:700,defIdx:1});
state.turrets.push({x:1060,y:700,defIdx:2});

/* ============================================================
   LOOP
============================================================ */
function loop(){
  requestAnimationFrame(loop);
  render();
}
loop();

})();
