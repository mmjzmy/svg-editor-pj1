# ADR 003: modified-star state

The tree decorator extension point receives each rendered line and owns its state. The Phase 2 decorator is intentionally opt-in and preserves the Phase 1 baseline when disabled. A production dirty decorator will compare document snapshots at save points and mark descendants whose content differs; ancestor rows remain unmarked, and decorators compose in registration order.
