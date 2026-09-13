// firm-cli.ts — a thin client. All state lives in servers.
//
//   ./firm years [n]   run n years, one line each
//   ./firm year  [y]   one year, then read the board
//   ./firm board       what the CEO currently believes
//   ./firm reset       clear every server's state

import { delegate } from "./lib/wire.ts";

const CEO = Number(Deno.env.get("FIRM_CEO_PORT") ?? "8841");
const SIZE = { one: 1, two: 2, three: 3 } as const;

type Year = { revenue: number; order: keyof typeof SIZE; ran: keyof typeof SIZE; unmet: number; constraint: string };

const runYear = async (year: number, demand: number): Promise<Year> => {
  const u = await delegate(CEO, { tag: "RunYear", year, demand }, 0);
  const o = u as Record<string, unknown>;
  if (typeof o.revenue !== "number" || typeof o.order !== "string") {
    throw new Error(`ceo/RunYear: reply did not validate: ${JSON.stringify(u)}`);
  }
  return o as unknown as Year;
};

const cmd = Deno.args[0] ?? "years";
const demand = Number(Deno.env.get("FIRM_DEMAND") ?? "12");

if (cmd === "reset") {
  await delegate(CEO, { tag: "Reset" }, 0);
  console.log("reset");
} else if (cmd === "board") {
  console.log(JSON.stringify(await delegate(CEO, { tag: "Board" }, 0), null, 2));
} else if (cmd === "year") {
  const r = await runYear(Number(Deno.args[1] ?? "1928"), demand);
  console.log(`ran ${SIZE[r.ran]} agent(s), revenue ${r.revenue}, unsold ${r.unmet}, next year run ${r.order}`);
} else {
  const n = Number(Deno.args[1] ?? "8");
  const from = Number(Deno.args[2] ?? "1928");
  console.log("  year  agents  revenue  unsold  constraint   next year");
  let total = 0;
  for (let k = 0; k < n; k++) {
    const r = await runYear(from + k, demand);
    total += r.revenue;
    console.log(
      `  ${from + k}   ${String(SIZE[r.ran]).padStart(4)}` +
        `${String(r.revenue).padStart(9)}${String(r.unmet).padStart(8)}` +
        `${r.constraint.padStart(12)}      run ${r.order}`,
    );
  }
  console.log(`\n  ${n}-year revenue ${total}`);
}
