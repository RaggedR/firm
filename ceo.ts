// ceo.ts — an agent that orchestrates the topology.
//
// The CEO's codomain depends on its state: next year the sales floor may be a
// different SIZE, and a floor of two agents needs two consignments decided, so
// its prompt shape is not the prompt shape of a floor of one. A worker
// `A (x) X -> Y` has a FIXED codomain, so at first sight the CEO is not one.
//
// It is, because the state set is finite. Take the total container
//
//     Y^  =  Sigma (s : S). Y(s)  =  Y(s1) + Y(s2) + Y(s3)
//
// A finite sum of containers is `+`, which `lib/algebra.ts` has and which no
// other project in this family uses. `CEO : A (x) X -> Y^` is then an ordinary
// morphism, and the recompile is the choice of a summand.
//
// The choice is made from the STATE, never from a reply. Branching on a reply
// is the one thing `SeqC` forbids — see the comment on `SeqC` in lib, and
// §4 of reification.pdf. Deferring the branch by one tick is what makes it
// legal, and the one-year lag in the trace is the price of that restriction.

import {
  type Cont,
  type Fib,
  type PosAt,
  type Runner,
  type Shape,
  type SumC,
  type TensorC,
  sumC,
  tensorC,
} from "./lib/algebra.ts";
import { type Ledger, type Stage, type SalesC, diagnose } from "./firm.ts";

// ── The sales floor, at three sizes ───────────────────────────────────
// These are three DIFFERENT containers. Two agents must each be told what to
// sell, so `Floor2`'s shape is a pair. That is why growing the floor is a
// recompile and not a configuration change.

export type Floor1 = SalesC;
export type Floor2 = TensorC<SalesC, SalesC>;
export type Floor3 = TensorC<SalesC, Floor2>;

/** The finite family of topologies, as one container. `S` has three values, so
 *  the Sigma is a sum of three, and the CEO cannot name a fourth. */
export type FirmC = SumC<Floor1, SumC<Floor2, Floor3>>;

/** How many agents each summand stands for. The only place the correspondence
 *  between a topology and its size is written down. */
export const SIZE = { one: 1, two: 2, three: 3 } as const;
export type Size = keyof typeof SIZE;

// ── What the outside asks of the CEO ──────────────────────────────────

export type CeoC =
  | Fib<{ tag: "RunYear"; year: number; demand: number }, { revenue: number; order: Size }>
  | Fib<{ tag: "Reset" }, { tag: "ResetAck" }>;

/** The CEO's state. `floor` is the topology it is currently looking at;
 *  `order` is the topology it has decided to look at next — the build order. */
export interface Board {
  readonly floor: Size;
  readonly order: Size;
  readonly ledger: Ledger;
}

/** Grow when sales binds, shrink when it does not, and stay inside the family.
 *  This is the whole of the CEO's authority: a total function into three values. */
export function decide(floor: Size, constraint: Stage): Size {
  if (constraint !== "sales") return floor;
  return floor === "one" ? "two" : floor === "two" ? "three" : "three";
}

// ── The CEO as a worker ───────────────────────────────────────────────
// `fwd` reads the board and builds a shape of ONE summand. `bwd` reads that
// summand's reply and writes the next board, whose `order` is the build order.

export const ceo = {
  label: "ceo",
  step<SX extends Shape<CeoC>>(
    s: Board,
    x: SX,
    k: <SY extends Shape<FirmC>>(
      y: SY,
      back: (r: PosAt<FirmC, SY>) => { state: Board; reply: PosAt<CeoC, SX> },
    ) => Promise<{ state: Board; reply: PosAt<CeoC, SX> }>,
  ): Promise<{ state: Board; reply: PosAt<CeoC, SX> }> {
    const p = x as { tag: string; year?: number; demand?: number };
    if (p.tag === "Reset") {
      return k({ side: "left", value: { tag: "Reset" } } as const, () => ({
        state: s,
        reply: { tag: "ResetAck" } as PosAt<CeoC, SX>,
      }));
    }
    const year = p.year!, demand = p.demand!;
    const sell = (consignment: number) =>
      ({ tag: "Sell", consignment, year }) as const;

    // The next ledger and reply are the same arithmetic whichever summand was
    // taken, so it is written once and each branch supplies its own total.
    const settle = (sold: number, unmet: number) => {
      const next: Ledger = { ...s.ledger, unmet, products: sold + unmet };
      const constraint = diagnose(next);
      const order = decide(s.floor, constraint);
      // The CEO applies its own build order: next year's `floor` is this
      // year's `order`. One tick from diagnosis to effect, which is the price
      // of not being allowed to branch on a reply.
      return {
        state: { floor: order, order, ledger: { ...next, constraint } },
        reply: { revenue: sold, order } as PosAt<CeoC, SX>,
      };
    };

    // fwd: the STATE picks the summand. Each branch is a different type.
    const each = Math.ceil(demand / SIZE[s.floor]);
    if (s.floor === "one") {
      return k({ side: "left", value: sell(demand) } as const, (r) => settle(r.sold, r.unmet));
    }
    if (s.floor === "two") {
      return k(
        { side: "right", value: { side: "left", value: { left: sell(each), right: sell(each) } } } as const,
        // NOTE: `r` is NOT wrapped in {side, value}. `sumC` tags SHAPES and
        // leaves POSITIONS alone (`pos (Left p) = c.Pos p`), so the reply that
        // comes back is the tensor's own. Routing is visible going down and
        // invisible coming back, which is right: you know which branch you took.
        (r) => settle(
          r.left.sold + r.right.sold,
          r.left.unmet + r.right.unmet,
        ),
      );
    }
    return k(
      {
        side: "right",
        value: {
          side: "right",
          value: { left: sell(each), right: { left: sell(each), right: sell(each) } },
        },
      } as const,
      (r) => settle(
        r.left.sold + r.right.left.sold + r.right.right.sold,
        r.left.unmet + r.right.left.unmet + r.right.right.unmet,
      ),
    );
  },
};

// ── Assembling the family ─────────────────────────────────────────────
//
// This is where the exercise changed its mind. `sumC` and `tensorC` build
// RUNNERS, and a runner is a description: `leaf` holds a port, `tensorC` holds
// two runners. Nothing is contacted until a shape is `run`, and a shape names
// exactly one summand. So assembling all three topologies costs nothing, and
// only the agents in the summand actually taken are ever prompted.
//
// Which means the Sigma construction does NOT need a recompile. For any family
// you are willing to enumerate in advance, growing the sales floor is a change
// of ROUTE inside a fixed type, not a change of type. The compiler is needed
// exactly when the CEO wants to leave the family — and the family is finite
// precisely so that it cannot.

export function firm(agent: () => Runner<SalesC>): Runner<FirmC> {
  return sumC<Floor1, SumC<Floor2, Floor3>>(
    agent(),
    sumC<Floor2, Floor3>(
      tensorC(agent(), agent()),
      tensorC(agent(), tensorC(agent(), agent())),
    ),
  );
}

export type { Cont };
