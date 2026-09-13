// ceo-type-tests.ts — checked, never run.

import type { PosAt, Shape } from "./lib/algebra.ts";
import type { Board, FirmC, Floor1, Floor2, Floor3, Size } from "./ceo.ts";
import { decide } from "./ceo.ts";

const expect = <T>(_: T) => {};

// ── 1. The three topologies are three different types ─────────────────
declare const s1: Shape<Floor1>;
declare const s2: Shape<Floor2>;

// A one-agent prompt is not a two-agent prompt. This is why growing the floor
// is not a configuration change.
// @ts-expect-error Property 'left' is missing.
const wrong: Shape<Floor2> = s1;
expect<unknown>(wrong);

// @ts-expect-error Property 'tag' is missing.
const alsoWrong: Shape<Floor1> = s2;
expect<unknown>(alsoWrong);

// ── 2. The family is closed. The CEO cannot name a fourth. ────────────
const takeOne: Shape<FirmC> = { side: "left", value: { tag: "Reset" } };
expect<unknown>(takeOne);

// @ts-expect-error "middle" is not a side: the sum has exactly two, nested.
const fourth: Shape<FirmC> = { side: "middle", value: { tag: "Reset" } };
expect<unknown>(fourth);

// @ts-expect-error "four" is not a Size. `decide` is total into three values.
const tooBig: Size = "four";
expect<unknown>(tooBig);
expect<Size>(decide("three", "sales"));

// ── 3. `sumC` tags shapes and does NOT tag positions ──────────────────
// The reply to a right/left prompt is the TENSOR's own position, with no
// {side, value} wrapper. `lib/algebra.ts` says so — `pos (Left p) = c.Pos p` —
// and `stalin/PLAN-routing-agent.md` warns that callers must discriminate
// structurally. Asserted here so the warning cannot rot.
type TwoAgentPrompt = {
  side: "right";
  value: { side: "left"; value: { left: { tag: "Sell"; consignment: number; year: number }; right: { tag: "Sell"; consignment: number; year: number } } };
};
type TwoAgentReply = PosAt<FirmC, TwoAgentPrompt>;
expect<TwoAgentReply>({
  left: { sold: 0, unmet: 0 },
  right: { sold: 0, unmet: 0 },
});

// @ts-expect-error there is no {side, value} on the way back.
const tagged: TwoAgentReply = { side: "right", value: { left: { sold: 0, unmet: 0 }, right: { sold: 0, unmet: 0 } } };
expect<unknown>(tagged);

// ── 4. The board's build order is one of three ────────────────────────
declare const b: Board;
expect<Size>(b.order);
