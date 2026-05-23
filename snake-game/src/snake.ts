import { initTheme, toggleTheme } from './theme';

// ── Theme ─────────────────────────────────────────────────────────────────
initTheme();
const themeBtn = document.getElementById('theme-btn') as HTMLButtonElement;
themeBtn.textContent = document.documentElement.classList.contains('dark') ? '☀️' : '🌙';
themeBtn.addEventListener('click', () => toggleTheme(themeBtn));

// ── Types ─────────────────────────────────────────────────────────────────
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type GameState = 'idle' | 'playing' | 'gameover';
interface Point { x: number; y: number; }

// ── Constants ─────────────────────────────────────────────────────────────
const CELL = 20;
const COLS = 20;
const ROWS = 20;
const SIZE = CELL * COLS;   // 400

const OPPOSITE: Record<Direction, Direction> = {
  UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
};

// ── DOM ───────────────────────────────────────────────────────────────────
const canvas    = document.getElementById('canvas')    as HTMLCanvasElement;
const ctx       = canvas.getContext('2d')!;
const scoreEl   = document.getElementById('score')!;
const hiEl      = document.getElementById('hi-score')!;
const overlay   = document.getElementById('overlay')!;
const oIcon     = document.getElementById('overlay-icon')!;
const oTitle    = document.getElementById('overlay-title')!;
const oHint     = document.getElementById('overlay-hint')!;
const startBtn  = document.getElementById('start-btn') as HTMLButtonElement;

// ── State ─────────────────────────────────────────────────────────────────
let state:         GameState = 'idle';
let score          = 0;
let hiScore        = +(localStorage.getItem('snake-hi') ?? '0');
let snake:         Point[]   = [];
let food:          Point     = { x: 5, y: 5 };
let direction:     Direction = 'RIGHT';
let nextDirection: Direction = 'RIGHT';
let intervalId:    ReturnType<typeof setInterval> | null = null;
let touchX         = 0;
let touchY         = 0;

// ── Init ──────────────────────────────────────────────────────────────────
hiEl.textContent = String(hiScore);
drawIdle();
showOverlay('idle');

// ── Game control ──────────────────────────────────────────────────────────
function startGame(): void {
  snake         = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  direction     = 'RIGHT';
  nextDirection = 'RIGHT';
  score         = 0;
  scoreEl.textContent = '0';
  spawnFood();
  state = 'playing';
  overlay.classList.add('hidden');
  clearInterval(intervalId!);
  intervalId = setInterval(tick, 130);
}

function tick(): void {
  direction = nextDirection;
  const h    = snake[0];
  const next: Point = {
    x: h.x + (direction === 'RIGHT' ? 1 : direction === 'LEFT' ? -1 : 0),
    y: h.y + (direction === 'DOWN'  ? 1 : direction === 'UP'   ? -1 : 0),
  };

  // collision
  if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS
      || snake.some(p => p.x === next.x && p.y === next.y)) {
    clearInterval(intervalId!);
    state = 'gameover';
    showOverlay('gameover');
    return;
  }

  snake.unshift(next);
  if (next.x === food.x && next.y === food.y) {
    score++;
    scoreEl.textContent = String(score);
    if (score > hiScore) {
      hiScore = score;
      hiEl.textContent = String(hiScore);
      localStorage.setItem('snake-hi', String(hiScore));
    }
    spawnFood();
  } else {
    snake.pop();
  }
  draw();
}

function spawnFood(): void {
  let f: Point;
  do { f = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }; }
  while (snake.some(p => p.x === f.x && p.y === f.y));
  food = f;
}

// ── Draw ──────────────────────────────────────────────────────────────────
function drawIdle(): void {
  const dark = document.documentElement.classList.contains('dark');
  ctx.fillStyle = dark ? '#1c1c2a' : '#f1f5f9';
  ctx.fillRect(0, 0, SIZE, SIZE);
}

function draw(): void {
  const dark = document.documentElement.classList.contains('dark');

  // background
  ctx.fillStyle = dark ? '#1c1c2a' : '#f1f5f9';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // grid lines
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= COLS; i++) {
    ctx.beginPath(); ctx.moveTo(i * CELL, 0);    ctx.lineTo(i * CELL, SIZE); ctx.stroke();
  }
  for (let j = 0; j <= ROWS; j++) {
    ctx.beginPath(); ctx.moveTo(0, j * CELL);    ctx.lineTo(SIZE, j * CELL); ctx.stroke();
  }

  // food
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2 - 3, 0, Math.PI * 2);
  ctx.fill();

  // snake body
  snake.forEach((p, i) => {
    const alpha = i === 0 ? 1 : Math.max(0.25, 1 - (i / snake.length) * 0.75);
    ctx.fillStyle = i === 0 ? '#22c55e' : `rgba(34,197,94,${alpha})`;
    const pad = i === 0 ? 1 : 2;
    const r   = i === 0 ? 5 : 3;
    const x   = p.x * CELL + pad;
    const y   = p.y * CELL + pad;
    const w   = CELL - pad * 2;
    const h   = CELL - pad * 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);       ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h,     x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y,         x + r, y);
    ctx.closePath();
    ctx.fill();
  });

  // head eye
  if (snake.length > 0) {
    const head = snake[0];
    ctx.fillStyle = '#fff';
    const ex = head.x * CELL + (direction === 'LEFT' ? 5 : 13);
    ctx.beginPath();
    ctx.arc(ex, head.y * CELL + CELL / 2 - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Overlay ───────────────────────────────────────────────────────────────
function showOverlay(s: GameState): void {
  overlay.classList.remove('hidden');
  if (s === 'idle') {
    oIcon.textContent  = '🐍';
    oTitle.textContent = 'Snake';
    oHint.textContent  = 'Arrow keys / WASD to move · Swipe on mobile';
    startBtn.textContent = 'Start Game';
  } else {
    const newHi = score === hiScore && score > 0;
    oIcon.textContent  = '💀';
    oTitle.textContent = 'Game Over';
    oHint.textContent  = `Score: ${score}${newHi ? ' 🏆 New High Score!' : ''}`;
    startBtn.textContent = 'Play Again';
  }
}

// ── Controls ──────────────────────────────────────────────────────────────
startBtn.addEventListener('click', startGame);

window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (state !== 'playing') return;
  const map: Record<string, Direction> = {
    ArrowUp: 'UP', w: 'UP', W: 'UP',
    ArrowDown: 'DOWN', s: 'DOWN', S: 'DOWN',
    ArrowLeft: 'LEFT', a: 'LEFT', A: 'LEFT',
    ArrowRight: 'RIGHT', d: 'RIGHT', D: 'RIGHT',
  };
  const d = map[e.key];
  if (d && d !== OPPOSITE[direction]) {
    nextDirection = d;
    e.preventDefault();
  }
});

canvas.addEventListener('touchstart', (e: TouchEvent) => {
  touchX = e.touches[0].clientX;
  touchY = e.touches[0].clientY;
}, { passive: true });

canvas.addEventListener('touchend', (e: TouchEvent) => {
  if (state !== 'playing') { startGame(); return; }
  const dx = e.changedTouches[0].clientX - touchX;
  const dy = e.changedTouches[0].clientY - touchY;
  if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
  const d: Direction = Math.abs(dx) > Math.abs(dy)
    ? (dx > 0 ? 'RIGHT' : 'LEFT')
    : (dy > 0 ? 'DOWN' : 'UP');
  if (d !== OPPOSITE[direction]) nextDirection = d;
}, { passive: true });
