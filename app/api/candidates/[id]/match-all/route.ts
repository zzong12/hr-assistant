import { NextRequest, NextResponse } from "next/server";
import { loadCandidate, saveCandidate, loadAllJobs, loadRawResumeText } from "@/lib/storage";
import { calculateMatchScore, generateMatchReason } from "@/lib/resume-utils";
import { getAgentManager } from "@/lib/agents";
import type { JobMatch } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const candidate = loadCandidate(id);
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const allJobs = loadAllJobs();
    const activeJobs = allJobs.filter(j => j.status === "active");

    if (activeJobs.length === 0) {
      return NextResponse.json({ error: "没有活跃的职位可供匹配" }, { status: 400 });
    }

    const candidateSkills = candidate.resume.parsedData?.skills || [];
    const experience = candidate.resume.parsedData?.experience || [];
    const rawText = loadRawResumeText(id);
    const resumeSummary = rawText
      ? rawText.slice(0, 1200)
      : `技能: ${candidateSkills.join(", ")}\n经验: ${experience.map(e => `${e.position}@${e.company}`).join(", ")}`;

    const matches: JobMatch[] = [];

    // Build batch prompt for AI to evaluate all jobs at once
    const jobList = activeJobs.map((job, i) =>
      `[${i}] ${job.title} (${job.department}) - 技能: ${job.skills?.join(",") || "未指定"} - 要求: ${job.description?.requirements?.slice(0, 2).join("; ") || ""}`
    ).join("\n");

    try {
      const agentManager = getAgentManager();
      const prompt = `评估候选人与以下所有职位的匹配度，返回JSON数组（只返回JSON数组）。

候选人: ${candidate.name}
${resumeSummary}

职位列表:
${jobList}

返回格式（按匹配度从高到低排序）:
[{"index":0,"score":0-100,"reason":"一句话","pros":["优势1","优势2"],"cons":["风险1","风险2"]}]

每个职位必须同时给出pros和cons，至少各2条。`;

      const response = await agentManager.processMessage(prompt, []);
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        const results = JSON.parse(jsonMatch[0]);
        for (const r of results) {
          const idx = typeof r.index === "number" ? r.index : parseInt(r.index);
          const job = activeJobs[idx];
          if (!job) continue;
          matches.push({
            jobId: job.id,
            jobTitle: job.title,
            score: typeof r.score === "number" ? Math.min(100, Math.max(0, r.score)) : 50,
            reason: r.reason || "",
            pros: Array.isArray(r.pros) ? r.pros : [],
            cons: Array.isArray(r.cons) ? r.cons : [],
            assessedAt: new Date(),
          });
        }
      }
    } catch (aiErr) {
      console.error("AI batch match failed, falling back to basic scoring:", aiErr);
    }

    // Fallback: fill in any jobs not covered by AI
    for (const job of activeJobs) {
      if (matches.find(m => m.jobId === job.id)) continue;
      const score = calculateMatchScore(
        candidateSkills, job.skills || [], experience, job.description?.requirements || []
      );
      const reasons = generateMatchReason(candidate, job.skills || [], score);
      matches.push({
        jobId: job.id,
        jobTitle: job.title,
        score,
        reason: reasons.join("; "),
        pros: [],
        cons: [],
        assessedAt: new Date(),
      });
    }

    matches.sort((a, b) => b.score - a.score);
    candidate.matchedJobs = matches;

    if (matches[0]?.score >= 80 && candidate.status === "pending") {
      candidate.status = "screening";
    }

    candidate.updatedAt = new Date();
    saveCandidate(candidate);

    return NextResponse.json({ candidate, matchCount: matches.length });
  } catch (error) {
    console.error("Match-all error:", error);
    return NextResponse.json({ error: "批量匹配失败" }, { status: 500 });
  }
}
