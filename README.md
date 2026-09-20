# ForgeOS AI Studio

Build ForgeOS, an independent Universal AI Software Factory. This is the foundation of the product, not a demo landing page and not a clone of any existing app builder.

Product goal:
ForgeOS turns a natural-language software idea into a real, maintainable, deployable application through the lifecycle: Idea → Requirements → Architecture → UI → Database → Code → Testing → Debugging → Deployment → Updates.

For this first build, create a serious production-oriented foundation with a premium, technical, calm UI. It should feel like an AI engineering workspace, not a marketing website.

Core product areas to establish:
1. Projects/workspace dashboard
2. Project creation via natural-language prompt
3. Project Brain: persistent requirements, decisions, architecture, schema, integrations, tests and change history
4. Build pipeline / stages with clear status: Requirements, Architecture, UI, Data, Backend, Integrations, Test, Fix, Deploy
5. AI Builder workspace with prompt/input, generated plan, actions, progress, logs and human approval points
6. Live preview area
7. Files/code explorer
8. Database/schema view
9. Integrations/provider registry
10. Testing and diagnostics area
11. Deployment area
12. Activity/change history

Architecture principles:
- Provider-agnostic AI layer with a future provider router
- Application projects must not be locked to one AI vendor
- Strong separation between project metadata, generated application source, runtime/deployment state and AI execution history
- Human approval for destructive/high-risk actions
- Auditability of AI changes
- Designed for multi-project and eventually multi-user/team support
- Mobile-friendly but optimized first for a desktop engineering workspace
- Keep the architecture extensible for later browser automation, code execution, sandboxed previews, deployment adapters and native mobile packaging

Use TypeScript, React, Tailwind and shadcn/ui. Establish reusable components and a clean information architecture. Use realistic seeded ForgeOS project data rather than lorem ipsum. Include a first sample project named “PumpOS” as the benchmark application.

Do not overbuild decorative features. Prioritize the product foundation, information architecture, reusable UI primitives, and a coherent end-to-end builder experience.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0f7d2c80-8c0b-4809-8cee-3506865e9083).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
