import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile, mkdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { randomUUID } from "node:crypto";

const MAX_FILE_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const MAX_DURATION_MS = 120000;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

function validateFiles(files) {
  if (!Array.isArray(files) || files.length === 0) throw new Error("files_required");
  let total = 0;
  for (const file of files) {
    if (!file || typeof file.path !== "string" || typeof file.content !== "string") throw new Error("invalid_file");
    if (file.path.startsWith("/") || file.path.includes("..") || file.path.includes("\\")) throw new Error("unsafe_path");
    const bytes = Buffer.byteLength(file.content);
    if (bytes > MAX_FILE_BYTES) throw new Error("file_too_large");
    total += bytes;
    if (total > MAX_TOTAL_BYTES) throw new Error("source_too_large");
  }
}

function exec(command, args, cwd) {
  return new Promise((resolveRun) => {
    execFile(command, args, {
      cwd,
      timeout: MAX_DURATION_MS,
      maxBuffer: MAX_OUTPUT_BYTES,
      env: { PATH: process.env.PATH, HOME: cwd, NODE_ENV: "production", CI: "1" },
    }, (error, stdout, stderr) => resolveRun({
      ok: !error,
      code: typeof error?.code === "number" ? error.code : error ? null : 0,
      stdout: String(stdout || "").slice(-MAX_OUTPUT_BYTES),
      stderr: String(stderr || "").slice(-MAX_OUTPUT_BYTES),
      error: error?.message || null,
    }));
  });
}

export class LocalProcessBuildProvider {
  constructor() {
    this.id = "local-process";
    this.capability = "build";
  }

  async health() {
    return { ok: true, provider: this.id, isolated: false, realExecution: true };
  }

  async build(runId, files) {
    validateFiles(files);
    const jobId = randomUUID();
    const root = await mkdtemp(join(tmpdir(), "forgeos-job-"));
    try {
      for (const file of files) {
        const target = resolve(root, file.path);
        if (!target.startsWith(root + "/")) throw new Error("unsafe_path");
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, file.content, "utf8");
      }

      const packageFile = files.find((f) => f.path === "package.json");
      if (!packageFile) throw new Error("package_json_required");
      let pkg;
      try { pkg = JSON.parse(packageFile.content); } catch { throw new Error("invalid_package_json"); }

      const scripts = pkg?.scripts || {};
      if (scripts.preinstall || scripts.postinstall || scripts.prepare) throw new Error("lifecycle_scripts_not_allowed");
      const build = typeof scripts.build === "string" ? scripts.build.trim() : "";
      if (!["vite build", "next build", "tsc --noEmit"].includes(build)) throw new Error("unsupported_build_profile");

      const install = await exec("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], root);
      if (!install.ok) return { jobId, runId, state:"failed", phase:"install", simulated:false, provider:this.id, install };

      const built = await exec("npm", ["run", "build"], root);
      const artifact = await stat(join(root, "dist")).then(() => ({type:"directory",path:"dist"})).catch(() => null);

      return {
        jobId, runId, state:built.ok ? "passed" : "failed", phase:"build", simulated:false,
        provider:this.id, artifact, build:built,
        policy:{
          workspaceOnly:true,
          commandAllowlist:["npm install --ignore-scripts --no-audit --no-fund","npm run build"],
          maxDurationMs:MAX_DURATION_MS, maxOutputBytes:MAX_OUTPUT_BYTES,
          network:"dependency-install-only"
        }
      };
    } finally {
      await rm(root, {recursive:true,force:true});
    }
  }
}

export function createBuildProvider() {
  const provider = process.env.FORGEOS_BUILD_PROVIDER || "local-process";
  if (provider === "local-process") return new LocalProcessBuildProvider();
  throw new Error("unsupported_build_provider:" + provider);
}
