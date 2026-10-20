# BreadBit contribution boundaries

- Read README.md, docs/implementation-status.md and velxio-desktop-plan.md. The current user direction integrates the 3D renderer from origin/main; see docs/3d-integration.md.
- Keep vendor/velxio at upstream.lock.json's revision; prefer adapters over vendor edits. Record unavoidable patches.
- Keep electrical identities independent of UI coordinates. Preserve upstream IDs and import extension fields.
- Distinguish design state, observations and evidence. Never report compilation, a configured tool, or a ready artifact as a passed simulation.
- AI/provider output is untrusted. Validate candidates and revisions before applying changes; do not expose unrestricted filesystem or shell tools.
- Use native project handles, not arbitrary renderer paths. Do not auto-start the unauthenticated upstream backend in packaged builds.
- Run npm test, npm run typecheck and npm run build for affected integration changes. Report upstream diagnostics and unavailable native checks honestly.
- Keep source scripts cross-platform and launch desktop helpers without visible consoles unless interactive access is requested.
