import { loadCandidate, loadJob, loadRawResumeText, saveCandidate } from "@/lib/storage";
import { calculateMatchScore, generateMatchReason } from "@/lib/resume-utils";
import { getAgentManager } from "@/lib/agents";
import { createRuleSnapshot, evaluateCandidateWithRule } from "@/lib/scoring-utils";
import type { Candidate } from "@/lib/types";

export class CandidateMatchError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export async function matchCandidateToJob(candidateId: string, jobId: string): Promise<Candidate> {
  const candidate = loadCandidate(candidateId);
  if (!candidate) {
    throw new CandidateMatchError("Candidate not found", 404);
  }

  const job = loadJob(jobId);
  if (!job) {
    throw new CandidateMatchError("Job not found", 404);
  }

  let finalScore = 0;
  let pros: string[] = [];
  let cons: string[] = [];
  let reason = "";
  let dimensionScores = undefined;
  let scoringSnapshot = undefined;

  if (job.scoringRule && job.scoringRule.dimensions?.length > 0) {
    try {
      const evaluation = await evaluateCandidateWithRule(candidate, job);
      finalScore = evaluation.totalScore;
      pros = evaluation.pros;
      cons = evaluation.cons;
      reason = evaluation.reason;
      dimensionScores = evaluation.dimensionScores;
      scoringSnapshot = createRuleSnapshot(job.scoringRule);
    } catch (error) {
      console.error("Rule evaluation error, falling back to default:", error);
    }
  }

  if (finalScore === 0 && !scoringSnapshot) {
    const candidateSkills = candidate.resume.parsedData?.skills || [];
    const jobSkills = job.skills || [];
    const experience = candidate.resume.parsedData?.experience || [];
    const jobRequirements = job.description?.requirements || [];

    const baseScore = calculateMatchScore(candidateSkills, jobSkills, experience, jobRequirements);
    const reasons = generateMatchReason(candidate, jobSkills, baseScore);

    finalScore = baseScore;
    reason = reasons.join("; ");

    try {
      const rawText = loadRawResumeText(candidateId);
      const resumeSummary = rawText
        ? rawText.slice(0, 1500)
        : `技能: ${candidateSkills.join(", ")}\n经验: ${experience.map((e) => `${e.position}@${e.company}`).join(", ")}`;

      const jobOverview = job.description?.overview || "";
      const responsibilities = job.description?.responsibilities || [];
      const prompt = `评估候选人与职位的匹配度，返回JSON（只返回JSON）：

职位: ${job.title} (${job.level}) - ${job.department}
${jobOverview ? `职位概述: ${jobOverview}\n` : ""}职责:
${responsibilities.map((r, i) => `${i + 1}. ${r}`).join("\n") || "未指定"}
任职要求:
${jobRequirements.map((r, i) => `${i + 1}. ${r}`).join("\n") || "未指定"}
核心技能: ${jobSkills.join(", ") || "未指定"}

候选人: ${candidate.name}
${resumeSummary}

返回格式:
{"score":0-100,"reason":"一句话总结","pros":["优势1","优势2","优势3"],"cons":["风险1","风险2","风险3"]}

评分标准: 综合考虑以下因素——
1. 技能匹配度（JD要求的核心技能 vs 候选人技能）
2. 经验相关性（JD职责描述 vs 候选人工作经历）
3. 任职要求契合度（JD的任职要求 vs 候选人背景）
4. 教育背景与项目经历

重要：不要仅看技能关键词匹配，还需关注JD职责描述中隐含的能力要求（如行业背景、管理能力、业务理解等）。
pros: 至少给出2条正面评价
cons: 至少给出2条风险/不足`;

      const agentManager = getAgentManager();
      const response = await agentManager.processMessage(prompt, []);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        finalScore = typeof parsed.score === "number" ? parsed.score : baseScore;
        pros = Array.isArray(parsed.pros) ? parsed.pros : [];
        cons = Array.isArray(parsed.cons) ? parsed.cons : [];
        if (parsed.reason) reason = parsed.reason;
      }
    } catch {
      // Ignore AI enhancement failures and keep base score.
    }
  }

  candidate.matchedJobs = candidate.matchedJobs.filter((m) => m.jobId !== jobId);
  candidate.matchedJobs.unshift({
    jobId,
    jobTitle: job.title,
    score: finalScore,
    reason,
    pros,
    cons,
    assessedAt: new Date(),
    scoringSnapshot,
    dimensionScores,
  });
  candidate.matchedJobs.sort((a, b) => b.score - a.score);

  if (finalScore >= 80 && candidate.status === "pending") {
    candidate.status = "screening";
  }
  candidate.updatedAt = new Date();
  saveCandidate(candidate);

  return candidate;
}
