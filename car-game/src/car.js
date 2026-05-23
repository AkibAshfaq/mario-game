import './style.css';
import { initTheme, toggleTheme } from './theme';
// ── Theme ─────────────────────────────────────────────────────────────────────
initTheme();
document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
// ── Canvas setup ──────────────────────────────────────────────────────────────
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const W = 400;
const H = 620;
canvas.width = W;
canvas.height = H;
// ── Road constants ────────────────────────────────────────────────────────────
const ROAD_L = 60;
const ROAD_R = 340;
const ROAD_W = ROAD_R - ROAD_L; // 280
const LANE_COUNT = 3;
const LANE_W = ROAD_W / LANE_COUNT; // ≈93.3
const LANE_CX = [
    ROAD_L + LANE_W * 0.5,
    ROAD_L + LANE_W * 1.5,
    ROAD_L + LANE_W * 2.5,
]; // [~106.7, ~200, ~293.3]
// ── Car constants ─────────────────────────────────────────────────────────────
const CAR_W = 46;
const CAR_H = 76;
const PLAYER_Y = 500;
// ── Speed constants ───────────────────────────────────────────────────────────
const INIT_SPEED = 3.5;
const MAX_SPEED = 18;
const SPAWN_INTERVAL_MIN = 38; // frames between enemy spawns (min)
const SPAWN_INTERVAL_MAX = 95;
// ── Enemy colors ──────────────────────────────────────────────────────────────
const ENEMY_COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#a855f7', '#ec4899', '#64748b', '#e2e8f0',
];
// ── Kerb stripe config ────────────────────────────────────────────────────────
const STRIPE_H = 28;
// ── Game state ────────────────────────────────────────────────────────────────
let state = 'idle';
let playerLane = 1; // 0 | 1 | 2
let playerX = LANE_CX[1]; // current rendered X (lerped)
let targetX = LANE_CX[1];
let score = 0;
let lives = 3;
let invTimer = 0; // invincibility frames after hit
let frameCount = 0;
let speed = INIT_SPEED;
let enemies = [];
let particles = [];
let nextSpawn = 0; // frame at which next enemy spawns
let dashOffset = 0; // lane dash scroll offset
let kerbOffset = 0; // kerb stripe scroll offset
let bestScore = parseInt(localStorage.getItem('car-best') ?? '0', 10);
// ── UI refs ───────────────────────────────────────────────────────────────────
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-msg');
const scoreDisplay = document.getElementById('score-display');
const bestDisplay = document.getElementById('best-display');
const livesDisplay = document.getElementById('lives-display');
const speedFill = document.getElementById('speed-fill');
const btnPlay = document.getElementById('btn-play');
// ── Show start overlay ────────────────────────────────────────────────────────
showIdle();
// ── Helpers ───────────────────────────────────────────────────────────────────
function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
}
function shadeColor(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
    const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
    return `rgb(${r},${g},${b})`;
}
function aabb(ax, ay, aw, ah, bx, by, bw, bh, erode = 2) {
    const e = erode;
    return (ax - aw / 2 + e < bx + bw / 2 - e &&
        ax + aw / 2 - e > bx - bw / 2 + e &&
        ay - ah / 2 + e < by + bh / 2 - e &&
        ay + ah / 2 - e > by - bh / 2 + e);
}
function spawnParticles(cx, cy) {
    const colors = ['#ef4444', '#fbbf24', '#fb923c', '#f87171', '#fdba74'];
    for (let i = 0; i < 18; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 2 + Math.random() * 5;
        particles.push({
            x: cx,
            y: cy,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            life: 1,
            maxLife: 1,
            r: 3 + Math.random() * 5,
            color: colors[Math.floor(Math.random() * colors.length)],
        });
    }
}
function randomLane(excludeLane) {
    const lanes = [0, 1, 2].filter(l => l !== excludeLane);
    return lanes[Math.floor(Math.random() * lanes.length)];
}
function scoreMeters() {
    return Math.floor(score / 6);
}
function updateHUD() {
    scoreDisplay.textContent = `${scoreMeters()} m`;
    bestDisplay.textContent = `${bestScore} m`;
    // Lives
    livesDisplay.textContent = '❤️'.repeat(lives) + '🖤'.repeat(3 - lives);
    // Speed bar
    const pct = ((speed - INIT_SPEED) / (MAX_SPEED - INIT_SPEED)) * 100;
    speedFill.style.width = `${Math.max(4, pct)}%`;
}
// ── Drawing ───────────────────────────────────────────────────────────────────
function drawRoad(dark) {
    const kerbColor1 = '#ef4444';
    const kerbColor2 = '#f8fafc';
    const grassL = dark ? '#14532d' : '#166534';
    const grassR = dark ? '#14532d' : '#166534';
    // Grass
    ctx.fillStyle = grassL;
    ctx.fillRect(0, 0, ROAD_L, H);
    ctx.fillStyle = grassR;
    ctx.fillRect(ROAD_R, 0, W - ROAD_R, H);
    // Kerb stripes — left
    const kerbW = 18;
    for (let y = -STRIPE_H + (kerbOffset % (STRIPE_H * 2)); y < H; y += STRIPE_H * 2) {
        ctx.fillStyle = kerbColor1;
        ctx.fillRect(ROAD_L - kerbW, y, kerbW, STRIPE_H);
        ctx.fillStyle = kerbColor2;
        ctx.fillRect(ROAD_L - kerbW, y + STRIPE_H, kerbW, STRIPE_H);
    }
    // Kerb stripes — right
    for (let y = -STRIPE_H + (kerbOffset % (STRIPE_H * 2)) + STRIPE_H; y < H; y += STRIPE_H * 2) {
        ctx.fillStyle = kerbColor1;
        ctx.fillRect(ROAD_R, y, kerbW, STRIPE_H);
        ctx.fillStyle = kerbColor2;
        ctx.fillRect(ROAD_R, y + STRIPE_H, kerbW, STRIPE_H);
    }
    // Asphalt body
    const grad = ctx.createLinearGradient(ROAD_L, 0, ROAD_R, 0);
    grad.addColorStop(0, dark ? '#1e293b' : '#374151');
    grad.addColorStop(0.5, dark ? '#263044' : '#3d4a5c');
    grad.addColorStop(1, dark ? '#1e293b' : '#374151');
    ctx.fillStyle = grad;
    ctx.fillRect(ROAD_L, 0, ROAD_W, H);
    // Road edge lines
    ctx.strokeStyle = dark ? '#94a3b8' : '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ROAD_L, 0);
    ctx.lineTo(ROAD_L, H);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ROAD_R, 0);
    ctx.lineTo(ROAD_R, H);
    ctx.stroke();
    // Lane dashes (yellow)
    const dashLen = 30;
    const gapLen = 22;
    const totalLen = dashLen + gapLen;
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([dashLen, gapLen]);
    ctx.lineDashOffset = -(dashOffset % totalLen);
    for (let i = 1; i < LANE_COUNT; i++) {
        const lx = ROAD_L + LANE_W * i;
        ctx.beginPath();
        ctx.moveTo(lx, 0);
        ctx.lineTo(lx, H);
        ctx.stroke();
    }
    ctx.setLineDash([]);
}
function drawCar(cx, cy, w, h, color, isPlayer, dark) {
    const x = cx - w / 2;
    const y = cy - h / 2;
    // Shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(x + 3, y + 6, w - 6, h - 8);
    ctx.restore();
    // Body
    ctx.fillStyle = color;
    ctx
        .roundRect(x, y, w, h, 8);
    ctx.fill();
    // Hood panel (lighter)
    const hoodColor = shadeColor(color, 30);
    ctx.fillStyle = hoodColor;
    if (isPlayer) {
        // Player faces up — hood at top
        ctx
            .roundRect(x + 5, y + 4, w - 10, h * 0.3, [4, 4, 2, 2]);
    }
    else {
        // Enemy faces down — hood at bottom
        ctx
            .roundRect(x + 5, y + h * 0.66, w - 10, h * 0.3, [2, 2, 4, 4]);
    }
    ctx.fill();
    // Roof
    ctx.fillStyle = shadeColor(color, -40);
    const roofX = x + w * 0.18;
    const roofY = y + h * 0.28;
    const roofW = w * 0.64;
    const roofH = h * 0.38;
    ctx
        .roundRect(roofX, roofY, roofW, roofH, 5);
    ctx.fill();
    // Windshields
    const windColor = dark ? 'rgba(148,163,184,0.55)' : 'rgba(186,230,253,0.7)';
    ctx.fillStyle = windColor;
    if (isPlayer) {
        // Front windshield (top)
        ctx
            .roundRect(roofX + 3, roofY + 2, roofW - 6, roofH * 0.42, 3);
        ctx.fill();
        // Rear windshield (bottom)
        ctx
            .roundRect(roofX + 3, roofY + roofH * 0.58, roofW - 6, roofH * 0.38, 3);
        ctx.fill();
    }
    else {
        // Front windshield (bottom)
        ctx
            .roundRect(roofX + 3, roofY + roofH * 0.56, roofW - 6, roofH * 0.4, 3);
        ctx.fill();
        // Rear windshield (top)
        ctx
            .roundRect(roofX + 3, roofY + 2, roofW - 6, roofH * 0.4, 3);
        ctx.fill();
    }
    // Wheels (4 corners)
    const wW = 9;
    const wH = 16;
    const wheelPositions = [
        [x - 2, y + 8],
        [x + w - wW + 2, y + 8],
        [x - 2, y + h - wH - 8],
        [x + w - wW + 2, y + h - wH - 8],
    ];
    ctx.fillStyle = '#1e293b';
    for (const [wx, wy] of wheelPositions) {
        ctx
            .roundRect(wx, wy, wW, wH, 3);
        ctx.fill();
        // Hub
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.arc(wx + wW / 2, wy + wH / 2, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1e293b';
    }
    if (isPlayer) {
        // Headlights (top — facing up)
        ctx.save();
        ctx.shadowColor = '#fef08a';
        ctx.shadowBlur = 14;
        ctx.fillStyle = '#fef9c3';
        ctx.beginPath();
        ctx.ellipse(x + 8, y + 6, 5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + w - 8, y + 6, 5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Taillights (bottom)
        ctx.save();
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#fca5a5';
        ctx.beginPath();
        ctx.ellipse(x + 8, y + h - 6, 5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + w - 8, y + h - 6, 5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    else {
        // Enemy headlights (bottom — facing down)
        ctx.save();
        ctx.shadowColor = '#fef08a';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#fef9c3';
        ctx.beginPath();
        ctx.ellipse(x + 8, y + h - 6, 5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + w - 8, y + h - 6, 5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Enemy taillights (top)
        ctx.save();
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#fca5a5';
        ctx.beginPath();
        ctx.ellipse(x + 8, y + 6, 5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + w - 8, y + 6, 5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    // Invincibility flash for player
    if (isPlayer && invTimer > 0 && Math.floor(invTimer / 6) % 2 === 0) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#fff';
        ctx
            .roundRect(x, y, w, h, 8);
        ctx.fill();
        ctx.restore();
    }
}
function drawParticles() {
    for (const p of particles) {
        ctx.save();
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (p.life / p.maxLife), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}
// ── Game logic ────────────────────────────────────────────────────────────────
function reset() {
    playerLane = 1;
    playerX = LANE_CX[1];
    targetX = LANE_CX[1];
    score = 0;
    lives = 3;
    invTimer = 0;
    frameCount = 0;
    speed = INIT_SPEED;
    enemies = [];
    particles = [];
    dashOffset = 0;
    kerbOffset = 0;
    nextSpawn = 45;
}
function showIdle() {
    overlayTitle.textContent = '🚗 Road Rush';
    overlayMsg.innerHTML =
        '<span class="sub">Dodge traffic and survive as long as you can!</span>';
    document.querySelector('.score-big')?.remove?.();
    document.querySelector('.best-line')?.remove?.();
    btnPlay.textContent = 'Start Game';
    overlay.classList.remove('hidden');
}
function showGameOver() {
    const meters = scoreMeters();
    if (meters > bestScore) {
        bestScore = meters;
        localStorage.setItem('car-best', String(bestScore));
    }
    overlayTitle.textContent = '💥 Game Over';
    overlayMsg.innerHTML = `
    <div class="score-big">${meters} m</div>
    <div class="best-line">Best: ${bestScore} m</div>
    <span class="sub">Keep dodging to improve your record!</span>
  `;
    btnPlay.textContent = 'Play Again';
    overlay.classList.remove('hidden');
}
function startGame() {
    reset();
    overlay.classList.add('hidden');
    state = 'playing';
}
btnPlay.addEventListener('click', startGame);
// ── Input ─────────────────────────────────────────────────────────────────────
function moveLeft() {
    if (state !== 'playing')
        return;
    if (playerLane > 0)
        playerLane--;
    targetX = LANE_CX[playerLane];
}
function moveRight() {
    if (state !== 'playing')
        return;
    if (playerLane < LANE_COUNT - 1)
        playerLane++;
    targetX = LANE_CX[playerLane];
}
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A')
        moveLeft();
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D')
        moveRight();
    if ((e.key === 'Enter' || e.key === ' ') && state !== 'playing')
        startGame();
});
document.getElementById('btn-left')?.addEventListener('click', moveLeft);
document.getElementById('btn-right')?.addEventListener('click', moveRight);
// Touch swipe
let touchStartX = 0;
canvas.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
}, { passive: true });
canvas.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 30) {
        if (dx < 0)
            moveLeft();
        else
            moveRight();
    }
}, { passive: true });
// ── Main loop ─────────────────────────────────────────────────────────────────
function loop() {
    requestAnimationFrame(loop);
    const dark = isDark();
    // Clear
    ctx.clearRect(0, 0, W, H);
    // Draw road (always, so it appears on idle/gameover overlays)
    drawRoad(dark);
    if (state === 'playing') {
        frameCount++;
        score++;
        // Speed ramp
        speed = Math.min(MAX_SPEED, INIT_SPEED + frameCount * 0.004);
        // Scroll offsets
        dashOffset += speed;
        kerbOffset += speed;
        // Lerp player X
        playerX += (targetX - playerX) * 0.16;
        // Spawn enemies
        if (frameCount >= nextSpawn) {
            const lastLane = enemies.length > 0
                ? enemies[enemies.length - 1].lane
                : undefined;
            enemies.push({
                lane: randomLane(lastLane),
                y: -CAR_H / 2 - 10,
                color: ENEMY_COLORS[Math.floor(Math.random() * ENEMY_COLORS.length)],
            });
            const interval = SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);
            nextSpawn = frameCount + Math.round(interval * Math.max(0.5, (MAX_SPEED - speed) / MAX_SPEED + 0.5));
        }
        // Move enemies
        for (const e of enemies) {
            e.y += speed;
        }
        // Remove off-screen enemies
        enemies = enemies.filter(e => e.y < H + CAR_H);
        // Collision detection
        if (invTimer === 0) {
            for (const e of enemies) {
                const ex = LANE_CX[e.lane];
                if (aabb(playerX, PLAYER_Y, CAR_W, CAR_H, ex, e.y, CAR_W, CAR_H)) {
                    lives--;
                    invTimer = 110;
                    spawnParticles(playerX, PLAYER_Y);
                    if (lives <= 0) {
                        state = 'gameover';
                        showGameOver();
                    }
                    break;
                }
            }
        }
        else {
            invTimer--;
        }
        // Update particles
        for (const p of particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.18; // gravity
            p.life -= 0.022;
        }
        particles = particles.filter(p => p.life > 0);
        updateHUD();
    }
    // Draw enemies
    for (const e of enemies) {
        drawCar(LANE_CX[e.lane], e.y, CAR_W, CAR_H, e.color, false, dark);
    }
    // Draw player
    drawCar(playerX, PLAYER_Y, CAR_W, CAR_H, '#6366f1', true, dark);
    // Draw particles
    drawParticles();
}
loop();
