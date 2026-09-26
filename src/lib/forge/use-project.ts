import { getRouteApi } from "@tanstack/react-router";
const projectRoute = getRouteApi("/projects/$slug");
export function useForgeProject() {
  return projectRoute.useLoaderData().project;
}
