import type { FileNode, Project, ProviderEntry, StageId } from "./types";

export const STAGE_ORDER: { id: StageId; label: string; blurb: string }[] = [
  { id: "requirements", label: "Requirements", blurb: "Intent captured and scoped" },
  { id: "architecture", label: "Architecture", blurb: "System shape and decisions" },
  { id: "ui", label: "UI", blurb: "Screens, flows, design system" },
  { id: "data", label: "Data", blurb: "Schema, policies, migrations" },
  { id: "backend", label: "Backend", blurb: "Server logic and APIs" },
  { id: "integrations", label: "Integrations", blurb: "External providers wired" },
  { id: "test", label: "Test", blurb: "Suites and diagnostics" },
  { id: "fix", label: "Fix", blurb: "Failure triage and repair" },
  { id: "deploy", label: "Deploy", blurb: "Release and rollout" },
];

const pumpFiles: FileNode[] = [
  {
    path: "src",
    kind: "dir",
    children: [
      {
        path: "src/routes",
        kind: "dir",
        children: [
          {
            path: "src/routes/index.tsx",
            kind: "file",
            language: "tsx",
            loc: 148,
            status: "modified",
            content: `import { createFileRoute } from "@tanstack/react-router";
import { StationMap } from "@/components/station-map";
import { ShiftSummary } from "@/components/shift-summary";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(stationsQuery),
  component: Dispatch,
});

function Dispatch() {
  return (
    <main className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <StationMap />
      <ShiftSummary />
    </main>
  );
}`,
          },
          {
            path: "src/routes/stations.$stationId.tsx",
            kind: "file",
            language: "tsx",
            loc: 212,
            status: "new",
            content: `export const Route = createFileRoute("/stations/$stationId")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(stationQuery(params.stationId)),
  component: StationDetail,
});`,
          },
        ],
      },
      {
        path: "src/lib",
        kind: "dir",
        children: [
          {
            path: "src/lib/pricing.ts",
            kind: "file",
            language: "ts",
            loc: 96,
            status: "modified",
            content: `export function computeFuelPrice(base: number, tier: Tier, taxRate: number) {
  const tiered = base * TIER_MULTIPLIER[tier];
  return Math.round(tiered * (1 + taxRate) * 100) / 100;
}`,
          },
          {
            path: "src/lib/telemetry.functions.ts",
            kind: "file",
            language: "ts",
            loc: 134,
            status: "unchanged",
            content: `export const ingestPumpReading = createServerFn({ method: "POST" })
  .inputValidator((d) => ReadingSchema.parse(d))
  .handler(async ({ data }) => recordReading(data));`,
          },
        ],
      },
    ],
  },
  {
    path: "supabase/migrations",
    kind: "dir",
    children: [
      {
        path: "supabase/migrations/0003_pump_readings.sql",
        kind: "file",
        language: "sql",
        loc: 42,
        status: "new",
        content: `create table public.pump_readings (
  id uuid primary key default gen_random_uuid(),
  pump_id uuid not null references public.pumps(id) on delete cascade,
  litres numeric(10,3) not null,
  recorded_at timestamptz not null default now()
);

grant select, insert on public.pump_readings to authenticated;
grant all on public.pump_readings to service_role;
alter table public.pump_readings enable row level security;`,
      },
    ],
  },
];

const pumpOS: Project = {
  id: "prj_pumpos",
  slug: "pumpos",
  name: "PumpOS",
  tagline: "Fuel retail operations platform",
  description:
    "Benchmark ForgeOS application. Multi-station fuel retail operations: pump telemetry, shift reconciliation, pricing control, wet-stock loss detection and operator dispatch.",
  status: "building",
  health: "attention",
  createdAt: "2026-07-02T09:12:00Z",
  updatedAt: "2026-09-20T18:41:00Z",
  owner: "Dr Najeeb Khan",
  stack: ["TypeScript", "React", "TanStack Start", "Postgres", "Tailwind"],
  benchmark: true,
  preview: { route: "/dispatch", status: "ready", lastBuiltAt: "2026-09-20T18:38:00Z" },
  stages: [
    {
      id: "requirements",
      label: "Requirements",
      status: "complete",
      progress: 100,
      summary: "38 requirements approved across dispatch, pricing and reconciliation.",
      updatedAt: "2026-08-04T10:20:00Z",
    },
    {
      id: "architecture",
      label: "Architecture",
      status: "complete",
      progress: 100,
      summary: "Event-sourced telemetry ingestion with read models per station.",
      updatedAt: "2026-08-09T15:02:00Z",
    },
    {
      id: "ui",
      label: "UI",
      status: "complete",
      progress: 100,
      summary: "Dispatch board, station detail, pricing console, shift close flow.",
      updatedAt: "2026-09-01T12:44:00Z",
    },
    {
      id: "data",
      label: "Data",
      status: "needs_approval",
      progress: 82,
      summary: "Migration 0003 adds pump_readings partitioning — destructive index rebuild.",
      updatedAt: "2026-09-20T18:30:00Z",
    },
    {
      id: "backend",
      label: "Backend",
      status: "running",
      progress: 61,
      summary: "Wet-stock variance service and reconciliation jobs in generation.",
      updatedAt: "2026-09-20T18:40:00Z",
    },
    {
      id: "integrations",
      label: "Integrations",
      status: "pending",
      progress: 35,
      summary: "Payment terminal adapter pending credentials.",
      updatedAt: "2026-09-18T09:10:00Z",
    },
    {
      id: "test",
      label: "Test",
      status: "blocked",
      progress: 48,
      summary: "2 integration tests failing on variance rounding.",
      updatedAt: "2026-09-20T17:55:00Z",
    },
    {
      id: "fix",
      label: "Fix",
      status: "pending",
      progress: 20,
      summary: "Triage queued behind backend generation.",
      updatedAt: "2026-09-20T17:58:00Z",
    },
    {
      id: "deploy",
      label: "Deploy",
      status: "pending",
      progress: 0,
      summary: "Staging release held until test stage is green.",
      updatedAt: "2026-09-19T20:02:00Z",
    },
  ],
  brain: {
    vision:
      "Give fuel retail operators a single operational surface: real-time pump telemetry, provable shift reconciliation and fast loss detection, without per-station spreadsheets.",
    requirements: [
      {
        id: "req_01",
        title: "Live pump telemetry ingestion",
        detail:
          "Accept readings from pump controllers at up to 4 Hz per nozzle with idempotent writes keyed on controller sequence number.",
        kind: "functional",
        priority: "must",
        status: "implemented",
      },
      {
        id: "req_02",
        title: "Shift reconciliation with variance proof",
        detail:
          "Every closed shift produces an immutable reconciliation record linking meter deltas, tank dips and till totals.",
        kind: "functional",
        priority: "must",
        status: "approved",
      },
      {
        id: "req_03",
        title: "Wet-stock loss alerting",
        detail:
          "Detect sustained variance above 0.35% over a rolling 24h window and raise an operator alert with supporting readings.",
        kind: "functional",
        priority: "must",
        status: "draft",
      },
      {
        id: "req_04",
        title: "Price changes require dual approval",
        detail: "Any price publish affecting more than one station requires a second approver.",
        kind: "constraint",
        priority: "must",
        status: "approved",
      },
      {
        id: "req_05",
        title: "Dispatch board loads under 1.5s on 3G",
        detail: "Server-rendered first paint with streamed station rows.",
        kind: "non_functional",
        priority: "should",
        status: "approved",
      },
      {
        id: "req_06",
        title: "Offline-tolerant station terminal",
        detail: "Terminal queues readings locally for up to 6 hours and replays on reconnect.",
        kind: "non_functional",
        priority: "could",
        status: "draft",
      },
    ],
    decisions: [
      {
        id: "dec_01",
        title: "Event-sourced telemetry, projected read models",
        rationale:
          "Reconciliation must be reproducible and auditable; raw readings are append-only and projections can be rebuilt after logic fixes.",
        alternatives: ["Mutable current-state tables", "External time-series store"],
        status: "accepted",
        decidedAt: "2026-08-09T15:02:00Z",
      },
      {
        id: "dec_02",
        title: "Provider-agnostic AI layer via router contract",
        rationale:
          "PumpOS generation must not be bound to a single vendor; the router selects per task class and records provider in run history.",
        alternatives: ["Single-vendor SDK", "Per-feature hardcoded models"],
        status: "accepted",
        decidedAt: "2026-08-11T08:30:00Z",
      },
      {
        id: "dec_03",
        title: "Partition pump_readings by month",
        rationale: "Reading volume crosses 90M rows/year at 40 stations; queries are window-bound.",
        alternatives: ["Single table with BRIN index", "Rollup-only retention"],
        status: "proposed",
        decidedAt: "2026-09-20T18:30:00Z",
      },
    ],
    architecture: [
      {
        layer: "Client",
        choice: "React + TanStack Router, route loaders prime TanStack Query",
        note: "Dispatch board streams station rows; terminal uses a local queue.",
      },
      {
        layer: "Server logic",
        choice: "Typed server functions for app-internal calls, HTTP routes for controllers",
        note: "Controller webhooks verify HMAC signatures before ingest.",
      },
      {
        layer: "Data",
        choice: "Postgres, append-only readings + projected shift models",
        note: "RLS scoped by station membership.",
      },
      {
        layer: "AI layer",
        choice: "Provider router with task-class policies",
        note: "Codegen, review and repair tasks route independently; runs are logged.",
      },
      {
        layer: "Runtime",
        choice: "Edge-rendered app, deploy adapters per environment",
        note: "Preview, staging and production tracked separately from project metadata.",
      },
    ],
    schema: [
      {
        name: "stations",
        purpose: "Retail sites under management",
        rls: "Members of the station's org can read; managers write.",
        columns: [
          { name: "id", type: "uuid", nullable: false },
          { name: "org_id", type: "uuid", nullable: false },
          { name: "name", type: "text", nullable: false },
          { name: "timezone", type: "text", nullable: false },
        ],
      },
      {
        name: "pumps",
        purpose: "Dispensers and nozzles per station",
        rls: "Read scoped to station membership.",
        columns: [
          { name: "id", type: "uuid", nullable: false },
          { name: "station_id", type: "uuid", nullable: false },
          { name: "nozzle_count", type: "int", nullable: false },
          { name: "grade", type: "text", nullable: false },
        ],
      },
      {
        name: "pump_readings",
        purpose: "Append-only meter readings",
        rls: "Insert by service role and station terminals; read by station members.",
        columns: [
          { name: "id", type: "uuid", nullable: false },
          { name: "pump_id", type: "uuid", nullable: false },
          { name: "litres", type: "numeric(10,3)", nullable: false },
          { name: "sequence_no", type: "bigint", nullable: false, note: "Idempotency key" },
          { name: "recorded_at", type: "timestamptz", nullable: false },
        ],
      },
      {
        name: "shifts",
        purpose: "Operator shift windows and reconciliation results",
        rls: "Read by station members; close action restricted to supervisors.",
        columns: [
          { name: "id", type: "uuid", nullable: false },
          { name: "station_id", type: "uuid", nullable: false },
          { name: "opened_at", type: "timestamptz", nullable: false },
          { name: "closed_at", type: "timestamptz", nullable: true },
          { name: "variance_pct", type: "numeric(6,4)", nullable: true },
        ],
      },
      {
        name: "price_changes",
        purpose: "Audited price publishes with dual approval",
        rls: "Managers read; publish requires second approver.",
        columns: [
          { name: "id", type: "uuid", nullable: false },
          { name: "grade", type: "text", nullable: false },
          { name: "price", type: "numeric(8,3)", nullable: false },
          { name: "approved_by", type: "uuid", nullable: true },
        ],
      },
    ],
    integrations: [
      {
        id: "int_01",
        name: "Pump controller gateway",
        category: "data",
        status: "connected",
        provider: "Site controller HMAC webhook",
        note: "Signed ingest at /api/public/pump-readings.",
      },
      {
        id: "int_02",
        name: "Identity",
        category: "auth",
        status: "connected",
        provider: "Managed auth",
        note: "Email + station membership claims.",
      },
      {
        id: "int_03",
        name: "Payment terminal reconciliation",
        category: "payments",
        status: "planned",
        provider: "Terminal vendor API",
        note: "Awaiting merchant credentials from operator.",
      },
      {
        id: "int_04",
        name: "Alert delivery",
        category: "messaging",
        status: "configured",
        provider: "Transactional email + SMS fallback",
        note: "Loss alerts to duty manager rota.",
      },
      {
        id: "int_05",
        name: "Error and trace capture",
        category: "observability",
        status: "connected",
        provider: "Runtime error pipeline",
        note: "Feeds the Fix stage triage queue.",
      },
    ],
    tests: [
      {
        id: "t_01",
        name: "ingest rejects duplicate sequence numbers",
        suite: "integration",
        status: "passing",
        durationMs: 412,
      },
      {
        id: "t_02",
        name: "shift close produces immutable reconciliation",
        suite: "integration",
        status: "failing",
        durationMs: 890,
        detail: "Expected variance 0.2100, received 0.2099 — rounding applied before aggregation.",
      },
      {
        id: "t_03",
        name: "variance detector flags sustained loss",
        suite: "unit",
        status: "failing",
        durationMs: 61,
        detail: "Rolling window drops the first bucket when readings arrive out of order.",
      },
      {
        id: "t_04",
        name: "price publish blocked without second approver",
        suite: "security",
        status: "passing",
        durationMs: 205,
      },
      {
        id: "t_05",
        name: "dispatch board renders 40 stations under budget",
        suite: "e2e",
        status: "flaky",
        durationMs: 3140,
        detail: "Fails ~1 in 8 runs when map tiles are cold.",
      },
      {
        id: "t_06",
        name: "RLS blocks cross-station reads",
        suite: "security",
        status: "passing",
        durationMs: 330,
      },
    ],
    history: [
      {
        id: "ch_01",
        at: "2026-09-20T18:41:00Z",
        actor: "ai",
        actorName: "Forge Builder",
        action: "Generated wet-stock variance service",
        target: "src/lib/variance.server.ts",
        risk: "low",
        approved: true,
        diffSummary: "+186 / -4",
      },
      {
        id: "ch_02",
        at: "2026-09-20T18:30:00Z",
        actor: "ai",
        actorName: "Forge Builder",
        action: "Proposed partitioning migration (index rebuild)",
        target: "supabase/migrations/0003_pump_readings.sql",
        risk: "high",
        approved: null,
        diffSummary: "+42 / -0",
      },
      {
        id: "ch_03",
        at: "2026-09-20T17:55:00Z",
        actor: "system",
        actorName: "Test runner",
        action: "Suite run completed with 2 failures",
        target: "integration + unit",
        risk: "medium",
        approved: null,
      },
      {
        id: "ch_04",
        at: "2026-09-19T20:02:00Z",
        actor: "human",
        actorName: "Dr Najeeb Khan",
        action: "Held staging release until tests are green",
        target: "deploy/staging",
        risk: "low",
        approved: true,
      },
      {
        id: "ch_05",
        at: "2026-09-18T09:10:00Z",
        actor: "human",
        actorName: "Dr Najeeb Khan",
        action: "Approved architecture decision DEC-02",
        target: "brain/decisions",
        risk: "low",
        approved: true,
      },
    ],
  },
  files: pumpFiles,
  deployments: [
    {
      id: "dep_01",
      env: "preview",
      status: "live",
      commit: "b7c41de",
      url: "preview.pumpos.forge.app",
      at: "2026-09-20T18:38:00Z",
      adapter: "edge-preview",
    },
    {
      id: "dep_02",
      env: "staging",
      status: "queued",
      commit: "b7c41de",
      url: "staging.pumpos.forge.app",
      at: "2026-09-20T18:39:00Z",
      adapter: "edge-staging",
    },
    {
      id: "dep_03",
      env: "production",
      status: "live",
      commit: "9a10f22",
      url: "pumpos.app",
      at: "2026-09-14T07:20:00Z",
      adapter: "edge-production",
    },
  ],
  runs: [
    {
      id: "run_204",
      prompt:
        "Add wet-stock loss detection: rolling 24h variance per tank, alert duty manager above 0.35%, and show supporting readings in station detail.",
      provider: "router:codegen",
      model: "auto-selected",
      startedAt: "2026-09-20T18:29:00Z",
      status: "awaiting_approval",
      tokensIn: 18420,
      tokensOut: 9134,
      plan: [
        {
          id: "st_1",
          title: "Extend brain with loss-detection requirement",
          detail: "Record REQ-03 thresholds and alert routing in the project brain.",
          stage: "requirements",
          risk: "low",
          status: "done",
        },
        {
          id: "st_2",
          title: "Add variance projection table + migration",
          detail:
            "Create tank_variance_windows, partition pump_readings by month. Rebuilds a 90M row index.",
          stage: "data",
          risk: "high",
          status: "awaiting_approval",
        },
        {
          id: "st_3",
          title: "Generate variance service",
          detail: "Rolling window aggregation with out-of-order reading tolerance.",
          stage: "backend",
          risk: "medium",
          status: "running",
        },
        {
          id: "st_4",
          title: "Station detail evidence panel",
          detail: "Show contributing readings and dip records behind each alert.",
          stage: "ui",
          risk: "low",
          status: "queued",
        },
        {
          id: "st_5",
          title: "Regression suite for variance rounding",
          detail: "Add unit + integration coverage before any deploy.",
          stage: "test",
          risk: "low",
          status: "queued",
        },
      ],
      events: [
        {
          id: "ev_1",
          at: "18:29:04",
          level: "info",
          stage: "requirements",
          message: "Loaded project brain: 38 requirements, 3 decisions, 5 tables.",
        },
        {
          id: "ev_2",
          at: "18:29:26",
          level: "action",
          stage: "requirements",
          message: "Wrote REQ-03 (wet-stock loss alerting) to brain.",
        },
        {
          id: "ev_3",
          at: "18:30:11",
          level: "warn",
          stage: "data",
          message: "Planned migration rebuilds index on 90M rows — flagged high risk.",
        },
        {
          id: "ev_4",
          at: "18:30:12",
          level: "approval",
          stage: "data",
          message: "Paused: human approval required before destructive schema change.",
        },
        {
          id: "ev_5",
          at: "18:34:48",
          level: "action",
          stage: "backend",
          message: "Generating variance service (src/lib/variance.server.ts).",
        },
        {
          id: "ev_6",
          at: "18:40:02",
          level: "error",
          stage: "test",
          message: "2 tests failing: variance rounding, out-of-order window bucket.",
        },
      ],
    },
  ],
};

const clinicFlow: Project = {
  id: "prj_clinicflow",
  slug: "clinicflow",
  name: "ClinicFlow",
  tagline: "Outpatient scheduling and triage",
  description:
    "Appointment scheduling, triage queues and clinician rota management for multi-site outpatient clinics.",
  status: "review",
  health: "healthy",
  createdAt: "2026-08-14T11:00:00Z",
  updatedAt: "2026-09-19T16:05:00Z",
  owner: "Dr Najeeb Khan",
  stack: ["TypeScript", "React", "Postgres"],
  preview: { route: "/queue", status: "ready", lastBuiltAt: "2026-09-19T16:00:00Z" },
  stages: STAGE_ORDER.map((s, i) => ({
    id: s.id,
    label: s.label,
    status: i < 6 ? "complete" : i === 6 ? "running" : "pending",
    progress: i < 6 ? 100 : i === 6 ? 72 : 0,
    summary: s.blurb,
    updatedAt: "2026-09-19T16:05:00Z",
  })),
  brain: {
    vision: "Reduce outpatient no-shows and triage delay with a single clinic-side queue surface.",
    requirements: [],
    decisions: [],
    architecture: [],
    schema: [],
    integrations: [],
    tests: [],
    history: [],
  },
  files: [],
  deployments: [
    {
      id: "dep_c1",
      env: "preview",
      status: "live",
      commit: "4f2a901",
      url: "preview.clinicflow.forge.app",
      at: "2026-09-19T16:00:00Z",
      adapter: "edge-preview",
    },
  ],
  runs: [],
};

const ledgerLite: Project = {
  id: "prj_ledgerlite",
  slug: "ledgerlite",
  name: "LedgerLite",
  tagline: "Small-business bookkeeping",
  description:
    "Bank feed reconciliation, VAT periods and invoice tracking for owner-operated businesses.",
  status: "drafting",
  health: "healthy",
  createdAt: "2026-09-17T08:30:00Z",
  updatedAt: "2026-09-20T10:12:00Z",
  owner: "Dr Najeeb Khan",
  stack: ["TypeScript", "React"],
  preview: { route: "/", status: "cold", lastBuiltAt: "2026-09-20T10:12:00Z" },
  stages: STAGE_ORDER.map((s, i) => ({
    id: s.id,
    label: s.label,
    status: i === 0 ? "running" : i === 1 ? "pending" : "locked",
    progress: i === 0 ? 45 : 0,
    summary: s.blurb,
    updatedAt: "2026-09-20T10:12:00Z",
  })),
  brain: {
    vision: "Bookkeeping that closes a month without an accountant in the loop.",
    requirements: [],
    decisions: [],
    architecture: [],
    schema: [],
    integrations: [],
    tests: [],
    history: [],
  },
  files: [],
  deployments: [],
  runs: [],
};

export const projects: Project[] = [pumpOS, clinicFlow, ledgerLite];

export function getProject(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

export const providerRegistry: ProviderEntry[] = [
  {
    id: "pv_1",
    name: "Primary reasoning provider",
    kind: "llm",
    status: "active",
    routedFor: ["planning", "architecture", "code review"],
    latencyMs: 1840,
    note: "Default route for high-context planning tasks.",
  },
  {
    id: "pv_2",
    name: "Codegen provider",
    kind: "llm",
    status: "active",
    routedFor: ["code generation", "repair"],
    latencyMs: 960,
    note: "Lower latency route for file-level edits.",
  },
  {
    id: "pv_3",
    name: "Secondary reasoning provider",
    kind: "llm",
    status: "standby",
    routedFor: ["failover"],
    latencyMs: 2100,
    note: "Takes over on rate limit or provider outage.",
  },
  {
    id: "pv_4",
    name: "Embedding provider",
    kind: "embedding",
    status: "active",
    routedFor: ["brain retrieval", "code search"],
    latencyMs: 210,
    note: "Indexes project brain and generated source.",
  },
  {
    id: "pv_5",
    name: "Execution sandbox",
    kind: "execution",
    status: "standby",
    routedFor: ["test runs", "migrations dry-run"],
    latencyMs: 0,
    note: "Adapter contract defined; runner not yet attached.",
  },
  {
    id: "pv_6",
    name: "Deployment adapter",
    kind: "deploy",
    status: "active",
    routedFor: ["preview", "staging", "production"],
    latencyMs: 0,
    note: "Environment-scoped release adapters.",
  },
];
