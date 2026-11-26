# ADR 002: box persistence and degradation

`box` is a Group-shaped provider with derived `id-rect` and `id-label` children. It is serialized as a normal group in the current codec; an unregistered reader therefore retains editable SVG structure as a group. A later codec revision will add `data-kind=box` round-trip metadata without changing the provider contract.
