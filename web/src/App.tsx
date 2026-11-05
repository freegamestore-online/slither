import { useEffect, useRef, useCallback, useState } from "react";
import { GameShell, GameTopbar, GameAuth } from "@freegamestore/games";
import { WORLD_RADIUS, WORLD_SIZE, SNAKE_RADIUS, createGame, step, type GameState } from "./game";

const MINIMAP_SIZE = 140;
const MINIMAP_MARGIN = 16;

// --- Component ---
type Screen = "playing" | "gameover";

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
    gameRef.current = createGame();
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
        const head = game.player.body[0];
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

    const drawGame = (game: GameState) => {
      const w = canvas.width;
      const h = canvas.height;

      // Camera
      const head = game.player.body[0];
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
        if (isPlayer && snake.body.length > 0) {
          const h0 = snake.body[0];
          const gsx = h0.x - camX;
          const gsy = h0.y - camY;
          const bodyGlow = ctx.createRadialGradient(gsx, gsy, 0, gsx, gsy, 80);
          bodyGlow.addColorStop(0, snake.color + "18");
          bodyGlow.addColorStop(1, "transparent");
          ctx.fillStyle = bodyGlow;
          ctx.fillRect(gsx - 80, gsy - 80, 160, 160);
        }

        // Draw body parts (back to front) with stripe pattern
        for (let i = snake.body.length - 1; i >= 0; i--) {
          const seg = snake.body[i];
          if (seg.x < vpLeft || seg.x > vpRight || seg.y < vpTop || seg.y > vpBottom) continue;
          const sx = seg.x - camX;
          const sy = seg.y - camY;
          const taper = 1 - (i / snake.body.length) * 0.4;
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
        const headSeg = snake.body[0];
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
        const s = snake.body[0];
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

      step(game);

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

  const togglePause = useCallback(() => {
    setPaused(p => {
      pausedRef.current = !p;
      return !p;
    });
  }, []);

  const rulesContent = <div><h3 style={{fontWeight:700}}>Slither</h3><h4 style={{fontWeight:600}}>Controls</h4><ul><li>Mouse/touch to steer</li><li>Click/hold to boost (costs length)</li></ul><h4 style={{fontWeight:600}}>Rules</h4><ul><li>Eat orbs to grow</li><li>Avoid hitting other snakes</li><li>Boost speeds you up but costs length</li></ul></div>;

  return (
    <GameShell
      topbar={
        <GameTopbar
          title="Slither"
          stats={[{ label: "Score", value: screen === "gameover" ? finalScore : (scoreRef.current || 0), accent: true }]}
          onPlayPause={screen === "playing" ? togglePause : undefined}
          paused={paused}
          onRestart={startGame}
          rules={rulesContent}
          actions={<GameAuth />}
        />
      }
    >
      <div className="relative w-full h-full">
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            cursor: "crosshair",
          }}
        />
        {screen === "gameover" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4" style={{ background: "rgba(0,0,0,0.6)" }}>
            <p className="text-xl font-bold" style={{ color: "var(--error)", fontFamily: "Fraunces, serif" }}>
              Game Over! Score: {finalScore}
            </p>
            <button
              onClick={startGame}
              className="px-6 py-3 rounded-xl font-semibold min-h-[2.75rem]"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              Play Again
            </button>
          </div>
        )}
      </div>
    </GameShell>
  );
}
