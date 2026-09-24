
import { randomUUID } from "node:crypto";

import { createAIProviders } from "./providers/ai-provider.mjs";
import { selectProvider } from "./providers/registry.mjs";
import { ensureProject } from "./approval-core.mjs";
import { transitionRun } from "./run-state.mjs";

const aiProviders = createAIProviders();
const preferredAIProvider = process.env.FORGEOS_AI_PROVIDER || "openai-compatible";
