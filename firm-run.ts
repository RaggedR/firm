// firm-run.ts — six years, with stub leaves. Shows the constraint moving, and
// tests Goldratt: capacity added off the constraint must change nothing.

import type { PosAt, Runner, Shape } from "./lib/algebra.ts";
import { type DevC, type Ledger, type ResearchC, type SalesC, development, harness } from "./firm.ts";

/** A research stub with a fixed annual capacity. */
const researchAgents = (capacity: number): Runner<ResearchC> => ({
  label: `research(${capacity})`,
  run<S extends Shape<ResearchC>>(shape: S) {
    const r = shape.tag === "Reset"
      ? { tag: "ResetAck" }
      : { ideas: Math.min(shape.briefs, capacity) };
    return Promise.resolve(r as PosAt<ResearchC, S>);
  },
});

/** A sales floor with a fixed annual capacity. */
const salesAgents = (capacity: number) => (consignment: number) => ({
  sold: Math.min(consignment, capacity),
  unmet: Math.max(0, consignment - capacity),
});

const START: Ledger = { constraint: "research", ideas: 0, products: 0, shortfall: 0, unmet: 0 };

async function year6(researchCap: number, salesCap: number, demand: number) {
  const firm = harness(development, researchAgents(researchCap), START);
  const sell = salesAgents(salesCap);
  let revenue = 0, unsold = 0;
  const trace: string[] = [];
  for (let y = 1928; y < 1934; y++) {
    const made = await firm.run(
      { tag: "Develop", wanted: demand, unsold, year: y } satisfies Shape<DevC>, 0);
    const out = sell(made.products);
    unsold = made.products - out.sold;
    revenue += out.sold;
    trace.push(`  ${y}  made ${String(made.products).padStart(2)}  sold ${String(out.sold).padStart(2)}` +
      `  unsold ${String(unsold).padStart(2)}  → constraint: ${firm.state().constraint}`);
  }
  return { revenue, trace, end: firm.state().constraint };
}

const show = async (name: string, r: number, s: number) => {
  const { revenue, trace, end } = await year6(r, s, 10);
  console.log(`\n${name}   research=${r} sales=${s}`);
  console.log(trace.join("\n"));
  console.log(`  six-year revenue: ${revenue}   final build order: add ${end}`);
  return revenue;
};

const base = await show("research-bound", 4, 12);
const onSales = await show("  + sales    ", 4, 24);   // capacity OFF the constraint
const onResearch = await show("  + research  ", 8, 12); // capacity ON the constraint
await show("sales-bound  ", 20, 6);

console.log(`\nGoldratt: doubling sales moved revenue ${base} → ${onSales} (${onSales - base})`);
console.log(`          doubling research moved revenue ${base} → ${onResearch} (${onResearch - base})`);
