export type WorkerSourceFile = { path: string; content: string };
export type WorkerBuildResponse = {
  ok?: boolean;
  jobId?: string;
  runId: string | null;
  state: "awaiting_approval" | "passed" | "failed" | "executing";
  phase?: string;
  simulated: false;
  artifact?: { type: string; path: string } | null;
  install?: unknown;
  build?: unknown;
  policy?: unknown;
  error?: string;
  generationMode?: string;
  provider?: string;
  model?: string;
  sourceFiles?: WorkerSourceFile[];
  projectId?: string | null;
  snapshotId?: string | null;
  approval?: unknown;
  plan?: unknown[];
  approvalRequired?: boolean;
};

function workerConfig() {
  const url = process.env.FORGEOS_EXECUTOR_URL || process.env.FORGEOS_WORKER_URL;
  const token = process.env.FORGEOS_WORKER_TOKEN;
  if (!url) throw new Error("FORGEOS_EXECUTOR_URL is not configured");
  if (!token) throw new Error("FORGEOS_WORKER_TOKEN is not configured");
  return { url: url.replace(/\/$/, ""), token };
}

export async function parseWorkerResponse<T>(
  response: Response,
  serviceLabel: string = "Execution worker",
): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.toLowerCase().includes("application/json");

  let payload: Record<string, unknown> | null = null;
  if (isJson) {
    try {
      payload = (await response.json()) as Record<string, unknown>;
    } catch {
      throw new Error(`${serviceLabel} returned invalid JSON (HTTP ${response.status})`);
    }
  } else {
    if (!response.ok) {
      throw new Error(`${serviceLabel} failed with HTTP ${response.status}`);
    }
    throw new Error(`${serviceLabel} returned invalid JSON (HTTP ${response.status})`);
  }

  if (!response.ok) {
    const buildStderr = (payload?.build as { stderr?: string } | undefined)?.stderr;
    const installStderr = (payload?.install as { stderr?: string } | undefined)?.stderr;
    const errorMsg =
      (payload?.error as string | undefined) ||
      buildStderr ||
      installStderr ||
      `${serviceLabel} failed with HTTP ${response.status}`;
    throw new Error(errorMsg);
  }

  return payload as T;
}

export async function executeBuild(
  runId: string,
  projectSlug: string,
  prompt: string,
  approved = false,
): Promise<WorkerBuildResponse> {
  const { url, token } = workerConfig();
  const response = await fetch(`${url}/worker/build`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ runId, projectSlug, prompt, approved }),
  });
  const payload = await parseWorkerResponse<WorkerBuildResponse>(response, "Execution worker");
  if (payload.simulated !== false)
    throw new Error("Execution worker did not report a real execution");
  return payload;
}

export async function getLatestGeneratedSource(projectSlug: string): Promise<WorkerSourceFile[]> {
  const { url, token } = workerConfig();
  const response = await fetch(`${url}/worker/source/latest`, {
    headers: {
      authorization: `Bearer ${token}`,
      "x-forgeos-project-slug": projectSlug,
    },
  });
  const payload = await parseWorkerResponse<{ files?: WorkerSourceFile[] }>(
    response,
    "Generated source lookup worker",
  );
  return payload.files ?? [];
}

export async function getProjectFromWorker(
  projectSlug: string,
): Promise<{ project?: unknown } | null> {
  const { url, token } = workerConfig();
  const response = await fetch(`${url}/worker/project/${encodeURIComponent(projectSlug)}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return parseWorkerResponse<{ project?: unknown }>(response, "Project lookup worker");
}

export async function approveBuild(
  runId: string,
  approvalId: string,
  decision: "approved" | "rejected" = "approved",
): Promise<unknown> {
  const { url, token } = workerConfig();
  const response = await fetch(`${url}/worker/approve`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ runId, approvalId, decision }),
  });
  const payload = await parseWorkerResponse<Record<string, unknown>>(response, "Approval worker");
  if (payload.simulated !== false) throw new Error("Approval was not durably recorded");
  return payload;
}

export async function createForgeProject(input: {
  slug: string;
  name: string;
  prompt: string;
}): Promise<{ project: unknown }> {
  const { url, token } = workerConfig();
  const response = await fetch(url + "/worker/project", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + token,
    },
    body: JSON.stringify(input),
  });
  const payload = await parseWorkerResponse<Record<string, unknown> & { project: unknown }>(
    response,
    "Project creation worker",
  );
  if (payload.simulated !== false) throw new Error("Project creation was not reported as real");
  return payload;
}

export async function getDeploymentStatus(runId: string): Promise<unknown> {
  const { url, token } = workerConfig();
  const response = await fetch(url + "/worker/deploy/status?runId=" + encodeURIComponent(runId), {
    headers: { authorization: "Bearer " + token },
  });
  const payload = await parseWorkerResponse<Record<string, unknown>>(
    response,
    "Deployment status worker",
  );
  if (payload.simulated !== false) throw new Error("Deployment status was not reported as real");
  return payload;
}

export async function listProjectsFromWorker(): Promise<unknown[]> {
  const { url, token } = workerConfig();
  const response = await fetch(url + "/worker/projects", {
    headers: { authorization: "Bearer " + token },
  });
  const payload = await parseWorkerResponse<Record<string, unknown> & { projects?: unknown[] }>(
    response,
    "Project list worker",
  );
  if (payload.simulated !== false) throw new Error("Project list was not reported as real");
  return Array.isArray(payload.projects) ? payload.projects : [];
}

export async function recoverForgeRun(runId: string): Promise<unknown> {
  const { url, token } = workerConfig();
  const response = await fetch(url + "/worker/run/recover", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + token,
    },
    body: JSON.stringify({ runId }),
  });
  const payload = await parseWorkerResponse<Record<string, unknown>>(
    response,
    "Run recovery worker",
  );
  if (payload.simulated !== false) throw new Error("Run recovery was not durably recorded");
  return payload;
}

export async function getForgeRun(runId: string): Promise<unknown> {
  const { url, token } = workerConfig();
  const response = await fetch(url + "/worker/run/" + encodeURIComponent(runId), {
    headers: { authorization: "Bearer " + token },
  });
  const payload = await parseWorkerResponse<Record<string, unknown>>(
    response,
    "Run history worker",
  );
  if (payload.simulated !== false) throw new Error("Run history was not reported as real");
  return payload;
}
