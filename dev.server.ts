// dev.server.ts — product development, port 8822. The worker, as a process.
//
// This server IS the worker of `firm.ts`: it holds the ledger, its forward leg
// chooses the brief from the state, and its backward leg writes the next
// ledger. The state lives in this process's memory and is reachable by no other
// route than a `Develop` prompt on this port. That is the claim about process
// boundaries, made mechanical: `harness` hides the state behind a type, and the
// operating system hides it behind an address space.

import { delegate, serveContainer, trace } from "./lib/wire.ts";
import { type Ledger, diagnose } from "./firm.ts";

type Prompt =
  | { tag: "Develop"; wanted: number; unsold: number; year: number }
  | { tag: "Report" }
  | { tag: "Reset" };

const RESEARCH = Number(Deno.env.get("FIRM_RESEARCH_PORT") ?? "8821");
const CAPACITY = Number(Deno.env.get("FIRM_DEV_CAPACITY") ?? "8");

const FRESH: Ledger = { constraint: "research", ideas: 0, products: 0, shortfall: 0, unmet: 0 };
let ledger: Ledger = FRESH;

const parse = (u: unknown): Prompt | null => {
  if (typeof u !== "object" || u === null) return null;
  const o = u as Record<string, unknown>;
  if (o.tag === "Reset") return { tag: "Reset" };
  if (o.tag === "Report") return { tag: "Report" };
  if (
    o.tag === "Develop" && typeof o.wanted === "number" &&
    typeof o.unsold === "number" && typeof o.year === "number"
  ) return { tag: "Develop", wanted: o.wanted, unsold: o.unsold, year: o.year };
  return null;
};

/** The reply from research, validated rather than cast. A leaf that answered
 *  `{"ideas":"lots"}` fails the fibre here and nothing ill-typed goes on. */
const decodeIdeas = (u: unknown): number | null => {
  if (typeof u !== "object" || u === null) return null;
  const n = (u as Record<string, unknown>).ideas;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null;
};

async function answer(p: Prompt, depth: number): Promise<unknown> {
  if (p.tag === "Reset") {
    ledger = FRESH;
    return { tag: "ResetAck" };
  }
  if (p.tag === "Report") return { ledger };

  // fwd: the STATE chooses the brief. Starved of ideas, ask for more.
  const briefs = ledger.constraint === "research" ? p.wanted * 2 : p.wanted;
  trace(depth, "down", "dev", `fwd briefs=${briefs} (constraint=${ledger.constraint})`);
  const raw = await delegate(RESEARCH, { tag: "Investigate", briefs, year: p.year }, depth);
  const fresh = decodeIdeas(raw);
  if (fresh === null) throw new Error(`research/Investigate: reply did not validate`);

  // bwd: the reply becomes goods for sales AND the next ledger.
  const ideas = ledger.ideas + fresh;
  const buildable = Math.min(ideas, CAPACITY);      // the plant is finite
  const products = Math.min(buildable, p.wanted);
  const next: Ledger = {
    constraint: ledger.constraint,
    ideas: ideas - products,
    products,
    shortfall: Math.max(0, p.wanted - products),
    unmet: p.unsold,
  };
  ledger = { ...next, constraint: diagnose(next) };
  return { products, shortfall: next.shortfall };
}

if (import.meta.main) {
  serveContainer<Prompt>({
    name: "dev",
    port: Number(Deno.env.get("FIRM_DEV_PORT") ?? "8822"),
    parse,
    answer,
  });
}
