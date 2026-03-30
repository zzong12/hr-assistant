import { NextRequest, NextResponse } from "next/server";

import { getAgentManager } from "@/lib/agents";
import { buildJobAnalysisPrompt, normalizeJobAnalysis } from "@/lib/job-analysis-utils";
import { getStorageInitErrorMessage, loadJob, saveJob } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const jobId = typeof body.jobId === "string" ? body.jobId : "";

    if (!jobId) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
    }

    const job = loadJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const agentManager = getAgentManager();
    const prompt = buildJobAnalysisPrompt(job);
    const response = await agentManager.processMessage(prompt, [], "jd_generator");
    const analysis = normalizeJobAnalysis(response.content);
    const persistedAt = new Date();
    analysis.generatedAt = persistedAt;

    const updatedJob = {
      ...job,
      analysis,
      updatedAt: persistedAt,
    };

    const saved = saveJob(updatedJob);
    if (!saved) {
      const storageError = getStorageInitErrorMessage();
      return NextResponse.json(
        { error: storageError || "Failed to save analysis" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      analysis,
      job: updatedJob,
      raw: response.content,
    });
  } catch (error) {
    console.error("Error analyzing job:", error);
    const message = error instanceof Error ? error.message : "Failed to analyze job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
