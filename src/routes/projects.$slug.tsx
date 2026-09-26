import { createFileRoute, Link, Outlet, notFound } from "@tanstack/react-router";

import { PageHeader, WorkspaceShell } from "@/components/forge/shell";
import { Dot, Pill } from "@/components/forge/status";
import { getForgeProject } from "@/lib/forge/remote.functions";

export const Route = createFileRoute("/projects/$slug")({
  loader: async ({ params }) => {
    const result = await getForgeProject({ data: params.slug });
    if (!result) throw notFound();
    return result;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.project.name} — ForgeOS` : "Project — ForgeOS" },
      {
        name: "description",
        content: loaderData?.project.tagline ?? "A ForgeOS project workspace.",
      },
      {
        property: "og:title",
        content: loaderData ? `${loaderData.project.name} — ForgeOS` : "ForgeOS",
      },
      {
        property: "og:description",
        content: loaderData?.tagline ?? "A ForgeOS project workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectLayout,
});

const tabs = [
  { to: "/projects/$slug", label: "Overview", exact: true },
  { to: "/projects/$slug/builder", label: "Builder", exact: false },
  { to: "/projects/$slug/brain", label: "Brain", exact: false },
  { to: "/projects/$slug/preview", label: "Preview", exact: false },
  { to: "/projects/$slug/files", label: "Files", exact: false },
  { to: "/projects/$slug/data", label: "Data", exact: false },
  { to: "/projects/$slug/integrations", label: "Integrations", exact: false },
  { to: "/projects/$slug/tests", label: "Tests", exact: false },
  { to: "/projects/$slug/deploy", label: "Deploy", exact: false },
  { to: "/projects/$slug/history", label: "History", exact: false },
] as const;

function ProjectLayout() {
  const { project } = Route.useLoaderData();
  const { slug } = Route.useParams();

  return (
    <WorkspaceShell>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {project.name}
            {project.benchmark ? <Pill tone="primary">benchmark</Pill> : null}
          </span>
        }
        description={project.description}
        meta={
          <>
            <Pill
              tone={
                project.health === "healthy"
                  ? "success"
                  : project.health === "attention"
                    ? "warning"
                    : "danger"
              }
            >
              <Dot
                tone={
                  project.health === "healthy"
                    ? "success"
                    : project.health === "attention"
                      ? "warning"
                      : "danger"
                }
              />
              {project.status}
            </Pill>
            <Pill tone="neutral">owner: {project.owner}</Pill>
            <Pill tone="info">{project.stack.join(" · ")}</Pill>
          </>
        }
      />

      <div className="sticky top-0 z-10 overflow-x-auto border-b border-border bg-surface/80 backdrop-blur">
        <nav className="flex min-w-max gap-1 px-5 lg:px-8">
          {tabs.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              params={{ slug }}
              activeOptions={{ exact: tab.exact }}
              className="border-b-2 border-transparent px-3 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:border-primary data-[status=active]:text-foreground"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      <Outlet />
    </WorkspaceShell>
  );
}
