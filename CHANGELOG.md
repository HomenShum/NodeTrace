# Changelog

## 2026-10-07 — NodeKit ownership handoff

- Added the README entry point and portable ownership map from PR #3, refreshed
  against main `cac0b27f163d7a90ed36cae4a73d376ad741546d`.
- Corrected the old claim that `npm run proof` includes a build: it runs three
  smoke scripts, including temporary SQLite initialization; `npm run check`
  owns the broader gate.
- Documented planned environment alignment and the unimplemented canonical
  event translator and certification receipt.
- Preserved current lifecycle scripts, dependencies, runtime, installer and UI.
  This documentation change makes no measured pipeline or visual improvement
  claim. Current-head automatic CI is recorded on
  [PR #3](https://github.com/HomenShum/NodeTrace/pull/3); historical checks on the
  July head do not certify this refresh.
