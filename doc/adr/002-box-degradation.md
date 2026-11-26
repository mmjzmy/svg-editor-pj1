# ADR 002: box persistence and degradation

## Status

Accepted for Phase 2.

## Context

`box` is a composite SVG shape: a `<g data-kind="box">` containing `<id>-rect`
and `<id>-label`. It must survive save/read, degrade to a normal `g` when the
plugin is absent, and reject malformed boxes without corrupting the current
document. Nested boxes and extra children should remain possible.

## Decision

- **Write.** `Box` overrides `attributes` to add `data-kind="box"`. `SvgCodec`
  writes the normal `g` attributes plus that marker. The inner rect/text keep
  their own `fill` / text content.
- **Dispatch on read.** `SvgCodec.readShape` reads `data-kind`. If the factory has
  a provider with that name, it calls `fromAttributes(kind, ...)`; otherwise it
  falls back to the element tag (`g`) and emits
  `warning: unknown data-kind box on <g>; read as <g>`. The `data-kind`
  attribute is preserved on the degraded group, so a later run with the plugin can
  recognize it again. The tag itself remains `g`.
- **Provider read.** `Box.fromAttributes` creates an empty `Box` and preserves
  non-id/non-`data-kind` attributes. `SvgCodec` attaches the child shapes, then
  calls the generic `Shape.afterRead()` hook. `Box.afterRead()` requires the direct
  children `<id>-rect` (tag `rect`) and `<id>-label` (tag `text`). Missing or
  wrong-typed required children reject the whole read; `Editor.read` therefore
  keeps the previous document. Extra children are allowed so a box can contain a
  nested box or other containers.
- **Duplicate ids.** `SvgCodec` reserves every explicit id before building shapes;
  duplicate ids reject the read. `SvgDocument.add` validates the whole new subtree
  before insertion, so `create box` with a colliding `<id>-rect`/`<id>-label`
  fails atomically and leaves no container or children.
- **Invariants.** `Box.canUngroup()` returns false and `SvgDocument.ungroup`
  rejects it. `Box.remove()` rejects deleting or moving a required
  `<id>-rect`/`<id>-label`; deleting the box itself is allowed. Extra children may
  be moved or deleted.

## Consequences

- Without the plugin, a box file remains editable as a normal group and keeps the
  marker for future upgrade. It loses box-specific `fill`/`label` semantics.
- With the plugin, a malformed box is rejected rather than producing an incomplete
  object.
- The `afterRead` hook is generic kernel surface; there is no `box` branch in the
  codec.

## Verification

- `test/box.test.ts`: create/derive ids, `data-kind` in encoded XML, decode with
  the plugin, decode without the plugin (warning + normal `g`), missing/wrong
  required children, duplicate ids, ungroup/delete/move guards, nested boxes and
  extra children.
- `test/svg.test.ts`: Phase 1 preservation test for an unknown `data-kind` group.
