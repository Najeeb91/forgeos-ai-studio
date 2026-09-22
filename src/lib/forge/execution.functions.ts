import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { approveBuild, executeBuild, getLatestGeneratedSource } from "./worker-client";

const buildInput=z.object({
  runId:z.string().min(1),
  projectSlug:z.string().min(1).max(255),
  prompt:z.string().trim().min(1).max(4000),
  approved:z.boolean().optional().default(false),
});

export const runForgeBuild=createServerFn({method:"POST"})
  .validator(buildInput)
  .handler(async({data})=>{
    const result=await executeBuild(data.runId,data.projectSlug,data.prompt,data.approved);
    return {
      ...result,
      sourceFileCount:result.sourceFiles?.length ?? 0,
      sourceFiles:result.sourceFiles?.map(f=>f.path) ?? [],
      generationMode:result.generationMode ?? "pending",
      provider:result.provider ?? "provider-router",
      model:result.model ?? "pending",
    };
  });

export const approveForgeBuild=createServerFn({method:"POST"})
  .validator(z.object({
    runId:z.string().min(1),
    approvalId:z.string().min(1),
    decision:z.enum(["approved","rejected"]).default("approved"),
  }))
  .handler(async({data})=>approveBuild(data.runId,data.approvalId,data.decision));

export const getLatestGeneratedApp=getLatestGeneratedAppImpl();

function getLatestGeneratedAppImpl(){
  return createServerFn({method:"GET"})
    .validator(z.object({projectSlug:z.string().min(1).max(255)}))
    .handler(async({data})=>getLatestGeneratedSource(data.projectSlug));
}
