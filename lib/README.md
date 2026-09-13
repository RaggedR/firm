# lib — vendored

`algebra.ts`, `wire.ts` and `delegate.ts` are copied verbatim from `federation`,
which copied them verbatim from `stalin`, which copied them verbatim from
`tower`, an implementation of §4–§5 of Neil Ghani's *Containers for Typed
Agentic AI*: the four combinators (`+`, `⊠`, `◁`, `×`) as first-class values,
and a delegate/serve pair that makes each hop between servers an actual CLI
process.

They are vendored rather than depended on so this repository stands alone. The
same library now serves a planned economy, a Čech cocycle and a firm. That is
the point of vendoring it: three subjects with nothing in common, and no
divergence in the library, is the strongest available evidence that it is a
library.

`wire.ts` reads an environment variable named `STALIN_INPROC`. The name belongs
to the first project. It is left alone because these files are vendored
unmodified, and a rename here would be the beginning of a fork.

There is exactly **one** divergence from upstream, inherited: `wire.ts`
originally imported `isRecord` from the tower's double-entry bookkeeping module,
so the four-line helper is inlined instead. Any other difference is a bug here,
not a feature.
