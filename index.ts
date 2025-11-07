import { assert, assertEquals, assertGreater, unimplemented } from "@std/assert";
// Polyfill JS `Iterator` helpers. See https://github.com/tc39/ecma262/pull/3395
import "es-iterator-helpers/auto";

let lastModelId = -1;
const worlds = new Map<number, World>();

type AgentStepFn<W extends World, A extends Agent> = (agent: A, model: Model<W, A>) => void;
type ModelStepFn<W extends World, A extends Agent> = (model: Model<W, A>) => void;

interface ModelSteps<W extends World, A extends Agent = Agent> {
  agentStep?: AgentStepFn<W, A>;
  modelStep?: ModelStepFn<W, A>;
  agentsFirst?: boolean;
}

/** All models are some concrete implementation of `Model`. */
export abstract class Model<W extends World, A extends Agent = Agent> {
  private readonly ThisModel = this;

  public readonly id: number = (lastModelId += 1);
  protected _time = 0;
  protected _agents: A[] = [];
  private readonly agentStep: AgentStepFn<W, A> | null;
  private readonly modelStep: ModelStepFn<W, A> | null;
  private readonly agentsFirst: boolean;

  /**
   * Creates a new agent-based model.
   * @param {W} [world] The world to model.
   * @param {AgentStepFn<Model<W, A>, A>} [steps.agentStep]
   * @param {ModelStepFn<Model<W, A>>} [steps.modelStep]
   * @param {boolean} [steps.agentsFirst] Whether to schedule agents first and then call `modelStep`. Ignored if no
   * `agentStep` is given.
   */
  constructor(
    public readonly world: W,
    steps: ModelSteps<W, A> | Omit<ModelSteps<W, A>, "agentStep"> | Omit<ModelSteps<W, A>, "modelStep"> = { agentsFirst: true },
  ) {
    this.agentStep = (steps as ModelSteps<W, A>).agentStep || null;
    this.modelStep = (steps as ModelSteps<W, A>).modelStep || null;
    this.agentsFirst = steps.agentsFirst === undefined ? true : steps.agentsFirst;
    assert(this.agentStep || this.modelStep, "At least one of `agentStep` or `modelStep` must be given.");

    worlds.set(this.id, world);

    // See https://stackoverflow.com/a/25658975/1363247
    return new Proxy(this, {
      get(target, name) {
        // Try to index the internal list of agents
        const index = typeof name === "string" ? parseInt(name) : Number.NaN;
        if (Number.isNaN(index) !== true) return target._agents[index];
        // Otherwise, defer to the model
        // deno-lint-ignore no-explicit-any
        const model = target as Record<string | symbol, any>;
        return model[name];
      },
    });
  }

  [Symbol.dispose]() {
    worlds.delete(this.id);
  }

  /**
   * @returns The current time of this model.
   * @remarks All models start from time `0` and is incremented when `step`-ped.
   */
  get time(): number {
    return this._time;
  }

  /** @returns The number of agents in this model. This is a number one higher then the highest index in this collection. */
  get length(): number {
    return this._agents.length;
  }

  /** @returns An iterator over all of the agents in this model. */
  get agents(): Iterator<A> {
    return this._agents[Symbol.iterator]();
  }

  [Symbol.iterator](): Iterator<A> {
    return this.agents;
  }

  [Symbol.toPrimitive](hint: "number" | "string" | "default"): number | string | Agent[] {
    if (hint === "number") return this.length;
    if (hint === "string") return this.toString();
    // Copy the internal array of agents
    return this._agents.map((x) => x);
  }

  /** @returns An iterator over all of the agent IDs in this model. */
  get ids(): Iterator<number> {
    return Iterator.from(this._agents).map((agent: Agent) => agent.id);
  }

  /**
   * Add an agent to this model.
   *
   * @returns The new `length` of this collection of agents.
   */
  push(agent: A): number {
    return this._agents.push(agent);
  }

  /** @returns Whether this world includes the given `agent`. */
  includes(agent: A): boolean {
    return this._agents.includes(agent);
  }

  /** Remove the given `agent` from this model. */
  remove(agent: A) {
    assert(this.includes(agent), "This model does not include the given agent.");
    this._agents.splice(this._agents.indexOf(agent), 1);
  }

  step() {
    this._time += 1;

    if (this.agentsFirst && this.agentStep) {
      this._agents.forEach(a => this.agentStep!(a, this));
      this.modelStep && this.modelStep(this);
    } else {
      this.modelStep && this.modelStep(this);
      if (this.agentStep) this._agents.forEach(a => this.agentStep!(a, this));
    }
  }

  toString(): string {
    assert(
      worlds.has(this.id),
      "Expected the map of model worlds to include this model!",
    );

    const space = worlds.get(this.id)!.constructor.name;
    const length = this._agents.length;
    return `${this.constructor.name}<${space}>: ${length} agent${length === 1 ? "" : "s"}`;
  }
}

/** A model which operates in continuous time. */
export class ContinuousModel<W extends World> extends Model<W> { }

let lastAgentId = -1;

/** An agent participating in a simulation. */
export default abstract class Agent {
  private _id = lastAgentId += 1;

  /* Unique identifier of this agent in its simulation. */
  get id(): number {
    return this._id;
  }
}

/** Agent in a `GraphWorld`. */
export class GraphAgent<V, E> extends Agent { }

type Enumerate<N extends number, Acc extends number[] = []> = Acc["length"] extends N ? Acc[number]
  : Enumerate<N, [...Acc, Acc["length"]]>;

// See https://stackoverflow.com/a/39495173/1363247
type IntRange<Min extends number, Max extends number> = Exclude<
  Enumerate<Max>,
  Enumerate<Min>
>;

/**
 * The range of supported grid dimensions, from 1 to 100 (inclusive).
 *
 * @see `Point`, `GridAgent`, and `GridWorld`
 */
export type GridSize = IntRange<1, 101>;

/** A location in a `GridWorld`. */
export type Position<D extends GridSize> = FixedLengthArray<number, D>;

/** Agent in a `GridWorld`, positioned in `D`-dimensional space. */
export class GridAgent<D extends GridSize = 2> extends Agent {
  /** The location of this agent. */
  position: Position<D>;

  constructor(position: Position<D>) {
    super();

    assertGreater(position.length, 0, "Position must have a dimension!");
    this.position = position;
  }
}

/** A place in which agents operate. Positions are represented by values of `Pos`. */
export interface World<Pos = unknown> {
  /** @returns An iterator over the agents within distance `r` (inclusive) from the given `position`. */
  nearby(
    model: Model<World<Pos>>,
    position: Pos,
    r: number,
  ): Iterable<Agent>;
}

// See https://github.com/microsoft/TypeScript/issues/26223#issuecomment-410642988
interface FixedLengthArray<T, L extends number> extends Array<T> {
  0: T;
  length: L;
}

/** A point in `N`-dimensional space. */
export type Point<N extends number> = FixedLengthArray<number, N>;

/**
 * A `N`-dimensional world.
 *
 * Optionally, you may decide whether the area is periodic and by
 * which metric to measure distance.
 */
export class GridWorld<N extends GridSize = 2> implements World<Point<N>> {
  constructor(
    /** Whether the world's area is periodic. */
    public readonly periodic: boolean = true,
  ) { }

  /** @returns An iterator over the agents within distance `r` (inclusive) from the given `position`. */
  nearby(model: Model<World<Point<N>>>, position: Point<N>, r: number = 1): Iterable<Agent> {
    assert(Iterator.from(model.agents).every((agent) => agent instanceof GridAgent));
    assertGreater(position.length, 0);
    if (model.length) {
      const expectedDimensions =
        (model as unknown as Record<number, GridAgent<N>>)[0].position.length;
      assertEquals(
        expectedDimensions,
        position.length,
        `Expected a position with ${expectedDimensions} dimension${expectedDimensions === 1 ? "" : "s"
        }!`,
      );
    }
    return Iterator.from(model.agents)
      .filter(agent => (agent as GridAgent).position.every((a, i) => Math.abs(position[i] - a) <= r));
  }
}
