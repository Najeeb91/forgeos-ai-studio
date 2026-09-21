import { checkDatabaseReadiness } from "./index";
import { getFullProject } from "./queries";
import { getProject } from "@/lib/forge/data";

async function verifyPersistence() {
  console.log("----------------------------------------");
  console.log("ForgeOS Persistence Foundation Verification");
  console.log("----------------------------------------\n");

  const isReady = await checkDatabaseReadiness();

  if (!isReady) {
    console.log("🛑 DATABASE STATUS: Unavailable");
    console.log("   No valid DATABASE_URL provided, or the database is unreachable.");
    console.log("   The application will gracefully fallback to local demo data.");
    console.log("   This is an expected environment limitation, not an application failure.");
    process.exit(0);
  }

  console.log("✅ DATABASE STATUS: Connected and Ready");

  const { sql } = await import("./index");
  if (sql) {
    console.log("\n📊 TABLE COUNTS:");
    const tables = [
      "projects",
      "project_brain_versions",
      "pipeline_stages",
      "source_snapshots",
      "source_files",
      "ai_runs",
      "ai_run_steps",
      "ai_events",
      "approvals",
      "test_runs",
      "test_results",
      "deployments",
      "audit_events",
    ];
    for (const table of tables) {
      try {
        const res = await sql`SELECT count(*) as c FROM ${sql(table)}`;
        console.log(`   - ${table.padEnd(25)}: ${res[0]?.["c"] ?? 0} rows`);
      } catch (e) {
        console.log(`   - ${table.padEnd(25)}: Error (Table missing?)`);
      }
    }
    console.log("");
  }

  const slug = "pump-os";
  const mockProject = getProject(slug);

  if (!mockProject) {
    console.error("❌ MOCK DATA: Missing pump-os seed payload.");
    process.exit(1);
  }

  console.log("🔍 Running round-trip verification for seeded project: 'pump-os'...");
  const dbProject = await getFullProject(slug);

  if (!dbProject) {
    console.error("❌ VERIFICATION FAILED: Project not found in database.");
    console.log("   Run `npm run db:push` followed by `npm run db:seed` to populate the DB.");
    process.exit(1);
  }

  console.log("✅ QUERY SUCCESS: Successfully retrieved joined relational records.");

  // Lightweight checks to ensure structural parity
  const checks = [
    { name: "Project ID", pass: dbProject.id === mockProject.id },
    { name: "Project Slug", pass: dbProject.slug === mockProject.slug },
    {
      name: "Brain Requirements",
      pass: dbProject.brain.requirements.length === mockProject.brain.requirements.length,
    },
    {
      name: "Brain Architecture",
      pass: dbProject.brain.architecture.length === mockProject.brain.architecture.length,
    },
    { name: "Pipeline Stages", pass: dbProject.stages.length === mockProject.stages.length },
    { name: "AI Runs", pass: dbProject.runs.length === mockProject.runs.length },
    { name: "Deployments", pass: dbProject.deployments.length === mockProject.deployments.length },
  ];

  let failed = false;
  checks.forEach((check) => {
    if (check.pass) {
      console.log(`   [PASS] ${check.name}`);
    } else {
      console.error(`   [FAIL] ${check.name}`);
      failed = true;
    }
  });

  if (failed) {
    console.error("\n❌ VERIFICATION FAILED: Structural mismatch detected in mapped data.");
    process.exit(1);
  }

  console.log("\n🚀 VERIFICATION PASSED: Database mapped successfully to ForgeOS types.");
  process.exit(0);
}

verifyPersistence().catch((err) => {
  console.error("Verification script encountered an unexpected error:", err);
  process.exit(1);
});
