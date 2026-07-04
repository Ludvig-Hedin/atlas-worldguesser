<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

# Documentation is mandatory

**Every change updates the docs — no exceptions.** Whenever you add, change, or
remove a feature, route, config, script, env var, data model, or user-facing
behavior, you MUST update the documentation in the same unit of work:

- `README.md` — features (the Status list), setup, scripts, data provenance, and
  any new route or configuration. Keep it accurate on every change.
- Any feature/architecture/status doc under `docs/` that the change touches.
- Code comments where behavior or intent is non-obvious.

This applies to every agent and every session — treat missing/stale docs as an
incomplete task. Update docs before committing.
