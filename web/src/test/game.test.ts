import { describe, it, expect } from "vitest";
import { FOOD_COUNT, createGame, step } from "../game";

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
});
