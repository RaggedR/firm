// ceo-run.ts — eight years under a CEO that grows the sales floor.

import type { PosAt, Runner, Shape } from "./lib/algebra.ts";
import type { Ledger, SalesC } from "./firm.ts";
import { harness } from "./firm.ts";
import { type Board, type CeoC, SIZE, ceo, firm } from "./ceo.ts";

/** One sales agent, capacity per year. Counts its own prompts so the run can
 *  show that only the summand taken is ever contacted. */
let prompted = 0;
const agent = (capacity: number) => (): Runner<SalesC> => ({
  label: "sales",
  run<S extends Shape<SalesC>>(shape: S) {
    prompted++;
    const r = shape.tag === "Reset"
      ? { tag: "ResetAck" }
      : { sold: Math.min(shape.consignment, capacity), unmet: Math.max(0, shape.consignment - capacity) };
    return Promise.resolve(r as PosAt<SalesC, S>);
  },
});

const LEDGER: Ledger = { constraint: "sales", ideas: 99, products: 0, shortfall: 0, unmet: 0 };
const START: Board = { floor: "one", order: "one", ledger: LEDGER };

const board = harness(ceo, firm(agent(5)), START);

console.log("  year  floor  agents prompted  revenue  unsold   next year");
let total = 0;
for (let y = 1928; y < 1936; y++) {
  const before = prompted;
  const size = board.state().floor;
  const r = await board.run({ tag: "RunYear", year: y, demand: 12 } satisfies Shape<CeoC>, 0);
  total += r.revenue;
  console.log(
    `  ${y}   ${String(SIZE[size]).padStart(3)}` +
      `${String(prompted - before).padStart(15)}` +
      `${String(r.revenue).padStart(10)}` +
      `${String(board.state().ledger.unmet).padStart(8)}` +
      `      run ${r.order}`,
  );
}
console.log(`\n  eight-year revenue ${total}, agent prompts ${prompted}`);
