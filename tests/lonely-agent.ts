import { assertEquals, assertInstanceOf } from "@std/assert";

import Agent, { GridAgent, GridSpace, Model } from "../index.ts";

class LonelyPlanet extends Model<GridSpace> {
  constructor() {
    super(new GridSpace());
  }
}

Deno.test("Lonely agents in an empty world", () => {
  const world = new LonelyPlanet();
  const agent = new GridAgent([0, 0]);

  assertInstanceOf(world, Model);
  assertEquals(world.toString(), "LonelyPlanet<GridSpace>: 0 agents");
  assertInstanceOf(agent, Agent);
  assertEquals(world.push(agent), 1);
  assertEquals(world.toString(), "LonelyPlanet<GridSpace>: 1 agent");
});
