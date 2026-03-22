import { NextRequest, NextResponse } from "next/server";
import { CandidateMatchError, matchCandidateToJob } from "@/lib/candidate-matching";

export const runtime = "nodejs";
export const maxDuration = 120;

type MatchTask = { candidateId: string; jobId: string };
type MatchResult = MatchTask & { ok: boolean; error?: string };

const CONCURRENCY = 4;

async function runWithConcurrency(tasks: MatchTask[], worker: (task: MatchTask) => Promise<MatchResult>) {
  const results: MatchResult[] = [];
  let cursor = 0;

  async function runWorker() {
    while (cursor < tasks.length) {
      const index = cursor++;
      results[index] = await worker(tasks[index]);
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, () => runWorker());
  await Promise.all(workers);
  return results;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const candidateIds = Array.isArray(body?.candidateIds) ? body.candidateIds : [];
    const jobIds = Array.isArray(body?.jobIds) ? body.jobIds : [];

    if (candidateIds.length === 0) {
      return NextResponse.json({ error: "candidateIds is required" }, { status: 400 });
    }
    if (jobIds.length === 0) {
      return NextResponse.json({ error: "jobIds is required" }, { status: 400 });
    }

    const tasks: MatchTask[] = [];
    for (const candidateId of candidateIds) {
      for (const jobId of jobIds) {
        tasks.push({ candidateId, jobId });
      }
    }

    const results = await runWithConcurrency(tasks, async (task) => {
      try {
        await matchCandidateToJob(task.candidateId, task.jobId);
        return { ...task, ok: true };
      } catch (error) {
        if (error instanceof CandidateMatchError) {
          return { ...task, ok: false, error: error.message };
        }
        return { ...task, ok: false, error: "匹配失败" };
      }
    });

    const success = results.filter((r) => r.ok).length;
    const failed = results.length - success;

    return NextResponse.json({
      total: results.length,
      success,
      failed,
      results,
    });
  } catch (error) {
    console.error("Batch match error:", error);
    return NextResponse.json({ error: "批量匹配失败" }, { status: 500 });
  }
}
