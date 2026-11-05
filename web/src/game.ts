// --- Types ---
export interface Vec2 {
  x: number;
  y: number;
}

export interface Snake {
  id: number;
  body: Vec2[];
  color: string;
  speed: number;
  angle: number;
  alive: boolean;
  boosting: boolean;
  score: number;
}

export interface Food {
  x: number;
  y: number;
  color: string;
  radius: number;
}

export interface GameState {
  player: Snake;
  bots: Snake[];
  food: Food[];
  // Heading the player steers toward (radians). Input sets a direction, not
  // a world point, so a still pointer keeps the snake going straight.
  steerAngle: number;
  camera: Vec2;
  gameOver: boolean;
}

// --- Constants ---
export const WORLD_SIZE = 3000;
export const WORLD_RADIUS = WORLD_SIZE / 2;
const SEGMENT_SPACING = 8;
const BASE_SPEED = 3;
const BOOST_SPEED = 6;
export const FOOD_COUNT = 300;
const BOT_COUNT = 6;
export const SNAKE_RADIUS = 8;
const FOOD_RADIUS = 5;
const INITIAL_LENGTH = 20;

// The sim is tuned per 60 Hz tick (speeds, turn rate and segment spacing
// are all per tick), so it runs on a fixed 60 Hz step whatever the display
// refresh rate. Cap catch-up so a stall doesn't fast-forward the game.
export const STEP_MS = 1000 / 60;
const MAX_STEPS_PER_FRAME = 5;

export function fixedSteps(acc: number, dtMs: number): { steps: number; acc: number } {
  const total = Math.min(acc + dtMs, STEP_MS * MAX_STEPS_PER_FRAME);
  const steps = Math.floor(total / STEP_MS);
  return { steps, acc: total - steps * STEP_MS };
}

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
  const body: Vec2[] = [];
  for (let i = 0; i < INITIAL_LENGTH; i++) {
    body.push({
      x: pos.x - Math.cos(angle) * i * SEGMENT_SPACING,
      y: pos.y - Math.sin(angle) * i * SEGMENT_SPACING,
    });
  }
  return { id, body, color, speed: BASE_SPEED, angle, alive: true, boosting: false, score: INITIAL_LENGTH };
}

const moveSnake = (snake: Snake, targetAngle: number) => {
  if (!snake.alive) return;

  // Smooth turning
  let diff = normalizeAngle(targetAngle - snake.angle);
  const turnRate = 0.08;
  snake.angle += diff * turnRate;

  const speed = snake.boosting ? BOOST_SPEED : BASE_SPEED;
  snake.speed = speed;

  // Move head
  const head = snake.body[0];
  const newHead = {
    x: head.x + Math.cos(snake.angle) * speed,
    y: head.y + Math.sin(snake.angle) * speed,
  };
  snake.body.unshift(newHead);

  // Maintain body spacing
  while (snake.body.length > snake.score) {
    snake.body.pop();
  }

  // Boosting shrinks
  if (snake.boosting && snake.score > 10) {
    if (Math.random() < 0.1) {
      snake.score--;
      if (snake.body.length > snake.score) {
        snake.body.pop();
      }
    }
  }
};

const checkBoundary = (snake: Snake, game: GameState) => {
  if (!snake.alive) return;
  const head = snake.body[0];
  const d = dist(head, { x: WORLD_RADIUS, y: WORLD_RADIUS });
  if (d > WORLD_RADIUS) {
    killSnake(snake, game);
  }
};

export const killSnake = (snake: Snake, game: GameState) => {
  snake.alive = false;
  // Drop food along body
  for (let i = 0; i < snake.body.length; i += 3) {
    const seg = snake.body[i];
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
  const head = snake.body[0];
  for (let i = game.food.length - 1; i >= 0; i--) {
    const f = game.food[i];
    if (dist(head, f) < SNAKE_RADIUS + f.radius) {
      game.food.splice(i, 1);
      snake.score += 2;
      // Replenish food, but don't replace food dropped by dead snakes or
      // the field grows without bound.
      if (game.food.length < FOOD_COUNT) game.food.push(createFood());
    }
  }
};

const checkSnakeCollision = (snake: Snake, allSnakes: Snake[], game: GameState) => {
  if (!snake.alive) return;
  const head = snake.body[0];
  for (const other of allSnakes) {
    if (other.id === snake.id || !other.alive) continue;
    // Check head vs other body (skip head of other)
    for (let i = 1; i < other.body.length; i++) {
      const seg = other.body[i];
      if (dist(head, seg) < SNAKE_RADIUS * 2) {
        killSnake(snake, game);
        return;
      }
    }
  }
};

const updateBot = (bot: Snake, game: GameState) => {
  if (!bot.alive) return;

  const head = bot.body[0];

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
    for (let i = 0; i < Math.min(other.body.length, 20); i++) {
      const seg = other.body[i];
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
  bot.body = [];
  for (let i = 0; i < INITIAL_LENGTH; i++) {
    bot.body.push({
      x: pos.x - Math.cos(angle) * i * SEGMENT_SPACING,
      y: pos.y - Math.sin(angle) * i * SEGMENT_SPACING,
    });
  }
  bot.angle = angle;
  bot.alive = true;
  bot.score = INITIAL_LENGTH;
  bot.boosting = false;
};

export function createGame(): GameState {
  const player = createSnake(0, "#00ff88");
  const bots: Snake[] = [];
  for (let i = 0; i < BOT_COUNT; i++) {
    bots.push(createSnake(i + 1, SNAKE_COLORS[i % SNAKE_COLORS.length]));
  }
  const food: Food[] = [];
  for (let i = 0; i < FOOD_COUNT; i++) {
    food.push(createFood());
  }
  const head = player.body[0];
  return {
    player,
    bots,
    food,
    steerAngle: player.angle,
    camera: { x: head.x, y: head.y },
    gameOver: false,
  };
}

// Advance the simulation one tick: player, bots, then collisions.
export function step(game: GameState) {
  moveSnake(game.player, game.steerAngle);

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

  // Camera follows the head
  const head = game.player.body[0];
  game.camera.x += (head.x - game.camera.x) * 0.1;
  game.camera.y += (head.y - game.camera.y) * 0.1;
}
