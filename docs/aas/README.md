# AAS selection for the BreadBit foundation

The seven skill IDs in `aas-stack.json` were explicitly selected for BreadBit, composed with the local AAS `compose_stack` API, and checked with `inspect_stack`. `inspection.json` reports `status: valid` and no unknown IDs. This validates catalog identity and manifest structure; it does not certify implementation correctness, security, accessibility, or release readiness.

## Reproducible provenance

- AAS package: `agentic-awesome-skills`, version `19.11.0`.
- Catalog digest: `sha256-1f225febafbc8cb43666ed20ce23768b4576cf8bb7c545992e09945e69e67382`.
- Manifest digest: `sha256-4434decd679458979be7efa986472943eb552efab3faa64316e716056f034bd7`.
- Local source: `C:/Users/ishan/Documents/Codex/2026-10-20/skill-creator-c-users-ishan-codex/work/agentic-awesome-skills-main`.
- Execution: Node 24.13.0, local `McpServer.handle` JSON-RPC interface, protocol `2025-06-18`. Direct Codex AAS tools were unavailable. Missing AJV was supplied from an already installed npm cache using NODE_PATH; no skills were installed or applied.
- `discovery.json` contains actual broad and refined search results and candidate availability. It is a plain research record, **not** the canonical AAS selection-evidence sidecar. Full candidate instructions were requested via `get_skill(includeContent: true)` and selected guidance was read. The architecture trade-off guide and agent-tool-builder detailed guide were also read locally.

## Capability coverage and engineering consequences

| Capability | Selected guidance | Consequence for BreadBit |
|---|---|---|
| Architecture/runtime | `architecture` | Keep independent domain, adapters and shell boundaries; document meaningful trade-offs. Tauri-specific catalog gap remains. |
| Languages/frameworks | `react-state-management` | Normalize stable IDs; separate project state, transient selection and simulation observations; avoid duplicated derived state. |
| Domain behavior | No suitable catalog match | `circuit` search returned alarm resistor and software circuit-breaker topics; none is a microcontroller simulation skill. Use Velxio source and explicit qualification tests. |
| Data/storage | `architecture`, `react-state-management` | Version project documents; centralize transactions and undo/redo; keep view state separate from electrical connectivity. These are design applications, not a dedicated persistence recipe. |
| External integrations | `agent-tool-builder` | Validate structured inputs before edits; expose explicit typed failure and unavailable results; keep compilation distinct from observed simulation evidence. |
| Testing/quality | `javascript-testing-patterns` | Test import/export round trips, rejected edits, undo/redo and lifecycle behavior; test visible workflows rather than implementation details. |
| Security/privacy | `security-auditor` | Trace imported project data to filesystem and process boundaries; constrain native capabilities and paths; do not expose credentials through project files or logs. No production penetration test or compliance certification. |
| UX/accessibility | `accessibility-compliance-accessibility-audit` | Preserve labels, focus, keyboard actions and meaningful state messages. Actual keyboard/screen-reader/contrast audits remain required; a skeleton is not WCAG certification. |
| Deployment/operations | Not applicable to this implementation pass | The current scope is a local development frame. Signed releases, installers and update rollout require a later qualification pass. `deployment-procedures` was inspected but its website/server deployment details do not supply Tauri packaging expertise. |
| Maintenance workflow | `git-workflow` | Keep upstream provenance and small reviewable changes; record validation evidence. No repository publish, push, release or host configuration changes are authorized by this skill selection. |

## Candidate comparisons

- `architecture` was preferred over `architecture-decision-records`: it already includes trade-off recording while covering the actual module boundary work.
- `react-state-management` was preferred over `react-patterns`: synchronization and project/history state are the immediate engineering risks; React server-component guidance is irrelevant to this local shell.
- `agent-tool-builder` was preferred over generic `api-design-principles`: structured agent operations and failure semantics matter more than REST/GraphQL conventions.
- `javascript-testing-patterns` was preferred over `vitest-skill`: the root harness need not adopt a specific testing framework just to satisfy a skill.
- `security-auditor` covers boundary review. The considered `secure-code-guardian` ID was not in this catalog and was excluded.
- `git-workflow` is documentation guidance only; its examples do not authorize executing Git mutation or release commands.

## Declared setup, risk and license limitations

`architecture`, `javascript-testing-patterns` and the accessibility skill declare safe risk; `react-state-management`, `agent-tool-builder`, `security-auditor` and `git-workflow` declare critical risk. These are author labels, not measured scores. Most selected skills declare community provenance without per-skill license metadata in their frontmatter. `agent-tool-builder` declares Vibeship/Apache-2.0 provenance; `git-workflow` declares BagelHole/DevOps-Security-Agent-Skills/MIT and requires relevant CLIs and authorized access. The AAS package declares MIT. Do not infer that package licensing resolves every upstream asset's terms.

No skill scripts were executed. No new model, service account or external integration is installed by this manifest. There is no Tauri specialist match (`tauri` returned zero results); desktop runtime commands must be checked against the actual installed toolchain and documentation. All 3D work is explicitly excluded from this selection and implementation.
