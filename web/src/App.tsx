import { useEffect, useRef, useCallback, useState } from "react";
import { GameShell, GameTopbar } from "@freegamestore/games";

// --- Types ---
interface Vec2 {
  x: number;
  y: number;
}

interface Snake {
  id: number;
  segments: Vec2[];
  color: string;
  speed: number;
  angle: number;
  alive: boolean;
  boosting: boolean;
  score: number;
}

interface Food {
  x: number;
  y: number;
  color: string;
  radius: number;
}

interface GameState {
  player: Snake;
  bots: Snake[];
  food: Food[];
  mousePos: Vec2;
  camera: Vec2;
  gameOver: boolean;
  started: boolean;
}

// --- Constants ---
const WORLD_SIZE = 3000;
const WORLD_RADIUS = WORLD_SIZE / 2;
const SEGMENT_SPACING = 8;
const BASE_SPEED = 3;
const BOOST_SPEED = 6;
const FOOD_COUNT = 300;
const BOT_COUNT = 6;
const SNAKE_RADIUS = 8;
const FOOD_RADIUS = 5;
const INITIAL_LENGTH = 20;
const MINIMAP_SIZE = 140;
const MINIMAP_MARGIN = 16;

const SNAKE_COLORS = [
  "#ff3366", "#33ff66", "#3366ff", "#ffcc33",
  "#ff66cc", "#66ffcc", "#cc66ff", "#ff9933",
];

// --- Helpers ---
function randomInCircle(radius: number): Vec2 {
  const angle = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * radius * 0.85;
  return { x: WORLD_RADIUS + Math.cos(angle) * r, y: WORLD_RADIUS + Math.sin(angle) * r };
}

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleTo(from: Vec2, to: Vec2): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function createFood(): Food {
  const pos = randomInCircle(WORLD_RADIUS);
  const colors = ["#ff4488", "#44ff88", "#4488ff", "#ffaa44", "#ff44ff", "#44ffff", "#ffff44"];
  return { x: pos.x, y: pos.y, color: colors[Math.floor(Math.random() * colors.length)], radius: FOOD_RADIUS };
}

function createSnake(id: number, color: string): Snake {
  const pos = randomInCircle(WORLD_RADIUS * 0.7);
  const angle = Math.random() * Math.PI * 2;
  const segments: Vec2[] = [];
  for (let i = 0; i < INITIAL_LENGTH; i++) {
    segments.push({
      x: pos.x - Math.cos(angle) * i * SEGMENT_SPACING,
      y: pos.y - Math.sin(angle) * i * SEGMENT_SPACING,
    });
  }
  return { id, segments, color, speed: BASE_SPEED, angle, alive: true, boosting: false, score: INITIAL_LENGTH };
}

// --- Component ---
type Screen = "start" | "playing" | "gameover";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const animRef = useRef<number>(0);
  const [screen, setScreen] = useState<Screen>("playing");
  const [paused, setPaused] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const scoreRef = useRef(0);
  const pausedRef = useRef(false);

  const initGame = useCallback(() => {
    const player = createSnake(0, "#00ff88");
    const bots: Snake[] = [];
    for (let i = 0; i < BOT_COUNT; i++) {
      bots.push(createSnake(i + 1, SNAKE_COLORS[i % SNAKE_COLORS.length]));
    }
    const food: Food[] = [];
    for (let i = 0; i < FOOD_COUNT; i++) {
      food.push(createFood());
    }
    const head = player.segments[0];
    gameRef.current = {
      player,
      bots,
      food,
      mousePos: { x: head.x, y: head.y },
      camera: { x: head.x, y: head.y },
      gameOver: false,
      started: true,
    };
  }, []);

  const startGame = useCallback(() => {
    initGame();
    setScreen("playing");
  }, [initGame]);

  // Initialize game state on mount
  useEffect(() => {
    initGame();
  }, [initGame]);

  // Input handlers
  useEffect(() => {
    if (screen !== "playing") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateMouse = (clientX: number, clientY: number) => {
      const game = gameRef.current;
      if (!game || game.gameOver) return;
      const rect = canvas.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const dx = clientX - rect.left - cx;
      const dy = clientY - rect.top - cy;
      // Convert screen offset to world position relative to camera
      game.mousePos = { x: game.camera.x + dx, y: game.camera.y + dy };
    };

    const onMouseMove = (e: MouseEvent) => updateMouse(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const t = e.touches[0];
        updateMouse(t.clientX, t.clientY);
      }
      e.preventDefault();
    };
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const t = e.touches[0];
        updateMouse(t.clientX, t.clientY);
      }
      if (e.touches.length >= 2) {
        const game = gameRef.current;
        if (game) game.player.boosting = true;
      }
      e.preventDefault();
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        const game = gameRef.current;
        if (game) game.player.boosting = false;
      }
    };
    const onMouseDown = () => {
      const game = gameRef.current;
      if (game) game.player.boosting = true;
    };
    const onMouseUp = () => {
      const game = gameRef.current;
      if (game) game.player.boosting = false;
    };

    // Keyboard support: arrow keys set direction, space = boost
    const keysDown = new Set<string>();
    const KEYBOARD_DIST = 300;
    const onKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
      keysDown.add(e.key);
      if (e.key === ' ') {
        const game = gameRef.current;
        if (game) game.player.boosting = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysDown.delete(e.key);
      if (e.key === ' ') {
        const game = gameRef.current;
        if (game) game.player.boosting = false;
      }
    };
    // Poll keyboard direction each frame via an interval
    const keyInterval = setInterval(() => {
      const game = gameRef.current;
      if (!game || game.gameOver) return;
      let dx = 0, dy = 0;
      if (keysDown.has('ArrowLeft')) dx -= 1;
      if (keysDown.has('ArrowRight')) dx += 1;
      if (keysDown.has('ArrowUp')) dy -= 1;
      if (keysDown.has('ArrowDown')) dy += 1;
      if (dx !== 0 || dy !== 0) {
        const head = game.player.segments[0];
        game.mousePos = { x: head.x + dx * KEYBOARD_DIST, y: head.y + dy * KEYBOARD_DIST };
      }
    }, 16);

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      clearInterval(keyInterval);
    };
  }, [screen]);

  // Game loop
  useEffect(() => {
    if (screen !== "playing") return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const moveSnake = (snake: Snake, targetAngle: number) => {
      if (!snake.alive) return;

      // Smooth turning
      let diff = normalizeAngle(targetAngle - snake.angle);
      const turnRate = 0.08;
      snake.angle += diff * turnRate;

      const speed = snake.boosting ? BOOST_SPEED : BASE_SPEED;
      snake.speed = speed;

      // Move head
      const head = snake.segments[0];
      const newHead = {
        x: head.x + Math.cos(snake.angle) * speed,
        y: head.y + Math.sin(snake.angle) * speed,
      };
      snake.segments.unshift(newHead);

      // Maintain segment spacing
      while (snake.segments.length > snake.score) {
        snake.segments.pop();
      }

      // Boosting shrinks
      if (snake.boosting && snake.score > 10) {
        if (Math.random() < 0.1) {
          snake.score--;
          if (snake.segments.length > snake.score) {
            snake.segments.pop();
          }
        }
      }
    };

    const checkBoundary = (snake: Snake, game: GameState) => {
      if (!snake.alive) return;
      const head = snake.segments[0];
      const d = dist(head, { x: WORLD_RADIUS, y: WORLD_RADIUS });
      if (d > WORLD_RADIUS) {
        killSnake(snake, game);
      }
    };

    const killSnake = (snake: Snake, game: GameState) => {
      snake.alive = false;
      // Drop food along body
      for (let i = 0; i < snake.segments.length; i += 3) {
        const seg = snake.segments[i];
        game.food.push({
          x: seg.x + (Math.random() - 0.5) * 10,
          y: seg.y + (Math.random() - 0.5) * 10,
          color: snake.color,
          radius: FOOD_RADIUS + 1,
        });
      }
    };

    const checkFoodCollision = (snake: Snake, game: GameState) => {
      if (!snake.alive) return;
      const head = snake.segments[0];
      for (let i = game.food.length - 1; i >= 0; i--) {
        const f = game.food[i];
        if (dist(head, f) < SNAKE_RADIUS + f.radius) {
          game.food.splice(i, 1);
          snake.score += 2;
          // Replenish food
          game.food.push(createFood());
        }
      }
    };

    const checkSnakeCollision = (snake: Snake, allSnakes: Snake[], game: GameState) => {
      if (!snake.alive) return;
      const head = snake.segments[0];
      for (const other of allSnakes) {
        if (other.id === snake.id || !other.alive) continue;
        // Check head vs other body (skip head of other)
        for (let i = 1; i < other.segments.length; i++) {
          const seg = other.segments[i];
          if (dist(head, seg) < SNAKE_RADIUS * 2) {
            killSnake(snake, game);
            return;
          }
        }
      }
    };

    const updateBot = (bot: Snake, game: GameState) => {
      if (!bot.alive) return;

      const head = bot.segments[0];

      // Find nearest food
      let nearestFood: Food | null = null;
      let nearestDist = Infinity;
      for (const f of game.food) {
        const d = dist(head, f);
        if (d < nearestDist) {
          nearestDist = d;
          nearestFood = f;
        }
      }

      let targetAngle = bot.angle;
      if (nearestFood) {
        targetAngle = angleTo(head, nearestFood);
      }

      // Avoid boundary
      const distToCenter = dist(head, { x: WORLD_RADIUS, y: WORLD_RADIUS });
      if (distToCenter > WORLD_RADIUS * 0.8) {
        targetAngle = angleTo(head, { x: WORLD_RADIUS, y: WORLD_RADIUS });
      }

      // Avoid other snakes (simple)
      const allSnakes = [game.player, ...game.bots];
      for (const other of allSnakes) {
        if (other.id === bot.id || !other.alive) continue;
        for (let i = 0; i < Math.min(other.segments.length, 20); i++) {
          const seg = other.segments[i];
          const d = dist(head, seg);
          if (d < 60) {
            const away = angleTo(seg, head);
            targetAngle = away;
            break;
          }
        }
      }

      moveSnake(bot, targetAngle);
    };

    const respawnBot = (bot: Snake) => {
      const pos = randomInCircle(WORLD_RADIUS * 0.7);
      const angle = Math.random() * Math.PI * 2;
      bot.segments = [];
      for (let i = 0; i < INITIAL_LENGTH; i++) {
        bot.segments.push({
          x: pos.x - Math.cos(angle) * i * SEGMENT_SPACING,
          y: pos.y - Math.sin(angle) * i * SEGMENT_SPACING,
        });
      }
      bot.angle = angle;
      bot.alive = true;
      bot.score = INITIAL_LENGTH;
      bot.boosting = false;
    };

    const drawGame = (game: GameState) => {
      const w = canvas.width;
      const h = canvas.height;

      // Camera
      const head = game.player.segments[0];
      game.camera.x += (head.x - game.camera.x) * 0.1;
      game.camera.y += (head.y - game.camera.y) * 0.1;
      const camX = game.camera.x - w / 2;
      const camY = game.camera.y - h / 2;

      // Background gradient
      const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.8);
      bgGrad.addColorStop(0, "#0d1117");
      bgGrad.addColorStop(1, "#010409");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Hex grid pattern
      ctx.strokeStyle = "rgba(100,180,255,0.04)";
      ctx.lineWidth = 0.5;
      const gridSize = 60;
      const startX = -((camX % gridSize) + gridSize) % gridSize;
      const startY = -((camY % (gridSize * 0.866)) + gridSize * 0.866) % (gridSize * 0.866);
      for (let y = startY; y < h + gridSize; y += gridSize * 0.866) {
        const rowOffset = (Math.round((y + camY) / (gridSize * 0.866)) % 2) * (gridSize / 2);
        for (let x = startX - gridSize + rowOffset; x < w + gridSize; x += gridSize) {
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (Math.PI / 3) * i - Math.PI / 6;
            const px = x + Math.cos(a) * (gridSize * 0.35);
            const py = y + Math.sin(a) * (gridSize * 0.35);
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }

      // Arena boundary — glowing ring
      const centerScreenX = WORLD_RADIUS - camX;
      const centerScreenY = WORLD_RADIUS - camY;
      for (let i = 3; i >= 0; i--) {
        ctx.beginPath();
        ctx.arc(centerScreenX, centerScreenY, WORLD_RADIUS + i * 4, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,60,60,${0.08 + i * 0.05})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Viewport bounds for culling
      const vpLeft = camX - 50;
      const vpRight = camX + w + 50;
      const vpTop = camY - 50;
      const vpBottom = camY + h + 50;

      // Food with glow
      for (const f of game.food) {
        if (f.x < vpLeft || f.x > vpRight || f.y < vpTop || f.y > vpBottom) continue;
        const sx = f.x - camX;
        const sy = f.y - camY;
        // Outer glow
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, f.radius * 4);
        glow.addColorStop(0, f.color + "40");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fillRect(sx - f.radius * 4, sy - f.radius * 4, f.radius * 8, f.radius * 8);
        // Core
        ctx.beginPath();
        ctx.arc(sx, sy, f.radius, 0, Math.PI * 2);
        ctx.fillStyle = f.color;
        ctx.fill();
        // Inner highlight
        ctx.beginPath();
        ctx.arc(sx - f.radius * 0.2, sy - f.radius * 0.2, f.radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fill();
      }

      // Draw snakes with glow, gradient, and shine
      const allSnakes = [game.player, ...game.bots];
      for (const snake of allSnakes) {
        if (!snake.alive) continue;
        const isPlayer = snake.id === 0;

        // Body glow (player only for performance)
        if (isPlayer && snake.segments.length > 0) {
          const h0 = snake.segments[0];
          const gsx = h0.x - camX;
          const gsy = h0.y - camY;
          const bodyGlow = ctx.createRadialGradient(gsx, gsy, 0, gsx, gsy, 80);
          bodyGlow.addColorStop(0, snake.color + "18");
          bodyGlow.addColorStop(1, "transparent");
          ctx.fillStyle = bodyGlow;
          ctx.fillRect(gsx - 80, gsy - 80, 160, 160);
        }

        // Draw body segments (back to front) with stripe pattern
        for (let i = snake.segments.length - 1; i >= 0; i--) {
          const seg = snake.segments[i];
          if (seg.x < vpLeft || seg.x > vpRight || seg.y < vpTop || seg.y > vpBottom) continue;
          const sx = seg.x - camX;
          const sy = seg.y - camY;
          const taper = 1 - (i / snake.segments.length) * 0.4;
          const radius = Math.max(SNAKE_RADIUS * taper, 3);

          // Shadow/outline
          ctx.beginPath();
          ctx.arc(sx, sy, radius + 1, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(0,0,0,0.3)";
          ctx.fill();

          // Main body — alternating stripe brightness
          ctx.beginPath();
          ctx.arc(sx, sy, radius, 0, Math.PI * 2);
          const bright = i % 4 < 2 ? 1 : 0.8;
          ctx.globalAlpha = bright;
          ctx.fillStyle = snake.color;
          ctx.fill();

          // Shine highlight on top
          if (i % 3 === 0) {
            ctx.beginPath();
            ctx.arc(sx - radius * 0.2, sy - radius * 0.3, radius * 0.35, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(255,255,255,0.2)";
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }

        // Head — larger with gradient
        const headSeg = snake.segments[0];
        const hsx = headSeg.x - camX;
        const hsy = headSeg.y - camY;
        if (hsx > -50 && hsx < w + 50 && hsy > -50 && hsy < h + 50) {
          const headR = SNAKE_RADIUS * 1.2;
          const headGrad = ctx.createRadialGradient(hsx - 2, hsy - 2, 0, hsx, hsy, headR);
          headGrad.addColorStop(0, "#fff3");
          headGrad.addColorStop(0.3, snake.color);
          headGrad.addColorStop(1, snake.color + "cc");
          ctx.beginPath();
          ctx.arc(hsx, hsy, headR, 0, Math.PI * 2);
          ctx.fillStyle = headGrad;
          ctx.fill();

          // Eyes
          const eyeOffset = 5;
          const eyeR = 3.5;
          const pupilR = 2;
          const eyeAngle1 = snake.angle + 0.5;
          const eyeAngle2 = snake.angle - 0.5;
          for (const ea of [eyeAngle1, eyeAngle2]) {
            const ex = hsx + Math.cos(ea) * eyeOffset;
            const ey = hsy + Math.sin(ea) * eyeOffset;
            // White
            ctx.beginPath();
            ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
            ctx.fillStyle = "#fff";
            ctx.fill();
            // Pupil
            ctx.beginPath();
            ctx.arc(ex + Math.cos(snake.angle) * 1.2, ey + Math.sin(snake.angle) * 1.2, pupilR, 0, Math.PI * 2);
            ctx.fillStyle = "#111";
            ctx.fill();
            // Catchlight
            ctx.beginPath();
            ctx.arc(ex - 0.5, ey - 0.5, 1, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(255,255,255,0.8)";
            ctx.fill();
          }
        }
      }

      // Minimap — rounded with glass effect
      const mmX = w - MINIMAP_SIZE - MINIMAP_MARGIN;
      const mmY = h - MINIMAP_SIZE - MINIMAP_MARGIN;
      const mmR = 8;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(mmX, mmY, MINIMAP_SIZE, MINIMAP_SIZE, mmR);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.clip();

      const mmScale = MINIMAP_SIZE / WORLD_SIZE;
      ctx.beginPath();
      ctx.arc(mmX + MINIMAP_SIZE / 2, mmY + MINIMAP_SIZE / 2, WORLD_RADIUS * mmScale, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,80,80,0.4)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      for (const snake of allSnakes) {
        if (!snake.alive) continue;
        const s = snake.segments[0];
        const mx = mmX + s.x * mmScale;
        const my = mmY + s.y * mmScale;
        ctx.beginPath();
        ctx.arc(mx, my, snake.id === 0 ? 4 : 2, 0, Math.PI * 2);
        ctx.fillStyle = snake.color;
        ctx.fill();
        if (snake.id === 0) {
          ctx.beginPath();
          ctx.arc(mx, my, 6, 0, Math.PI * 2);
          ctx.strokeStyle = snake.color + "60";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      ctx.restore();

      // Score relayed to topbar via stats prop — no in-canvas HUD
    };

    const loop = () => {
      if (!running) return;
      const game = gameRef.current;
      if (!game || game.gameOver) {
        animRef.current = requestAnimationFrame(loop);
        return;
      }

      if (pausedRef.current) {
        drawGame(game);
        animRef.current = requestAnimationFrame(loop);
        return;
      }

      // Move player
      const head = game.player.segments[0];
      const targetAngle = angleTo(head, game.mousePos);
      moveSnake(game.player, targetAngle);

      // Update bots
      for (const bot of game.bots) {
        if (!bot.alive) {
          // Respawn after some time (just respawn immediately for simplicity)
          if (Math.random() < 0.01) {
            respawnBot(bot);
          }
          continue;
        }
        updateBot(bot, game);
      }

      // Check food collisions
      const allSnakes = [game.player, ...game.bots];
      for (const snake of allSnakes) {
        checkFoodCollision(snake, game);
      }

      // Check snake collisions
      for (const snake of allSnakes) {
        checkSnakeCollision(snake, allSnakes, game);
      }

      // Check boundary
      for (const snake of allSnakes) {
        checkBoundary(snake, game);
      }

      // Check player death
      if (!game.player.alive) {
        game.gameOver = true;
        scoreRef.current = game.player.score;
        setFinalScore(game.player.score);
        setScreen("gameover");
      }

      // Draw
      drawGame(game);

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [screen]);

  if (screen === "gameover") {
    return (
      <GameShell
        topbar={
          <GameTopbar
            title="Slither"
            stats={[{ label: "Score", value: finalScore, accent: true }]}
            onRestart={startGame}
            rules={<div><h3 style={{fontWeight:700}}>Slither</h3><h4 style={{fontWeight:600}}>Controls</h4><ul><li>Mouse/touch to steer</li><li>Click/hold or two-finger tap to boost (costs length)</li><li>Arrow keys also work</li></ul><h4 style={{fontWeight:600}}>Rules</h4><ul><li>Eat glowing orbs to grow longer</li><li>Avoid hitting other snakes</li><li>Use boost to speed up (costs length)</li><li>Last snake alive wins</li></ul></div>}
          />
        }
      >
        <div className="flex flex-col items-center justify-center h-full gap-6">
          <h1
            className="text-4xl font-bold"
            style={{ fontFamily: "Fraunces, serif" }}
          >
            Game Over
          </h1>
          <p
            className="text-2xl"
            style={{ fontFamily: "Fraunces, serif" }}
          >
            Score: {finalScore}
          </p>
          <button
            onClick={startGame}
            className="px-8 py-4 text-lg font-bold text-white rounded-xl cursor-pointer"
            style={{ background: "var(--accent)", borderRadius: "0.75rem" }}
          >
            Play Again
          </button>
        </div>
      </GameShell>
    );
  }

  const togglePause = useCallback(() => {
    setPaused(p => {
      pausedRef.current = !p;
      return !p;
    });
  }, []);

  // Playing
  return (
    <GameShell
      topbar={
        <GameTopbar
          title="Slither"
          stats={[{ label: "Score", value: gameRef.current?.player.score ?? 0, accent: true }]}
          onPlayPause={togglePause}
          paused={paused}
          onRestart={startGame}
          rules={<div><h3 style={{fontWeight:700}}>Slither</h3><h4 style={{fontWeight:600}}>Controls</h4><ul><li>Mouse/touch to steer</li><li>Click/hold or two-finger tap to boost (costs length)</li><li>Arrow keys also work</li></ul><h4 style={{fontWeight:600}}>Rules</h4><ul><li>Eat glowing orbs to grow longer</li><li>Avoid hitting other snakes</li><li>Use boost to speed up (costs length)</li><li>Last snake alive wins</li></ul></div>}
        />
      }
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          cursor: "crosshair",
        }}
      />
    </GameShell>
  );
}
