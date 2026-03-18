import { NextRequest, NextResponse } from "next/server";
import { loadCandidate, saveCandidate, loadAllJobs, loadRawResumeText } from "@/lib/storage";
import { calculateMatchScore, generateMatchReason } from "@/lib/resume-utils";
import { getAgentManager } from "@/lib/agents";
import { evaluateCandidateWithRule, createRuleSnapshot } from "@/lib/scoring-utils";
import type { JobMatch, Job } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

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

    const jobsWithRule: Job[] = [];
    const jobsWithoutRule: Job[] = [];

    for (const job of activeJobs) {
      if (job.scoringRule && job.scoringRule.dimensions?.length > 0) {
        jobsWithRule.push(job);
      } else {
        jobsWithoutRule.push(job);
      }
    }

    // --- Phase 1: Evaluate jobs WITH scoring rules (per-job) ---
    const CONCURRENCY = 3;
    for (let i = 0; i < jobsWithRule.length; i += CONCURRENCY) {
      const batch = jobsWithRule.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (job) => {
          try {
            const evaluation = await evaluateCandidateWithRule(candidate, job);
            const snapshot = createRuleSnapshot(job.scoringRule!);
            return {
              jobId: job.id,
              jobTitle: job.title,
              score: evaluation.totalScore,
              reason: evaluation.reason,
              pros: evaluation.pros,
              cons: evaluation.cons,
              assessedAt: new Date(),
              scoringSnapshot: snapshot,
              dimensionScores: evaluation.dimensionScores,
            } as JobMatch;
          } catch (err) {
            console.error(`Rule evaluation failed for job ${job.title}:`, err);
            return null;
          }
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          matches.push(r.value);
        }
      }
    }

    // Collect IDs of jobs already matched via rules
    const matchedJobIds = new Set(matches.map(m => m.jobId));

    // Also collect rule-evaluated jobs that failed — they need fallback
    const failedRuleJobs = jobsWithRule.filter(j => !matchedJobIds.has(j.id));
    const fallbackJobs = [...jobsWithoutRule, ...failedRuleJobs];

    // --- Phase 2: AI batch evaluation for jobs WITHOUT rules (or failed rule) ---
    if (fallbackJobs.length > 0) {
      const jobList = fallbackJobs.map((job, i) => {
        const overview = job.description?.overview ? ` 概述: ${job.description.overview.slice(0, 80)}` : "";
        const resp = job.description?.responsibilities?.slice(0, 3).join("; ") || "";
        const reqs = job.description?.requirements?.slice(0, 3).join("; ") || "";
        return `[${i}] ${job.title} (${job.level}, ${job.department})${overview}\n    技能: ${job.skills?.join(",") || "未指定"}\n    职责: ${resp || "未指定"}\n    要求: ${reqs || "未指定"}`;
      }).join("\n");

      try {
        const agentManager = getAgentManager();
        const prompt = `评估候选人与以下所有职位的匹配度，返回JSON数组（只返回JSON数组）。

候选人: ${candidate.name}
${resumeSummary}

职位列表:
${jobList}

返回格式（按匹配度从高到低排序）:
[{"index":0,"score":0-100,"reason":"一句话","pros":["优势1","优势2"],"cons":["风险1","风险2"]}]

重要评分要求：
- 综合考虑每个职位的完整JD（职责、要求、技能），不要仅看技能关键词匹配
- 注意JD职责描述中隐含的能力要求（行业背景、管理能力、业务理解等）
- 每个职位必须同时给出pros和cons，至少各2条，需具体有针对性`;

        const response = await agentManager.processMessage(prompt, []);
        const jsonMatch = response.content.match(/\[[\s\S]*\]/);

        if (jsonMatch) {
          const results = JSON.parse(jsonMatch[0]);
          for (const r of results) {
            const idx = typeof r.index === "number" ? r.index : parseInt(r.index);
            const job = fallbackJobs[idx];
            if (!job) continue;
            if (matchedJobIds.has(job.id)) continue;
            matches.push({
              jobId: job.id,
              jobTitle: job.title,
              score: typeof r.score === "number" ? Math.min(100, Math.max(0, r.score)) : 50,
              reason: r.reason || "",
              pros: Array.isArray(r.pros) ? r.pros : [],
              cons: Array.isArray(r.cons) ? r.cons : [],
              assessedAt: new Date(),
            });
            matchedJobIds.add(job.id);
          }
        }
      } catch (aiErr) {
        console.error("AI batch match failed, falling back to basic scoring:", aiErr);
      }
    }

    // --- Phase 3: Basic fallback for any remaining unmatched jobs ---
    for (const job of activeJobs) {
      if (matchedJobIds.has(job.id)) continue;
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
