// ceo.server.ts — the orchestrating agent, port 8841.
//
// The CEO was a CLI, and that was wrong: its board died with the process, so
// the topology decision was not durable while development's ledger was. An
// agent with authority should hold that authority in its own address space, on
// its own port, like every other agent here.
//
// Its permissions let it reach the three sales agents and nothing else. It
// cannot reach development or research: it commands the shape of the firm and
// has no route into its books, which is a separation the container types also
// state and the kernel here enforces.

import { type Decoders, type Runner, leaf } from "./lib/algebra.ts";
import type { Ledger, SalesC } from "./firm.ts";
import { harness } from "./firm.ts";
import { type Board, type Size, ceo, firm } from "./ceo.ts";
import { serveContainer } from "./lib/wire.ts";

type Prompt =
  | { tag: "RunYear"; year: number; demand: number }
  | { tag: "Board" }
  | { tag: "Reset" };

const PORTS = [
  Number(Deno.env.get("FIRM_SALES0_PORT") ?? "8831"),
  Number(Deno.env.get("FIRM_SALES1_PORT") ?? "8832"),
  Number(Deno.env.get("FIRM_SALES2_PORT") ?? "8833"),
];

/** The only thing that ever checks the wire. A reply outside the fibre fails
 *  here rather than being coerced. */
const salesDecoders: Decoders<SalesC> = {
  Sell: (u) => {
    if (typeof u !== "object" || u === null) return null;
    const o = u as Record<string, unknown>;
    return typeof o.sold === "number" && typeof o.unmet === "number" &&
        o.sold >= 0 && o.unmet >= 0
      ? { sold: o.sold, unmet: o.unmet }
      : null;
  },
  Reset: (u) => {
    if (typeof u !== "object" || u === null) return null;
    return (u as Record<string, unknown>).tag === "ResetAck" ? { tag: "ResetAck" } : null;
  },
};

const LEDGER: Ledger = { constraint: "sales", ideas: 0, products: 0, shortfall: 0, unmet: 0 };
const START: Board = { floor: "one", order: "one", ledger: LEDGER };

const agent = (i: number): Runner<SalesC> => leaf<SalesC>(`sales${i}`, PORTS[i], salesDecoders);

// One harness, created once, living as long as this process. `S` appears
// nowhere in the type it presents, and nothing outside this file can reach it.
const board = harness(ceo, firm(agent), START);

const parse = (u: unknown): Prompt | null => {
  if (typeof u !== "object" || u === null) return null;
  const o = u as Record<string, unknown>;
  if (o.tag === "Reset") return { tag: "Reset" };
  if (o.tag === "Board") return { tag: "Board" };
  if (o.tag === "RunYear" && typeof o.year === "number" && typeof o.demand === "number") {
    return { tag: "RunYear", year: o.year, demand: o.demand };
  }
  return null;
};

async function answer(p: Prompt, depth: number): Promise<unknown> {
  if (p.tag === "Board") {
    const b = board.state();
    return { floor: b.floor as Size, order: b.order as Size, ledger: b.ledger };
  }
  if (p.tag === "Reset") {
    await board.run({ tag: "Reset" }, depth);
    return { tag: "ResetAck" };
  }
  const before = board.state().floor;
  const r = await board.run({ tag: "RunYear", year: p.year, demand: p.demand }, depth);
  return { ...r, ran: before, unmet: board.state().ledger.unmet, constraint: board.state().ledger.constraint };
}

if (import.meta.main) {
  serveContainer<Prompt>({
    name: "ceo",
    port: Number(Deno.env.get("FIRM_CEO_PORT") ?? "8841"),
    parse,
    answer,
  });
}
