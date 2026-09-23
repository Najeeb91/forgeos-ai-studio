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
- StorageProvider: object storage or local/project storage.

## Current launch infrastructure

Railway currently hosts the ForgeOS web control plane and execution worker. This is a deployment choice, not an architectural dependency.

## Migration requirement

A future provider implementation must be able to replace Railway without changing ForgeOS project data, generated source, workflow state, approvals, or product-level APIs.

## Product lifecycle

Requirement -> Project Brain -> Plan -> Generate -> Build -> Test -> Repair -> Review -> Deploy -> Monitor -> Update

All lifecycle state belongs to ForgeOS persistence and remains portable across infrastructure providers.
