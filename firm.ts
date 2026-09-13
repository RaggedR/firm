// firm.ts — research, product development, sales, as containers.
//
// Sketch only. The one thing here that is a GUESS is `Worker`: it is written
// to Ghani's `A (x) X -> Y` as Robin reported it, with `A = S |> S`. If MacBeth
// says the state is a full container rather than `S |> S`, the change is to the
// `Worker` interface and nothing below it.
//
// Everything else is settled by lib/algebra.ts: the chain is a tree, capacity
// is the tensor, and neither needs an answer from Strathclyde.

import { type Cont, type Fib, type PosAt, type Runner, type Shape, tensorC } from "./lib/algebra.ts";

// ── The three stages ──────────────────────────────────────────────────
// Each is an interface, not a behaviour. `Reset` is mandatory on every leaf.

/** Research answers briefs with ideas. A leaf: one interface, d = 1. */
export type ResearchC =
  | Fib<{ tag: "Investigate"; briefs: number; year: number }, { ideas: number }>
  | Fib<{ tag: "Reset" }, { tag: "ResetAck" }>;

/** Sales answers a consignment with what it managed to shift. A leaf, d = 1. */
export type SalesC =
  | Fib<{ tag: "Sell"; consignment: number; year: number }, { sold: number; unmet: number }>
  | Fib<{ tag: "Reset" }, { tag: "ResetAck" }>;

/** Product development is what Sales prompts. d = 2, and so the only stage
 *  that holds state — see `Ledger`.
 *
 *  `unsold` is last year's figure, and it rides in the PROMPT. Development is
 *  prompted BY sales, so it never sees a reply from sales and cannot otherwise
 *  learn that goods went unshifted. The alternative is an edge dev -> sales,
 *  which would make dev d = 3, close a cycle, and cost a Betti number. This is
 *  the same move `federation/mobius.ts` makes with `fuel` and `visited`: put the
 *  state in the prompt, because a header cannot be a type. */
export type DevC =
  | Fib<
    { tag: "Develop"; wanted: number; unsold: number; year: number },
    { products: number; shortfall: number }
  >
  | Fib<{ tag: "Reset" }, { tag: "ResetAck" }>;

// ── Capacity is the tensor ────────────────────────────────────────────
// `(x)` supplies both shapes up front and owes both replies, which is what a
// second agent on the same stage means. `x` would be the wrong combinator: it
// offers both and answers ONE, which is failover, not throughput.

export type SalesFloor2 = ReturnType<typeof salesFloor2>;
export const salesFloor2 = (a: Runner<SalesC>, b: Runner<SalesC>) => tensorC(a, b);

// ── The state ─────────────────────────────────────────────────────────

/** The finite part. Three values, and it steers. */
export type Stage = "research" | "product" | "sales";

/** The ledger: one finite field that routes, three unbounded ones that ride
 *  along. `state.ts` in `stalin` already makes exactly this split and says why
 *  — a rule over a grade can be typed, the same rule over a tonnage cannot. */
export interface Ledger {
  readonly constraint: Stage;  // finite: steers, and IS next year's build order
  readonly ideas: number;      // unbounded: carried, never matched on
  readonly products: number;
  readonly shortfall: number;  // what dev could not build
  readonly unmet: number;      // what sales could not shift
}

/** Goldratt, with the arithmetic exposed. The only place `Stage` is produced. */
export function diagnose(l: Ledger): Stage {
  if (l.unmet > 0) return "sales";     // goods were made and sat: too few agents
  if (l.shortfall > 0 && l.ideas <= 0) return "research"; // dev starved of ideas
  if (l.shortfall > 0) return "product";  // ideas on the shelf, nobody to build
  return l.constraint;                    // nothing binds; leave it alone
}

// ── A worker, A (x) X -> Y ────────────────────────────────────────────
//
//     fwd : S x X0 -> Y0
//     bwd : (s : S, x : X0) -> Y1 (fwd s x) -> S x X1
//
// `bwd` needs positions over the shape `fwd` chose, so the pair is a Sigma
// whose first component is picked by the implementation — an existential, which
// TypeScript has not got. `stalin/morphisms.ts` solves this by Church-encoding,
// and the same move is used here: the delegate shape `SY` is a SCOPE (the type
// parameter of `k`), never a type. It cannot escape `step`.

export interface Worker<S, X extends Cont, Y extends Cont> {
  readonly label: string;
  step<SX extends Shape<X>>(
    s: S,
    x: SX,
    k: <SY extends Shape<Y>>(
      y: SY,
      back: (r: PosAt<Y, SY>) => { state: S; reply: PosAt<X, SX> },
    ) => Promise<{ state: S; reply: PosAt<X, SX> }>,
  ): Promise<{ state: S; reply: PosAt<X, SX> }>;
}

/** A worker, a downstream runner and a state cell make a `Runner<X>`. The state
 *  never appears in X's type: callers upstream cannot see it and cannot corrupt
 *  it. That is the harness. */
export function harness<S, X extends Cont, Y extends Cont>(
  w: Worker<S, X, Y>,
  downstream: Runner<Y>,
  initial: S,
): Runner<X> & { state(): S } {
  let s = initial;
  return {
    label: `${w.label}[${downstream.label}]`,
    state: () => s,
    async run<SX extends Shape<X>>(shape: SX, depth: number): Promise<PosAt<X, SX>> {
      const out = await w.step(s, shape, async (y, back) => {
        const r = await downstream.run(y, depth + 1);
        return back(r);
      });
      s = out.state;              // the ONLY assignment to the state
      return out.reply;
    },
  };
}

// ── The firm's worker: development, holding the ledger ────────────────

export const development: Worker<Ledger, DevC, ResearchC> = {
  label: "development",
  step(s, x, k) {
    if (x.tag === "Reset") {
      return k({ tag: "Reset" }, () => ({
        state: { constraint: "research", ideas: 0, products: 0, shortfall: 0, unmet: 0 },
        reply: { tag: "ResetAck" } as PosAt<DevC, typeof x>,
      }));
    }
    // fwd: the state chooses the brief. Starved of ideas, ask for more.
    const briefs = s.constraint === "research" ? x.wanted * 2 : x.wanted;
    return k({ tag: "Investigate", briefs, year: x.year }, (r) => {
      // bwd: the reply becomes goods for Sales AND the next ledger.
      const ideas = s.ideas + r.ideas;
      const products = Math.min(ideas, x.wanted);
      const next: Ledger = {
        constraint: s.constraint,
        ideas: ideas - products,
        products,
        shortfall: Math.max(0, x.wanted - products),
        unmet: x.unsold,                       // told to us, in the prompt
      };
      return {
        state: { ...next, constraint: diagnose(next) },   // the build order
        reply: { products, shortfall: next.shortfall } as PosAt<DevC, typeof x>,
      };
    });
  },
};
