# ForgeOS AI Studio

Build ForgeOS, an independent Universal AI Software Factory. This is the product foundation, not a demo and not a clone of an existing app builder.

## Runtime architecture

ForgeOS is designed as a provider-agnostic software factory:

- Web application: React + TypeScript
- Forge worker: isolated worker service for planning/build/repair/deployment orchestration
- Database: PostgreSQL/Neon
- AI: provider adapter layer; OpenAI can be used directly
- Source control: GitHub
- Deployment: Vercel adapter
- Infrastructure: Railway services for the portable web/worker runtime

The architecture deliberately avoids making AppDeploy the product's permanent control plane. AppDeploy can remain an optional adapter while ForgeOS's core runtime is portable.

## Product lifecycle

Idea → Requirements → Architecture → UI → Data → Backend → Integrations → Build → Test → Repair → Snapshot → GitHub → Preview → Deploy → Update

## Product principles

- Real source, real builds and real provider deployments
- No fabricated success states or fake URLs
- Durable project/run history
- Human approval for high-impact actions
- Auditability of AI changes
- Provider-agnostic architecture
- Multi-project foundation
- Mobile-friendly, desktop engineering workspace
- Extensible toward isolated build sandboxes, browser automation and additional deployment providers

## Benchmark application

PumpOS is the benchmark application used to validate that ForgeOS can turn a serious natural-language requirement into a maintainable application.

## Development

git clone <this-repository-url>
cd <repository-name>
npm install
npm run dev
