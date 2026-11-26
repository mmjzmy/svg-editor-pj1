# ADR 001: staged plugin registration

Plugins register against a temporary context. The loader snapshots all registries, activates one module, then compares manifest categories and names; any mismatch, duplicate, or activation exception restores the snapshot. This gives one undo-like boundary for loading and lets later plugins continue.
