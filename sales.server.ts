// sales.server.ts — one sales agent, ports 8831..8833.
//
// Three identical processes, differing only in port and capacity. The CEO
// decides how many of them a year uses; the ones outside the chosen summand are
// running and are never prompted, which `firm trace` shows.
//
// Each agent keeps its own `unsold` from last year and hands it down in the
// prompt. That is the only route by which development learns what the market
// did, because replies flow up and development sits below sales.

import { delegate, serveContainer } from "./lib/wire.ts";

type Prompt =
  | { tag: "Sell"; consignment: number; year: number }
  | { tag: "Reset" };

const DEV = Number(Deno.env.get("FIRM_DEV_PORT") ?? "8822");
const CAPACITY = Number(Deno.env.get("FIRM_SALES_CAPACITY") ?? "5");
const NAME = Deno.env.get("FIRM_SALES_NAME") ?? "sales";

let unsold = 0;

const parse = (u: unknown): Prompt | null => {
  if (typeof u !== "object" || u === null) return null;
  const o = u as Record<string, unknown>;
  if (o.tag === "Reset") return { tag: "Reset" };
  if (o.tag === "Sell" && typeof o.consignment === "number" && typeof o.year === "number") {
    return { tag: "Sell", consignment: o.consignment, year: o.year };
  }
  return null;
};

const decodeGoods = (u: unknown): { products: number } | null => {
  if (typeof u !== "object" || u === null) return null;
  const o = u as Record<string, unknown>;
  return typeof o.products === "number" && o.products >= 0 ? { products: o.products } : null;
};

async function answer(p: Prompt, depth: number): Promise<unknown> {
  if (p.tag === "Reset") {
    unsold = 0;
    return { tag: "ResetAck" };
  }
  const raw = await delegate(
    DEV,
    { tag: "Develop", wanted: p.consignment, unsold, year: p.year },
    depth,
  );
  const goods = decodeGoods(raw);
  if (goods === null) throw new Error("dev/Develop: reply did not validate");

  const sold = Math.min(goods.products, CAPACITY);
  unsold = goods.products - sold;
  return { sold, unmet: Math.max(0, p.consignment - sold) };
}

if (import.meta.main) {
  serveContainer<Prompt>({
    name: NAME,
    port: Number(Deno.env.get("FIRM_SALES_PORT") ?? "8831"),
    parse,
    answer,
  });
}
