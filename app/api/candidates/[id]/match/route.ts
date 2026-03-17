import { NextRequest, NextResponse } from "next/server";
import { loadCandidate, saveCandidate, loadJob, loadRawResumeText } from "@/lib/storage";
import { calculateMatchScore, generateMatchReason } from "@/lib/resume-utils";
import { getAgentManager } from "@/lib/agents";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json(
        { error: "jobId is required" },
        { status: 400 }
      );
    }

    const candidate = loadCandidate(id);
    if (!candidate) {
      return NextResponse.json(
        { error: "Candidate not found" },
        { status: 404 }
      );
    }

    const job = loadJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const candidateSkills = candidate.resume.parsedData?.skills || [];
    const jobSkills = job.skills || [];
    const experience = candidate.resume.parsedData?.experience || [];
    const jobRequirements = job.description?.requirements || [];

    const baseScore = calculateMatchScore(
      candidateSkills,
      jobSkills,
      experience,
      jobRequirements
    );
    const reasons = generateMatchReason(candidate, jobSkills, baseScore);

    let pros: string[] = [];
    let cons: string[] = [];
    let finalScore = baseScore;

    try {
      const rawText = loadRawResumeText(id);
      const resumeSummary = rawText
        ? rawText.slice(0, 1500)
        : `技能: ${candidateSkills.join(", ")}\n经验: ${experience.map(e => `${e.position}@${e.company}`).join(", ")}`;

      const prompt = `评估候选人与职位的匹配度，返回JSON（只返回JSON）：

职位: ${job.title} (${job.department})
要求技能: ${jobSkills.join(", ")}
职责: ${job.description?.responsibilities?.slice(0, 3).join("; ") || ""}
要求: ${jobRequirements.slice(0, 3).join("; ") || ""}

候选人: ${candidate.name}
${resumeSummary}

返回格式:
{"score":0-100,"reason":"一句话总结","pros":["优势1","优势2","优势3"],"cons":["风险1","风险2","风险3"]}

评分标准: 技能匹配40分 + 经验相关30分 + 教育背景15分 + 项目经历15分
pros: 至少给出2条正面评价（技能匹配、经验亮点、教育优势等）
cons: 至少给出2条风险/不足（技能缺口、经验不足、稳定性等）`;

      const agentManager = getAgentManager();
      const response = await agentManager.processMessage(prompt, []);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        finalScore = typeof parsed.score === "number" ? parsed.score : baseScore;
        pros = Array.isArray(parsed.pros) ? parsed.pros : [];
        cons = Array.isArray(parsed.cons) ? parsed.cons : [];
        if (parsed.reason) reasons.unshift(parsed.reason);
      }
    } catch {
      // AI enhancement failed, fall back to basic score
    }

    candidate.matchedJobs = candidate.matchedJobs.filter(
      (m) => m.jobId !== jobId
    );
    candidate.matchedJobs.unshift({
      jobId,
      jobTitle: job.title,
      score: finalScore,
      reason: reasons.join("; "),
      pros,
      cons,
      assessedAt: new Date(),
    });

    candidate.matchedJobs.sort((a, b) => b.score - a.score);

    if (finalScore >= 80 && candidate.status === "pending") {
      candidate.status = "screening";
    }

    candidate.updatedAt = new Date();
    saveCandidate(candidate);

    return NextResponse.json(candidate);
  } catch (error) {
    console.error("Match error:", error);
    return NextResponse.json(
      { error: "Failed to match candidate" },
      { status: 500 }
    );
  }
}
