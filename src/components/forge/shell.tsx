import { Link } from "@tanstack/react-router";
import {
  Boxes,
  CircuitBoard,
  History,
  LayoutGrid,
  PlusCircle,
  ShieldCheck,
  Menu,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { projects } from "@/lib/forge/data";
import { Dot } from "./status";

const nav = [
  { to: "/", label: "Workspace", icon: LayoutGrid, exact: true },
  { to: "/new", label: "New project", icon: PlusCircle, exact: false },
  { to: "/providers", label: "AI providers", icon: CircuitBoard, exact: false },
  { to: "/activity", label: "Activity", icon: History, exact: false },
];

export function ForgeMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="grid size-8 place-items-center rounded-md border border-primary/40 bg-primary/12">
        <Boxes className="size-4 text-primary" />
      </div>
      <div className="leading-tight">
        <div className="font-mono text-sm font-semibold tracking-tight">ForgeOS</div>
        <div className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
          AI software factory
        </div>
      </div>
    </div>
  );
}

function NavBody({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <ForgeMark />

      <nav className="flex flex-col gap-0.5">
        {nav.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.exact }}
            onClick={onNavigate}
            className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground"
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="px-2.5 text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
          Projects
        </div>
        <div className="flex flex-col gap-0.5 overflow-y-auto">
          {projects.map((p) => (
            <Link
              key={p.id}
              to="/projects/$slug"
              params={{ slug: p.slug }}
              onClick={onNavigate}
              className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground"
            >
              <span className="flex items-center gap-2 truncate">
                <Dot
                  tone={
                    p.health === "healthy"
                      ? "success"
                      : p.health === "attention"
                        ? "warning"
                        : "danger"
                  }
                />
                <span className="truncate">{p.name}</span>
              </span>
              {p.benchmark ? (
                <span className="font-mono text-[10px] text-primary">bench</span>
              ) : null}
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-sidebar-border bg-sidebar-accent/40 p-3">
        <div className="flex items-center gap-2 text-xs font-medium">
          <ShieldCheck className="size-3.5 text-success" />
          Approval gate active
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          Destructive schema, data and deploy actions pause for human sign-off.
        </p>
      </div>
    </div>
  );
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
        <div className="sticky top-0 h-screen">
          <NavBody />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-surface/60 px-4 py-3 backdrop-blur lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0">
              <SheetTitle className="sr-only">ForgeOS navigation</SheetTitle>
              <NavBody onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <ForgeMark />
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  meta,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="border-b border-border bg-surface/40">
      <div className="flex flex-col gap-4 px-5 py-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {description ? (
              <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
        {meta ? <div className="flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("panel overflow-hidden", className)}>
      {title ? (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions}
        </header>
      ) : null}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-md border border-dashed border-border px-4 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("space-y-5 px-5 py-6 lg:px-8", className)}>{children}</div>;
}
