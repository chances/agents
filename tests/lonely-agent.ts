import { assertEquals, assertInstanceOf } from "@std/assert";

import Agent, { GridAgent, GridWorld, Model } from "../index.ts";

class LonelyPlanet extends Model<GridWorld> {
  constructor() {
    super(new GridWorld());
  }
}

Deno.test("Lonely agents in an empty world", () => {
  const world = new LonelyPlanet();
  const agent = new GridAgent([0, 0]);

  assertInstanceOf(world, Model);
  assertEquals(world.toString(), "LonelyPlanet<GridWorld>: 0 agents");
  assertInstanceOf(agent, Agent);
  assertEquals(world.push(agent), 1);
  assertEquals(world.toString(), "LonelyPlanet<GridWorld>: 1 agent");
});
