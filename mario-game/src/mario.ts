import { initTheme, toggleTheme } from './theme';

// ── Theme ─────────────────────────────────────────────────────────────────
initTheme();
const themeBtn = document.getElementById('theme-btn') as HTMLButtonElement;
themeBtn.textContent = document.documentElement.classList.contains('dark') ? '☀️' : '🌙';
themeBtn.addEventListener('click', () => toggleTheme(themeBtn));

// ── Constants ────────────────────────────────────────────────────────────
const CW       = 800;
const CH       = 400;
const GRAVITY  = 0.55;
const JUMP_VEL = -13;
const MOVE_SPD = 4.2;
const LEVEL_W  = 1900;
const FLAG_X   = 1820;

// ── Level data ────────────────────────────────────────────────────────────
interface Plat   { x:number; y:number; w:number; h:number; c:string; }
interface CoinD  { x:number; y:number; }
interface EnemyD { x:number; y:number; minX:number; maxX:number; }

const PLATS: Plat[] = [
  { x:0,    y:340, w:420,  h:60, c:'#4a7c3f' },
  { x:460,  y:340, w:260,  h:60, c:'#4a7c3f' },
  { x:770,  y:340, w:340,  h:60, c:'#4a7c3f' },
  { x:1160, y:340, w:740,  h:60, c:'#4a7c3f' },
  { x:130,  y:258, w:120,  h:18, c:'#c47c32' },
  { x:360,  y:225, w:140,  h:18, c:'#c47c32' },
  { x:570,  y:195, w:110,  h:18, c:'#c47c32' },
  { x:800,  y:248, w: 90,  h:18, c:'#c47c32' },
  { x:970,  y:208, w:160,  h:18, c:'#c47c32' },
  { x:1220, y:185, w:130,  h:18, c:'#c47c32' },
  { x:1420, y:255, w: 90,  h:18, c:'#c47c32' },
  { x:1600, y:215, w:100,  h:18, c:'#c47c32' },
];

const COIN_POS: CoinD[] = [
  {x:148,y:228},{x:185,y:228},{x:222,y:228},
  {x:378,y:195},{x:418,y:195},{x:458,y:195},
  {x:584,y:165},{x:622,y:165},
  {x:812,y:218},{x:848,y:218},
  {x:980,y:178},{x:1020,y:178},{x:1060,y:178},
  {x:1232,y:155},{x:1270,y:155},
  {x:1432,y:225},
  {x:1612,y:185},{x:1648,y:185},
];

const ENEMY_INIT: EnemyD[] = [
  { x:220,  y:306, minX:40,   maxX:380  },
  { x:520,  y:306, minX:462,  maxX:715  },
  { x:870,  y:306, minX:772,  maxX:1100 },
  { x:1010, y:174, minX:972,  maxX:1126 },
  { x:1310, y:306, minX:1162, maxX:1895 },
  { x:1640, y:182, minX:1602, maxX:1696 },
];

// ── Runtime types ─────────────────────────────────────────────────────────
interface Player {
  x:number; y:number; w:number; h:number;
  vx:number; vy:number; onGround:boolean;
  facing:1|-1; dead:boolean; frame:number; frameTimer:number;
}
interface Coin   { x:number; y:number; r:number; collected:boolean; bobT:number; }
interface Enemy  { x:number; y:number; w:number; h:number; vx:number; vy:number; alive:boolean; squished:boolean; squishT:number; }

// ── DOM refs ──────────────────────────────────────────────────────────────
const canvas    = document.getElementById('canvas')    as HTMLCanvasElement;
const ctx       = canvas.getContext('2d')!;
const scoreEl   = document.getElementById('score')!;
const hiEl      = document.getElementById('hi-score')!;
const livesEl   = document.getElementById('lives')!;
const overlay   = document.getElementById('overlay')!;
const oTitle    = document.getElementById('overlay-title')!;
const oHint     = document.getElementById('overlay-hint')!;
const startBtn  = document.getElementById('start-btn') as HTMLButtonElement;
const btnLeft   = document.getElementById('btn-left')  as HTMLButtonElement;
const btnRight  = document.getElementById('btn-right') as HTMLButtonElement;
const btnJump   = document.getElementById('btn-jump')  as HTMLButtonElement;

// ── Game state ────────────────────────────────────────────────────────────
type State = 'idle' | 'playing' | 'gameover' | 'win';
let gameState: State = 'idle';
let score  = 0;
let hiScore = +(localStorage.getItem('mario-hi') ?? '0');
let lives  = 3;
let raf    = 0;

let player!: Player;
let coins:   Coin[]  = [];
let enemies: Enemy[] = [];
let camX    = 0;
let deathTimer = 0;

const keys = { left: false, right: false, jump: false };
let jumpHeld = false;

// ── Init ──────────────────────────────────────────────────────────────────
hiEl.textContent = String(hiScore);
updateHUD();
drawIdle();

// ── HUD ───────────────────────────────────────────────────────────────────
function updateHUD(): void {
  scoreEl.textContent  = String(score);
  hiEl.textContent     = String(hiScore);
  livesEl.textContent  = '❤️'.repeat(Math.max(0, lives));
}

// ── Start / Respawn ───────────────────────────────────────────────────────
function startGame(): void {
  lives = 3; score = 0;
  spawnLevel();
  gameState = 'playing';
  overlay.classList.add('hidden');
  updateHUD();
  cancelAnimationFrame(raf);
  loop();
}

function spawnLevel(): void {
  camX = 0; deathTimer = 0; jumpHeld = false;
  player = { x:60, y:270, w:28, h:36, vx:0, vy:0, onGround:false, facing:1, dead:false, frame:0, frameTimer:0 };
  coins   = COIN_POS.map(c => ({ x:c.x, y:c.y, r:8, collected:false, bobT:Math.random()*Math.PI*2 }));
  enemies = ENEMY_INIT.map(e => ({ x:e.x, y:e.y, w:32, h:32, vx:1.2, vy:0, alive:true, squished:false, squishT:0 }));
}

function respawn(): void {
  camX = 0; deathTimer = 0; jumpHeld = false;
  player = { x:60, y:270, w:28, h:36, vx:0, vy:0, onGround:false, facing:1, dead:false, frame:0, frameTimer:0 };
  enemies = ENEMY_INIT.map((e, i) => ({
    x:e.x, y:e.y, w:32, h:32,
    vx: enemies[i]?.vx > 0 ? 1.2 : -1.2, vy:0,
    alive:true, squished:false, squishT:0,
  }));
}

// ── Game loop ─────────────────────────────────────────────────────────────
function loop(): void {
  if (gameState !== 'playing') return;
  update();
  draw();
  raf = requestAnimationFrame(loop);
}

// ── Update ────────────────────────────────────────────────────────────────
function update(): void {
  const p = player;

  // death animation
  if (p.dead) {
    p.vy += GRAVITY; p.y += p.vy;
    deathTimer++;
    if (deathTimer > 90) {
      lives--;
      updateHUD();
      if (lives <= 0) { gameState = 'gameover'; saveHi(); showOverlay('gameover'); return; }
      respawn();
    }
    return;
  }

  // input
  if (keys.left)       { p.vx = -MOVE_SPD; p.facing = -1; }
  else if (keys.right) { p.vx =  MOVE_SPD; p.facing =  1; }
  else                  p.vx *= 0.75;

  if (keys.jump && !jumpHeld && p.onGround) { p.vy = JUMP_VEL; jumpHeld = true; }
  if (!keys.jump) jumpHeld = false;

  // physics
  p.vy += GRAVITY;
  if (p.vy > 14) p.vy = 14;
  p.x += p.vx;
  p.y += p.vy;
  if (p.x < 0)          { p.x = 0;             p.vx = 0; }
  if (p.x + p.w > LEVEL_W) { p.x = LEVEL_W - p.w; p.vx = 0; }

  // platform collision
  p.onGround = false;
  for (const pl of PLATS) {
    if (!aabb(p, pl)) continue;
    const ox = Math.min(p.x+p.w, pl.x+pl.w) - Math.max(p.x, pl.x);
    const oy = Math.min(p.y+p.h, pl.y+pl.h) - Math.max(p.y, pl.y);
    if (oy < ox) {
      if (p.y + p.h/2 < pl.y + pl.h/2) { p.y = pl.y - p.h; p.vy = 0; p.onGround = true; }
      else { p.y = pl.y + pl.h; if (p.vy < 0) p.vy = 0; }
    } else {
      p.x = p.x + p.w/2 < pl.x + pl.w/2 ? pl.x - p.w : pl.x + pl.w;
      p.vx = 0;
    }
  }

  // fall death
  if (p.y > CH + 50) { p.dead = true; p.vy = -8; deathTimer = 0; }

  // enemies
  for (let i = 0; i < enemies.length; i++) {
    const en = enemies[i];
    if (!en.alive) { if (en.squished) en.squishT++; continue; }
    en.x += en.vx; en.vy += GRAVITY; en.y += en.vy;

    for (const pl of PLATS) {
      if (!aabb(en, pl)) continue;
      const ox = Math.min(en.x+en.w, pl.x+pl.w) - Math.max(en.x, pl.x);
      const oy = Math.min(en.y+en.h, pl.y+pl.h) - Math.max(en.y, pl.y);
      if (oy < ox) {
        if (en.y + en.h/2 < pl.y + pl.h/2) { en.y = pl.y - en.h; en.vy = 0; }
        else { en.y = pl.y + pl.h; en.vy = 0; }
      } else { en.vx *= -1; en.x = en.x + en.w/2 < pl.x + pl.w/2 ? pl.x - en.w : pl.x + pl.w; }
    }

    const ed = ENEMY_INIT[i];
    if (en.x < ed.minX)         { en.x = ed.minX;         en.vx =  Math.abs(en.vx); }
    if (en.x + en.w > ed.maxX)  { en.x = ed.maxX - en.w;  en.vx = -Math.abs(en.vx); }

    if (!p.dead && aabb(p, en)) {
      if (p.vy > 0 && p.y + p.h - p.vy <= en.y + 4) {
        en.alive = false; en.squished = true; en.squishT = 0;
        p.vy = -7; score += 100; updateHUD();
      } else { p.dead = true; p.vy = -9; deathTimer = 0; }
    }
  }

  // coins
  for (const c of coins) {
    c.bobT += 0.06;
    if (!c.collected && circRect(c, p)) { c.collected = true; score += 10; updateHUD(); }
  }

  // win
  if (p.x + p.w >= FLAG_X) { gameState = 'win'; saveHi(); showOverlay('win'); return; }

  // camera
  camX += (p.x - CW * 0.35 - camX) * 0.12;
  camX = Math.max(0, Math.min(camX, LEVEL_W - CW));

  // walk frame
  if (Math.abs(p.vx) > 0.5 && p.onGround) {
    p.frameTimer++;
    if (p.frameTimer >= 8) { p.frame = (p.frame + 1) % 2; p.frameTimer = 0; }
  } else { p.frame = 0; p.frameTimer = 0; }
}

// ── Draw ──────────────────────────────────────────────────────────────────
function drawIdle(): void {
  const dark = document.documentElement.classList.contains('dark');
  const sky = ctx.createLinearGradient(0, 0, 0, CH);
  if (dark) { sky.addColorStop(0,'#0d1b2a'); sky.addColorStop(1,'#1a2f4a'); }
  else       { sky.addColorStop(0,'#87ceeb'); sky.addColorStop(1,'#b8e4f9'); }
  ctx.fillStyle = sky; ctx.fillRect(0, 0, CW, CH);
}

function draw(): void {
  const dark = document.documentElement.classList.contains('dark');

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, CH);
  if (dark) { sky.addColorStop(0,'#0d1b2a'); sky.addColorStop(1,'#1a2f4a'); }
  else       { sky.addColorStop(0,'#87ceeb'); sky.addColorStop(1,'#b8e4f9'); }
  ctx.fillStyle = sky; ctx.fillRect(0, 0, CW, CH);

  drawClouds(dark);

  ctx.save();
  ctx.translate(-camX, 0);

  for (const pl of PLATS)   drawPlatform(pl, dark);
  drawFlag(dark);
  for (const c of coins)    if (!c.collected) drawCoin(c);
  for (const en of enemies) drawEnemy(en, dark);
  drawPlayer(dark);

  ctx.restore();
}

function drawClouds(dark: boolean): void {
  const cols = dark
    ? ['rgba(255,255,255,0.06)','rgba(255,255,255,0.04)']
    : ['rgba(255,255,255,0.85)','rgba(255,255,255,0.65)'];
  const pos = [
    {x:80,y:50,r:30},{x:160,y:45,r:22},{x:120,y:40,r:18},
    {x:320,y:65,r:28},{x:390,y:60,r:20},{x:355,y:55,r:15},
    {x:560,y:45,r:32},{x:630,y:42,r:24},
  ];
  const px = (camX * 0.35) % CW;
  ctx.save();
  for (let rep = -1; rep <= 1; rep++) {
    pos.forEach((p, i) => {
      ctx.fillStyle = cols[i % 2];
      ctx.beginPath();
      ctx.arc(p.x - px + rep * CW, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.restore();
}

function drawPlatform(pl: Plat, dark: boolean): void {
  ctx.fillStyle = dark ? scale(pl.c, 0.6) : pl.c;
  ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
  ctx.fillStyle = dark ? scale(pl.c, 0.8) : scale(pl.c, 1.3);
  ctx.fillRect(pl.x, pl.y, pl.w, 5);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(pl.x, pl.y + pl.h - 5, pl.w, 5);
  if (pl.h <= 20) {
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
    for (let bx = pl.x + 20; bx < pl.x + pl.w; bx += 20) {
      ctx.beginPath(); ctx.moveTo(bx, pl.y); ctx.lineTo(bx, pl.y + pl.h); ctx.stroke();
    }
  }
}

function drawFlag(dark: boolean): void {
  ctx.fillStyle = dark ? '#9ca3af' : '#6b7280';
  ctx.fillRect(FLAG_X, 180, 6, 160);
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.moveTo(FLAG_X + 6, 180); ctx.lineTo(FLAG_X + 46, 200); ctx.lineTo(FLAG_X + 6, 220);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = dark ? '#78716c' : '#a8a29e';
  ctx.fillRect(FLAG_X - 8, 335, 22, 10);
}

function drawCoin(c: Coin): void {
  const yOff = Math.sin(c.bobT) * 3;
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath(); ctx.arc(c.x, c.y + yOff, c.r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fde68a';
  ctx.beginPath(); ctx.arc(c.x - 2, c.y + yOff - 2, c.r * 0.45, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#92400e';
  ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('$', c.x, c.y + yOff);
}

function drawEnemy(en: Enemy, dark: boolean): void {
  if (en.squished) {
    ctx.globalAlpha = Math.max(0, 1 - en.squishT / 30);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(en.x, en.y + en.h - 8, en.w, 8);
    ctx.globalAlpha = 1; return;
  }
  if (!en.alive) return;
  const { x, y, w, h } = en;
  ctx.fillStyle = dark ? '#b91c1c' : '#dc2626';
  ctx.beginPath(); (ctx as any).roundRect(x, y, w, h, 6); ctx.fill();
  ctx.fillStyle = dark ? '#7f1d1d' : '#991b1b';
  ctx.fillRect(x + 3, y + h - 8, 8, 8); ctx.fillRect(x + w - 11, y + h - 8, 8, 8);
  ctx.fillStyle = 'white';
  ctx.beginPath(); ctx.arc(x + 9,     y + 10, 5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + w - 9, y + 10, 5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#1e293b';
  const ed = en.vx > 0 ? 2 : -2;
  ctx.beginPath(); ctx.arc(x + 9     + ed, y + 10, 2.5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + w - 9 + ed, y + 10, 2.5, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(x + 5,     y + 5); ctx.lineTo(x + 14,    y + 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + w - 5, y + 5); ctx.lineTo(x + w - 14, y + 7); ctx.stroke();
}

function drawPlayer(dark: boolean): void {
  const p = player;
  const x = p.x, y = p.y;
  const fl = p.facing === -1;
  ctx.save();
  if (fl) { ctx.translate(x + p.w, y); ctx.scale(-1, 1); ctx.translate(-x, -y); }
  // shadow
  if (!p.dead) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(x + p.w/2, y + p.h + 2, p.w/2, 4, 0, 0, Math.PI*2); ctx.fill();
  }
  // legs
  const legOff = (p.frame === 1 && Math.abs(p.vx) > 0.5 && !p.dead) ? 3 : 0;
  ctx.fillStyle = '#1e40af';
  ctx.fillRect(x + 2,       y + p.h - 14,          10, 14);
  ctx.fillRect(x + p.w - 12, y + p.h - 14 + legOff, 10, 14 - legOff);
  ctx.fillStyle = '#7c2d12';
  ctx.fillRect(x,          y + p.h - 6, 13, 6);
  ctx.fillRect(x + p.w - 13, y + p.h - 6, 13, 6);
  // overalls
  ctx.fillStyle = '#1e40af'; ctx.fillRect(x + 2, y + p.h - 22, p.w - 4, 10);
  // shirt
  ctx.fillStyle = '#dc2626'; ctx.fillRect(x + 3, y + 14, p.w - 6, p.h - 30);
  // head
  ctx.fillStyle = '#fde68a';
  ctx.beginPath(); (ctx as any).roundRect(x + 3, y + 2, p.w - 6, 18, 5); ctx.fill();
  // hat
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(x + 1, y + 4, p.w - 2, 8);
  ctx.fillRect(x + 5, y,     p.w - 10, 7);
  ctx.fillStyle = '#991b1b'; ctx.fillRect(x + 1, y + 10, p.w - 2, 2);
  // eye
  ctx.fillStyle = 'white';
  ctx.beginPath(); ctx.arc(x + p.w - 10, y + 8.5, 2, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = dark ? '#e2e8f0' : '#1e293b';
  ctx.beginPath(); ctx.arc(x + p.w - 9, y + 9, 2.5, 0, Math.PI*2); ctx.fill();
  // mustache
  ctx.fillStyle = '#451a03'; ctx.fillRect(x + p.w - 15, y + 14, 13, 3);
  ctx.restore();
}

// ── Overlay ───────────────────────────────────────────────────────────────
function showOverlay(s: State): void {
  overlay.classList.remove('hidden');
  if (s === 'idle') {
    oTitle.textContent = 'Mario Run';
    oHint.textContent  = 'Collect coins · Stomp enemies · Reach the flag';
    startBtn.textContent = 'Play';
  } else if (s === 'gameover') {
    oTitle.textContent = 'Game Over';
    oHint.textContent  = `Score: ${score}`;
    startBtn.textContent = 'Try Again';
  } else {
    oTitle.textContent = '🎉 You Win!';
    oHint.textContent  = `Score: ${score} · Best: ${hiScore}`;
    startBtn.textContent = 'Play Again';
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────
function aabb(a:{x:number;y:number;w:number;h:number}, b:{x:number;y:number;w:number;h:number}): boolean {
  return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
}
function circRect(c:{x:number;y:number;r:number}, r:{x:number;y:number;w:number;h:number}): boolean {
  const cx = Math.max(r.x, Math.min(c.x, r.x+r.w));
  const cy = Math.max(r.y, Math.min(c.y, r.y+r.h));
  return (cx-c.x)**2 + (cy-c.y)**2 <= c.r**2;
}
function scale(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n>>16)&0xff)*f));
  const g = Math.min(255, Math.round(((n>>8) &0xff)*f));
  const b = Math.min(255, Math.round(( n     &0xff)*f));
  return `rgb(${r},${g},${b})`;
}
function saveHi(): void {
  if (score > hiScore) {
    hiScore = score;
    hiEl.textContent = String(hiScore);
    localStorage.setItem('mario-hi', String(hiScore));
  }
}

// ── Keyboard ──────────────────────────────────────────────────────────────
window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (['ArrowLeft','a','A'].includes(e.key))           keys.left  = true;
  if (['ArrowRight','d','D'].includes(e.key))          keys.right = true;
  if (['ArrowUp','w','W',' '].includes(e.key))         { keys.jump = true; e.preventDefault(); }
});
window.addEventListener('keyup', (e: KeyboardEvent) => {
  if (['ArrowLeft','a','A'].includes(e.key))           keys.left  = false;
  if (['ArrowRight','d','D'].includes(e.key))          keys.right = false;
  if (['ArrowUp','w','W',' '].includes(e.key))         keys.jump  = false;
});

// ── Mobile buttons ────────────────────────────────────────────────────────
function holdBtn(btn: HTMLButtonElement, key: keyof typeof keys): void {
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); keys[key] = true;  btn.classList.add('pressed'); });
  btn.addEventListener('pointerup',   ()  => { keys[key] = false; btn.classList.remove('pressed'); });
  btn.addEventListener('pointercancel', () => { keys[key] = false; btn.classList.remove('pressed'); });
}
holdBtn(btnLeft,  'left');
holdBtn(btnRight, 'right');
holdBtn(btnJump,  'jump');

// ── Start button ──────────────────────────────────────────────────────────
startBtn.addEventListener('click', startGame);
