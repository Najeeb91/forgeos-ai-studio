# ForgeOS Provider Portability

ForgeOS is provider-agnostic at the product and execution-contract level.

Railway, AppDeploy, Vercel, Netlify, GitHub Actions, or another service may host one part of ForgeOS. None is the source of truth for the product.

## Source of truth
1. Git repository and source snapshots
2. Project Memory and Project Brain
3. Durable execution records
4. Provider observations

A provider is an adapter around those durable records.

## Execution contract
Every execution provider accepts a run ID, project ID/slug, source snapshot, bounded command policy, and timeout/resource policy. It returns provider identity, provider job ID, state, simulated flag, observations, artifact references, logs/errors, and timestamps.

## Routing
required capability -> configured providers -> health/cost/availability -> priority -> execute

If the selected provider becomes unavailable, ForgeOS should select another configured provider with the same capability. If none is configured, the run becomes blocked/provider_unavailable. It must never silently simulate the result.

## Current adapters
- HTTP Execution Adapter: the current real bounded executor. Its host is intentionally not part of the contract.
- GitHub Actions: secondary build/test plane backed by GitHub-hosted runners.
- AppDeploy: feature reference for AI generation, bounded repair, real build and release capabilities.
- Deployment adapters: separate from execution; source snapshots remain provider-neutral.

## Rules
- Never hard-code Railway into product logic.
- Never call deterministic fallback AI.
- Never call simulated execution real.
- Never store provider-only state as canonical project state.
- Never make one provider required for normal project portability.
- Provider credentials are optional configuration.
- Provider failure changes routing, not project architecture.

## Current shipped status (2026-09-22)
- Provider registry: shipped.
- Portable GitHub Actions E2E workflow: shipped as an independent verification plane; it is not silently used as production failover.
- Durable provider-attempt records: shipped.
- Automatic per-run provider failover: shipped for build, AI generation/repair, and deployment adapters; each attempt is persisted against the exact run.
- Railway: current execution host adapter, but not a product dependency.
