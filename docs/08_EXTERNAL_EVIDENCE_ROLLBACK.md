# Rollback

1. Disable endpoint/trace options in the UI and route all new runs to deterministic mode.
2. Remove or unset provider configuration from the deployment environment.
3. Revert application files in a normal Git commit; do not rewrite shared history.
4. Preserve evidence columns unless there is a documented legal/data-retention reason to delete them. Additive nullable columns do not block deterministic operation.
5. If schema removal is required, export affected rows, confirm written authorization, and drop indexes/columns only in a reviewed migration.
6. Re-run typecheck, tests, lint, and build; then verify one deterministic Ship/Review/Block regression run.

