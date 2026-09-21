export type WorkerSourceFile = {
  path: string;
  content: string;
};

export type WorkerBuildResponse = {
  ok?: boolean;
  jobId: string;
  runId: string | null;
  state: "passed" | "failed";
  phase: string;
  simulated: false;
  artifact?: { type: string; path: string } | null;
  install?: { ok: boolean; stdout: string; stderr: string; error: string | null };
  build?: { ok: boolean; stdout: string; stderr: string; error: string | null };
  policy?: { workspaceOnly: boolean; commandAllowlist: string[]; maxDurationMs: number; maxOutputBytes: number; network: string };
  error?: string;
};

function workerConfig() {
  const url = process.env.FORGEOS_WORKER_URL;
  const token = process.env.FORGEOS_WORKER_TOKEN;
  if (!url) throw new Error("FORGEOS_WORKER_URL is not configured");
  if (!token) throw new Error("FORGEOS_WORKER_TOKEN is not configured");
  return { url: url.replace(/\/$/, ""), token };
}

export async function executeBuild(runId: string, files: WorkerSourceFile[]): Promise<WorkerBuildResponse> {
  const { url, token } = workerConfig();
  const response = await fetch(`${url}/worker/jobs`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ runId, phase: "build", files }),
  });
  const text = await response.text();
  let payload: WorkerBuildResponse;
  try {
    payload = JSON.parse(text) as WorkerBuildResponse;
  } catch {
    throw new Error(`Execution worker returned invalid JSON (HTTP ${response.status})`);
  }
  if (!response.ok) {
    throw new Error(payload.error || payload.build?.stderr || payload.install?.stderr || `Execution worker failed with HTTP ${response.status}`);
  }
  if (payload.simulated !== false) throw new Error("Execution worker did not report a real execution");
  return payload;
}
