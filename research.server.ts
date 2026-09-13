// research.server.ts — the bottom of the chain, port 8821.
//
// A leaf in the strict sense: it answers out of its own head and delegates to
// nobody. `up.sh` therefore starts it with NO --allow-run at all, so the claim
// "research does not call anything" is enforced by the kernel and not merely by
// the absence of a call in the source. A careless edit here cannot create an
// edge; it can only fail to start.

import { serveContainer } from "./lib/wire.ts";

type Prompt =
  | { tag: "Investigate"; briefs: number; year: number }
  | { tag: "Reset" };

const CAPACITY = Number(Deno.env.get("FIRM_RESEARCH_CAPACITY") ?? "6");
const SEED = Number(Deno.env.get("FIRM_SEED") ?? "1928");

/** A seeded LCG, so a run is reproducible. Research is the only source of
 *  variation in the whole system; everything else is arithmetic. */
const lucky = (year: number): number => {
  let x = (SEED ^ (year * 2654435761)) >>> 0;
  x = (1664525 * x + 1013904223) >>> 0;
  return x / 4294967296;
};

/** Ideas are capped by capacity, and a given year is good, ordinary or thin. */
const ideasFor = (briefs: number, year: number): number => {
  const r = lucky(year);
  const mood = r < 0.2 ? 0.5 : r < 0.75 ? 1 : 1.5;
  return Math.max(0, Math.min(briefs, Math.round(CAPACITY * mood)));
};

const parse = (u: unknown): Prompt | null => {
  if (typeof u !== "object" || u === null) return null;
  const o = u as Record<string, unknown>;
  if (o.tag === "Reset") return { tag: "Reset" };
  if (o.tag === "Investigate" && typeof o.briefs === "number" && typeof o.year === "number") {
    return { tag: "Investigate", briefs: o.briefs, year: o.year };
  }
  return null;
};

if (import.meta.main) {
  serveContainer<Prompt>({
    name: "research",
    port: Number(Deno.env.get("FIRM_RESEARCH_PORT") ?? "8821"),
    parse,
    answer: (p) =>
      Promise.resolve(
        p.tag === "Reset" ? { tag: "ResetAck" } : { ideas: ideasFor(p.briefs, p.year) },
      ),
  });
}
