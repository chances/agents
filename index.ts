// Polyfill JS `Iterator` helpers. See https://github.com/tc39/ecma262/pull/3395
import "es-iterator-helpers/auto";

/** All models are some concrete implementation of `Model`. */
export abstract class Model {
  private _time = 0;
  private _agents: Agent[] = [];

  constructor() {
    // See https://stackoverflow.com/a/25658975/1363247
    return new Proxy(this, {
      get(target, name) {
        // Try to index the internal list of agents
        const index = typeof name === "string" ? parseInt(name) : Number.NaN;
        if (index !== Number.NaN) return target._agents[index];
        // Otherwise, defer to the model
        // deno-lint-ignore no-explicit-any
        const model = target as Record<string | symbol, any>;
        return model[name];
      }
    })
  }

  /**
   * @returns The current time of this model.
   * @remarks All models start from time `0` and is incremented when `step`-ped.
   */
  get time() {
    return this._time;
  }

  /** Gets the number of agents in this model. This is a number one higher then the highest index in this collection. */
  get length() {
    return this._agents.length;
  }

  /** @returns An iterator over all of the agents in this model. */
  get agents(): Iterator<Agent> {
    return this._agents[Symbol.iterator]();
  }

  /** @returns An iterator over all of the agent IDs in this model. */
  get ids(): Iterator<number> {
    // FIXME: ts: 'Iterator' only refers to a type, but is being used as a value here.
    // FIXME: https://github.com/denoland/deno/issues/26783
    // FIXME: https://github.com/bakkot/TypeScript/blob/d8282a419c6f47b364662c50d07efbe5f7a3d334/tests/baselines/reference/builtinIterator.js#L4
    return Iterator.from(this._agents).map((agent: Agent) => agent.id);
  }
}
export class StandardModel extends Model {}
export class MailboxModel extends Model {}

let lastId = -1;

/** An agent participating in a simulation. */
export default abstract class Agent {
  private _id = lastId += 1;

  /* Unique identifier of this agent in its simulation. */
  get id(): number {
    return this._id;
  }
}

/** Agent for usage with a `GraphSpace`. */
export class GraphAgent<V, E> extends Agent {}
/** Agent for usage with a `GridSpace`. */
export class GridAgent<D extends number = 2> extends Agent {}
/** Agent for usage with a `ContinuiousSpace`. */
export class ContinuiousAgent extends Agent {}

/** */
export abstract class Space<Pos = number> {
  /** @returns An iterator over the agents witin distance `r` (inclusive) from the given `position`. */
  abstract nearby(position: Pos, r: number): Iterator<Agent, number>;
}
