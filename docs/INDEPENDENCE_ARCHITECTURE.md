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
- StorageProvider: object storage or local/project storage.\n\n## Current provider routing status\n\n- AI: provider registry with automatic fallback to deterministic local generation when configured AI is unavailable.\n- Build: provider registry with health-based selection across local process and Docker.\n- Deploy: provider registry with real Vercel and Netlify implementations; health-based selection can fail over when a configured provider is unavailable. Production vendor switching remains policy-controlled.\n- Database: worker persistence now enters through a `DatabaseProvider`; PostgreSQL is the current implementation.\n- Storage: real database-backed project artifact storage is implemented behind `StorageProvider`; object storage remains a future interchangeable backend.\n- Source: GitHub provider is operational when `GITHUB_TOKEN` is configured; verified generated source can be pushed to an isolated run branch behind a durable approval gate.\n- Secrets: environment-backed provider is operational for the bounded allowlist and is used by worker credential access; future Vault/Cloud secret managers can replace it without changing product APIs.\n\nProvider boundaries are not considered complete merely because an interface exists: a provider is only marked operational when its implementation performs real work and its health check verifies the required capability.

## Current launch infrastructure

Railway currently hosts the ForgeOS web control plane and execution worker. This is a deployment choice, not an architectural dependency.

## Migration requirement

A future provider implementation must be able to replace Railway without changing ForgeOS project data, generated source, workflow state, approvals, or product-level APIs.

## Product lifecycle

Requirement -> Project Brain -> Plan -> Generate -> Build -> Test -> Repair -> Review -> Deploy -> Monitor -> Update

All lifecycle state belongs to ForgeOS persistence and remains portable across infrastructure providers.
