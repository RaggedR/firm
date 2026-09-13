# firm

**Where should the next agent go, and what does putting it there cost?**

Three stages in a line — research, product development, sales — as containers.
Development holds the state, diagnoses the constraint, and the constraint it
computes *is* the build order for next year's topology. Adding an agent is a
change of type, so it needs a recompile, and the recompile is the honest part.

Built on the four combinators of §5 of Neil Ghani's *Containers for Typed
Agentic AI*, vendored unmodified into [`lib/`](lib/). Requires
[Deno](https://deno.com) 2.x. No install step, no dependencies.

```
deno check *.ts lib/*.ts     # includes the type tests; fails in both directions
deno run firm-run.ts         # six years, three configurations
```

## The shape of it

```
        Sales  ──prompts──▶  Development  ──prompts──▶  Research
         d=1                     d=2                       d=1
       stateless            holds the ledger            stateless
```

A **path**, and a path is a tree, so it composes with `◁` and typechecks. The
feedback edge that would make it a company — sales telling research what the
market said — closes a cycle, and `firm-type-tests.ts` records what the compiler
does about that:

```ts
const line = seqC(dev, research);   // fine: a path is a tree
const loop = seqC(sales, loop);     // TS7022: referenced in its own initializer
```

which is the same diagnostic `federation/mobius-type-tests.ts` records for the
ring. That repository is what happens if you insist on the edge anyway.

## Capacity is the tensor

`lib/algebra.ts` distinguishes two ways to have two agents, and the distinction
is exactly the one a firm needs:

| | meaning | use |
|---|---|---|
| `A ⊠ A` | both shapes supplied up front, **both replies owed** | throughput — a second agent who also works |
| `A × A` | both offered, **exactly one answered** | failover or choice — not more capacity |

So "hire another sales agent" is `Sales ⊠ Sales`, which is a different type from
`Sales`. The type tests assert that it is:

```ts
// @ts-expect-error Property 'left' is missing.
const bad: Shape<typeof floor> = { tag: "Sell", consignment: 10, year: 1928 };
```

**That failure is the recompile.** A running system cannot grow this type, and
should not be able to.

## The state is one finite field and three unbounded ones

```ts
interface Ledger {
  readonly constraint: Stage;  // "research" | "product" | "sales" — steers
  readonly ideas: number;      // carried, never matched on
  readonly products: number;
  readonly shortfall: number;  // what development could not build
  readonly unmet: number;      // what sales could not shift
}
```

The split is the one `stalin/state.ts` already argues for: a rule expressed over
a grade can be typed, and the same rule expressed over a tonnage cannot. `Stage`
is the grade. It has three values, and `diagnose` is the only function that
produces one, so a wire decoder can reject a bad build order structurally.

## Development is prompted by sales, so it cannot see what sales did

The first version of `firm-run.ts` never moved the constraint off `research`,
and the reason is structural rather than a bug. Development is *prompted by*
sales; it therefore never receives a reply from sales. It learns "you asked for
ten". It cannot learn "I shifted six".

Two repairs, and the cohomology of `federation/business-model.pdf` §"Hiring, by
Euler" prices them — an agent with `d` interfaces raises `b₁` by `d − 1`:

| repair | cost in `b₁` |
|---|---|
| an edge development → sales | **2** — development becomes `d = 3`, and the graph gains a cycle |
| carry last year's `unsold` in the **prompt** | **0** |

The second is taken. It is the move `federation/mobius.ts` already makes with
`fuel` and `visited`, for the reason stated there: *a header cannot be a type.*
State tensored into the domain, not smuggled alongside the call.

## The worker, and the harness

```
fwd : S × X₀ → Y₀
bwd : (s : S, x : X₀) → Y₁ (fwd s x) → S × X₁
```

`bwd` needs positions over the shape `fwd` chose, so the pair is a Σ whose first
component the implementation picks — an existential, which TypeScript has not
got. `stalin/morphisms.ts` solves this by Church-encoding, and `Worker` here
does the same: the delegate shape is the type parameter of a continuation, so it
is a **scope**, never a type, and it cannot escape `step`.

`harness(worker, downstream, initial)` then returns a plain `Runner<X>`. `S`
appears nowhere in that type. Callers upstream cannot read the state or corrupt
it, and there is exactly one assignment to it in the file. Ghani's remark that
workers are a nascent theory of harnesses is the reason this function has that
name.

## Measured, not asserted

```
research-bound   research=4  sales=12     six-year revenue: 24
  + sales        research=4  sales=24     six-year revenue: 24    (+0)
  + research     research=8  sales=12     six-year revenue: 48   (+24)
```

Goldratt, numerically: capacity added **off** the constraint changes nothing.
That is a property of the model a run can falsify, not a slogan.

And the constraint moves, one year late:

```
sales-bound      research=20 sales=6
  1928  made 10  sold  6  unsold  4  → constraint: research
  1929  made 10  sold  6  unsold  4  → constraint: sales
  …                                    final build order: add sales
```

The lag is not a defect. Routing is a function of state and the state is written
by `bwd`, so the board always acts on last year's diagnosis. In a game that is
the thing being played.

## What this does not demonstrate

- **The `product` case is not exercised.** Development has no capacity bound, so
  ideas can never pile up unbuilt. `diagnose` returns `"product"` and nothing in
  `firm-run.ts` makes it.
- **`⊠` is not wired into the run.** The type tests prove `Sales ⊠ Sales` is a
  different type; the simulation fakes capacity with an integer. Doing it
  properly means two ports, which means servers, which is the next piece of work.
- **Every leaf is a stub.** There are no processes here yet, so nothing in this
  repository yet demonstrates the claim that a container boundary enforced by a
  process is one a careless developer cannot leak through.
- **`Worker` is a reconstruction.** It is written to `A ⊗ X → Y` with `A = S ▷ S`
  as reported second-hand. If that is wrong, the `Worker` interface changes and
  nothing below it does.

## Not built yet

Servers, so the stages are processes on ports and `⊠` is two of them. A capacity
bound on development, so the third case is real. And the fourth stage — finance,
or the market — which is where the cocycle condition would start to bite, as
`federation/coherence.pdf` explains for covers.
