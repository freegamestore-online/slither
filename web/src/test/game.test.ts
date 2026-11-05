import { describe, it, expect } from "vitest";
import { FOOD_COUNT, STEP_MS, WORLD_RADIUS, createGame, fixedSteps, step, type GameState } from "../game";

// Player alone at the arena centre heading +x, so runs are deterministic.
function soloGame(): GameState {
  const g = createGame();
  g.bots = [];
  g.player.angle = 0;
  g.player.body = g.player.body.map((_, i) => ({ x: WORLD_RADIUS - i * 8, y: WORLD_RADIUS }));
  g.steerAngle = 0;
  return g;
}

describe("slither game", () => {
  it("creates a player, 6 bots and a full food field", () => {
    const g = createGame();
    expect(g.player.alive).toBe(true);
    expect(g.bots).toHaveLength(6);
    expect(g.food).toHaveLength(FOOD_COUNT);
  });

  it("moves the player head each step", () => {
    const g = createGame();
    const before = { ...g.player.body[0] };
    step(g);
    expect(g.player.body[0]).not.toEqual(before);
  });

  it("holds a straight heading when the steer direction doesn't change (no circling)", () => {
    const g = soloGame();
    g.food = [];
    g.steerAngle = Math.PI / 2;
    for (let i = 0; i < 120; i++) step(g);
    const a = g.player.angle;
    for (let i = 0; i < 60; i++) step(g);
    expect(g.player.angle).toBeCloseTo(Math.PI / 2, 3);
    expect(g.player.angle).toBeCloseTo(a, 3);
  });

  it("does not replace eaten food while the field is over its cap", () => {
    const g = soloGame();
    const head = g.player.body[0];
    g.food.push({ x: head.x + 3, y: head.y, color: "#fff", radius: 6 }); // dropped by a dead snake
    expect(g.food).toHaveLength(FOOD_COUNT + 1);
    step(g);
    expect(g.player.score).toBeGreaterThan(20);
    expect(g.food).toHaveLength(FOOD_COUNT);
  });
});

describe("fixedSteps", () => {
  it("runs one step per 60 Hz frame", () => {
    expect(fixedSteps(0, STEP_MS).steps).toBe(1);
  });

  it("runs one step per two 120 Hz frames", () => {
    const a = fixedSteps(0, STEP_MS / 2);
    const b = fixedSteps(a.acc, STEP_MS / 2);
    expect(a.steps + b.steps).toBe(1);
  });

  it("caps catch-up after a stall", () => {
    expect(fixedSteps(0, 5000).steps).toBe(5);
  });
});
