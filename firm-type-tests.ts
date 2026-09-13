// firm-type-tests.ts — checked, never run. Fails in BOTH directions:
// when a legal move is rejected, and when an illegal one is accepted.

import { type PosAt, type Shape, type TensorC, seqC, tensorC } from "./lib/algebra.ts";
import type { DevC, Ledger, ResearchC, SalesC, Stage, Worker } from "./firm.ts";
import { diagnose } from "./firm.ts";

const expect = <T>(_: T) => {};

// ── 1. The chain is a tree, and the ring is not ───────────────────────
declare const research: import("./lib/algebra.ts").Runner<ResearchC>;
declare const dev: import("./lib/algebra.ts").Runner<DevC>;
declare const sales: import("./lib/algebra.ts").Runner<SalesC>;

// A path composes. This is the whole reason the firm typechecks.
const line = seqC(dev, research);
expect<string>(line.label);

// Close the loop — sales feeding the roadmap back to research — and it is
// TS7022, exactly as `federation/mobius-type-tests.ts` records for the ring.
// @ts-expect-error 'loop' implicitly has type 'any' because it is referenced
// in its own initializer.
const loop = seqC(sales, loop);
expect<unknown>(loop);

// ── 2. Adding an agent changes the TYPE. This is the recompile. ───────
const floor = tensorC(sales, sales);

// One agent's shape is not the shape of two.
// @ts-expect-error Property 'left' is missing.
const bad: Shape<typeof floor> = { tag: "Sell", consignment: 10, year: 1928 };
expect<unknown>(bad);

// Both prompts up front, both replies owed — and the position type is the
// PRODUCT of the two, not a choice between them. That is throughput.
const two = floor.both(
  { tag: "Sell", consignment: 10, year: 1928 } as const,
  { tag: "Sell", consignment: 10, year: 1928 } as const,
);
type TwoReplies = PosAt<TensorC<SalesC, SalesC>, typeof two>;
expect<TwoReplies>({
  left: { sold: 0, unmet: 0 },
  right: { sold: 0, unmet: 0 },
});

// One agent's reply is not two agents' replies.
// @ts-expect-error Property 'right' is missing.
const halfDone: TwoReplies = { left: { sold: 0, unmet: 0 } };
expect<unknown>(halfDone);

// ── 3. The state set is finite, and `diagnose` is its only producer ───
declare const l: Ledger;
expect<Stage>(diagnose(l));

// @ts-expect-error "potatoes" is not a Stage. The decoder at the wire can
// reject a build order structurally, because the type knows the whole set.
const notAStage: Stage = "potatoes";
expect<unknown>(notAStage);

// ── 4. The delegate shape cannot escape the worker ────────────────────
declare const w: Worker<Ledger, DevC, ResearchC>;
// `SY` is the type parameter of `k`, so it is a scope, not a type. There is no
// expression here whose type mentions the chosen research shape.
expect<(typeof w)["label"]>(w.label);
