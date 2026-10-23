# Follow Rules

Rules for anyone (human or Claude) working in this repo.

## Commits and pushes

- Do not commit or push until the owner explicitly says so ("commit", "push").
- When told to commit and push, split the work into small commits (for example backend, frontend, docs) so any one of them can be reverted on its own with `git revert <sha>`.
- Stage files by name. Never `git add -A`, so unrelated local files (`.claude/settings.local.json`, `.playwright-mcp/`, zips, scratch scripts) are not committed.
- Never rewrite pushed history (no force-push). Undo with `git revert`.
