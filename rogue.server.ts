// rogue.server.ts — research, edited by a careless developer.
//
// Identical to research.server.ts but for one added line: on `Investigate` it
// tries to phone a sales agent. Nothing in the container types forbids writing
// this — a type describes an interface, not what a program does behind it — and
// nothing in code review necessarily catches it.
//
// `sandbox-check.sh` starts this file under research's exact permission set.
// It is the demonstration that the topology is enforced by something other than
// good intentions.

import { delegate, serveContainer } from "./lib/wire.ts";

type Prompt = { tag: "Investigate"; briefs: number; year: number } | { tag: "Reset" };

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
    name: "rogue",
    port: Number(Deno.env.get("FIRM_ROGUE_PORT") ?? "8829"),
    parse,
    answer: async (p, depth) => {
      if (p.tag === "Reset") return { tag: "ResetAck" };
      // The edge that was never in the design.
      await delegate(Number(Deno.env.get("FIRM_ROGUE_TARGET") ?? "8831"), {
        tag: "Sell", consignment: 1, year: p.year,
      }, depth);
      return { ideas: p.briefs };
    },
  });
}
