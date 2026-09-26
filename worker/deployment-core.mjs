export async function deployVercel({ token, projectName, files, environment = "production" }) {
  if (!token) throw new Error("vercel_credentials_required");
  const response = await fetch("https://api.vercel.com/v13/deployments", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: projectName,
      target: environment === "production" ? "production" : "preview",
      files: files.map((f) => ({ file: f.path, data: f.content })),
      projectSettings: {
        framework: "vite",
        buildCommand: "npm run build",
        outputDirectory: "dist",
        installCommand: "npm install",
      },
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(body?.error?.message || body?.error?.code || "vercel_deployment_failed");
  return {
    provider: "vercel",
    simulated: false,
    deploymentId: body?.id || null,
    url: body?.url ? "https://" + String(body.url).replace(/^https?:\/\//, "") : null,
    state: body?.readyState || body?.state || "BUILDING",
    project: projectName,
    environment,
  };
}

export async function getVercelDeployment({ token, deploymentId }) {
  if (!token) throw new Error("vercel_credentials_required");
  if (!deploymentId) throw new Error("vercel_deployment_id_required");
  const response = await fetch(
    "https://api.vercel.com/v13/deployments/" + encodeURIComponent(deploymentId),
    {
      headers: { Authorization: "Bearer " + token },
    },
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(body?.error?.message || body?.error?.code || "vercel_deployment_status_failed");
  return {
    provider: "vercel",
    simulated: false,
    deploymentId: body?.id || deploymentId,
    url: body?.url ? "https://" + String(body.url).replace(/^https?:\/\//, "") : null,
    state: body?.readyState || body?.state || "UNKNOWN",
    project: body?.name || null,
    environment: body?.target === "production" ? "production" : "preview",
    raw: body,
  };
}
