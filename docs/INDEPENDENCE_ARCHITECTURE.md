# ForgeOS Independence Architecture

ForgeOS is the product. Infrastructure vendors are replaceable providers.

## Non-negotiable rule

No single hosting, AI, database, source-control, storage, build, or deployment vendor is part of ForgeOS's product identity.

## Provider boundaries

- AIProvider: OpenAI-compatible and future AI providers.
- DatabaseProvider: PostgreSQL-compatible backends.
- BuildProvider: bounded cloud workers, local Docker/VM, or other compute.
- DeployProvider: Vercel, AWS, Netlify, self-hosted, etc.
- SecretsProvider: platform secrets or external secret managers.
- SourceProvider: GitHub first, future GitLab/other providers.
- StorageProvider: object storage or local/project storage.\n\n## Current provider routing status\n\n- AI: provider registry with automatic fallback to deterministic local generation when configured AI is unavailable.\n- Build: provider registry with health-based selection across local process and Docker.\n- Deploy: provider registry boundary; Vercel is currently the only production implementation.\n- Database: worker persistence now enters through a `DatabaseProvider`; PostgreSQL is the current implementation.\n- Storage: provider contract and health boundary are present, but source/artifact writes still use the canonical database persistence path until a real object-storage implementation is connected.\n\nProvider boundaries are not considered complete merely because an interface exists: a provider is only marked operational when its implementation performs real work and its health check verifies the required capability.

## Current launch infrastructure

Railway currently hosts the ForgeOS web control plane and execution worker. This is a deployment choice, not an architectural dependency.

## Migration requirement

A future provider implementation must be able to replace Railway without changing ForgeOS project data, generated source, workflow state, approvals, or product-level APIs.

## Product lifecycle

Requirement -> Project Brain -> Plan -> Generate -> Build -> Test -> Repair -> Review -> Deploy -> Monitor -> Update

All lifecycle state belongs to ForgeOS persistence and remains portable across infrastructure providers.
