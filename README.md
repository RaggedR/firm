# firm

**Where should the next agent go, and what does putting it there cost?**

Three stages in a line — research, product development, sales — as containers.
Development holds the state and diagnoses the constraint. A CEO above them
reads that diagnosis and changes the shape of the firm.

Adding a sales agent changes the *type* of the sales floor, because two agents
must each be told what to sell. That looks like it needs a recompile. It does
not, for a reason worth the repository: the finite family of topologies is
itself a container, and moving between them is routing.

Built on the four combinators of §5 of Neil Ghani's *Containers for Typed
Agentic AI*, vendored unmodified into [`lib/`](lib/). Requires
[Deno](https://deno.com) 2.x. No install step, no dependencies.

```
deno check *.ts lib/*.ts     # includes the type tests; fails in both directions
deno run firm-run.ts         # six years, three configurations
deno run ceo-run.ts          # eight years under a CEO that resizes the floor
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

## The CEO, and why it does not need a compiler

`ceo.ts` adds an agent above sales that orchestrates the topology. Its codomain
depends on its state — next year's floor may be a different size, with a
different prompt shape — and a worker `A ⊗ X → Y` has a *fixed* codomain. So at
first sight a CEO is not a worker.

It is, because `S` is finite. Take the total container

```
Ŷ  =  Σ (s : S). Y(s)  =  Y(s₁) + Y(s₂) + Y(s₃)
```

A finite sum of containers is `+`, which `lib/algebra.ts` has had all along and
which no other project in this family uses. `CEO : A ⊗ X → Ŷ` is an ordinary
morphism again, and choosing a topology is choosing a summand.

**The choice is made from the state, never from a reply.** Branching on a reply
is the one thing `SeqC` forbids; branching on state is free. Deferring by one
tick is what makes it legal:

> Workers are the repair for that restriction. `bwd` puts the reply into the
> state, and next tick `fwd` branches on the state. The one-year lag in the
> trace is not a modelling choice — it is the price of the restriction, showing
> up as a calendar.

### The finding

The exercise changed its own mind while being written. `sumC` and `tensorC`
build **runners**, and a runner is a description: `leaf` holds a port,
`tensorC` holds two runners. Nothing is contacted until a shape is `run`, and a
shape names exactly one summand.

```
  year  floor  agents prompted  revenue  unsold   next year
  1928     1              1         5       7      run two
  1929     2              2        10       2      run three
  1930     3              3        12       0      run three
  …
  eight-year revenue 87, agent prompts 21
```

Six agents exist in the sum from the first line. In 1928 exactly one is
prompted. So:

**The Σ construction converts recompilation into routing, for any family you
are willing to enumerate in advance.** The compiler is needed exactly when the
CEO wants to leave the family — and the family is finite precisely so that it
cannot.

That is the safety argument, and it is stronger than a human review step. The
CEO gets real authority: it decides, each year, what shape the firm has. It
cannot invent an interface, because `decide` is a total function into three
values and the decoder rejects anything else. Review moves from *approving every
rebuild* to *approving the family once*, which is what a type is for.

### What `sumC` does to replies

The first version of `ceo.ts` did not compile, and the error is worth keeping:

```
Property 'value' does not exist on type '{ left: {...}; right: {...} }'
```

`sumC` tags **shapes** and leaves **positions** alone — `pos (Left p) = c.Pos p`
— so the reply comes back as the tensor's own, unwrapped. Routing is visible
going down and invisible coming back, which is right: you know which branch you
took. `stalin/PLAN-routing-agent.md` predicted this in prose;
`ceo-type-tests.ts` now asserts it so the warning cannot rot.

## What this does not demonstrate

- **The `product` case is not exercised.** Development has no capacity bound, so
  ideas can never pile up unbuilt. `diagnose` returns `"product"` and nothing in
  `firm-run.ts` makes it.
- **The CEO is a stub, not an LLM.** `decide` is nine tokens of arithmetic. The
  architecture is what is demonstrated: that an agent in that position can be
  typed, and bounded. Replacing `decide` with a `claude -p` call and a strict
  decoder is the next piece of work, and the decoder is the whole of it.
- **Leaving the family is not demonstrated.** Everything here happens inside a
  fixed `Ŷ`. A CEO that genuinely recompiles — that wants a fourth topology —
  needs a shell, a rollback story, and `deno check` as the refusal mechanism.
  None of that is here.
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
