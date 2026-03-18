import Anthropic from "@anthropic-ai/sdk";
import type {
  Candidate,
  Job,
  ScoringDimension,
  ScoringEvaluator,
  ScoringRule,
  DimensionScore,
  ScoringRuleSnapshot,
} from "@/lib/types";

// ==================== Main Evaluation Function ====================

/**
 * Evaluate a candidate against a job using a scoring rule
 */
export async function evaluateCandidateWithRule(
  candidate: Candidate,
  job: Job
): Promise<{
  totalScore: number;
  dimensionScores: DimensionScore[];
  pros: string[];
  cons: string[];
  reason: string;
}> {
  const rule = job.scoringRule;
  if (!rule || !rule.dimensions || rule.dimensions.length === 0) {
    throw new Error("Job has no valid scoring rule");
  }

  const dimensionScores: DimensionScore[] = [];
  let totalWeightedScore = 0;

  for (const dimension of rule.dimensions) {
    const score = await evaluateDimension(candidate, job, dimension);
    dimensionScores.push(score);
    totalWeightedScore += score.weightedScore;
  }

  // Normalize to rule's total score (default 100)
  const normalizedScore = Math.round(
    (totalWeightedScore / rule.totalScore) * 100
  );

  const { pros, cons, reason } = await generateEvaluationSummary(
    candidate,
    job,
    dimensionScores,
    normalizedScore
  );

  return {
    totalScore: normalizedScore,
    dimensionScores,
    pros,
    cons,
    reason,
  };
}

// ==================== Dimension Evaluation ====================

/**
 * Evaluate a single dimension for a candidate
 */
async function evaluateDimension(
  candidate: Candidate,
  job: Job,
  dimension: ScoringDimension
): Promise<DimensionScore> {
  const { evaluator, weight } = dimension;
  let rawScore = 0;
  let details: { matched?: string[]; missing?: string[]; notes?: string } = {};

  switch (evaluator.method) {
    case "keyword":
      rawScore = evaluateKeywordMatch(
        candidate,
        evaluator.keywords || [],
        evaluator.matchMode || "any"
      );
      details = getKeywordMatchDetails(
        candidate,
        evaluator.keywords || [],
        dimension.type
      );
      break;

    case "duration":
      rawScore = evaluateDuration(
        candidate,
        evaluator.minYears || 0,
        evaluator.preferredYears || evaluator.minYears || 0
      );
      details.notes = getDurationDetails(
        candidate,
        evaluator.minYears || 0,
        rawScore
      );
      break;

    case "ai":
      rawScore = await evaluateWithAI(candidate, job, dimension);
      break;

    case "boolean":
      rawScore = evaluateBoolean(
        candidate,
        evaluator.booleanField || dimension.type
      );
      details.notes = getBooleanDetails(
        candidate,
        evaluator.booleanField || dimension.type
      );
      break;

    case "range":
      rawScore = evaluateRange(
        candidate,
        dimension.type,
        evaluator.minValue || 0,
        evaluator.maxValue || 100
      );
      details.notes = getRangeDetails(
        candidate,
        dimension.type,
        rawScore
      );
      break;

    default:
      rawScore = 50; // Default score for unknown methods
  }

  const maxScore = 100;
  const weightedScore = Math.round((rawScore / maxScore) * weight);

  return {
    dimensionId: dimension.id,
    dimensionName: dimension.name,
    score: rawScore,
    maxScore,
    weight,
    weightedScore,
    details,
  };
}

// ==================== Keyword Matching ====================

/**
 * Evaluate based on keyword matching
 */
function evaluateKeywordMatch(
  candidate: Candidate,
  keywords: string[],
  matchMode: "any" | "all"
): number {
  if (!keywords || keywords.length === 0) return 50;

  const candidateData = extractCandidateText(candidate);
  const lowerCandidateData = candidateData.toLowerCase();

  const matchedKeywords: string[] = [];
  for (const keyword of keywords) {
    if (lowerCandidateData.includes(keyword.toLowerCase())) {
      matchedKeywords.push(keyword);
    }
  }

  if (matchMode === "all") {
    // All must match: partial credit based on how many match
    return (matchedKeywords.length / keywords.length) * 100;
  } else {
    // Any match: more matches = higher score
    return Math.min((matchedKeywords.length / keywords.length) * 100 + 20, 100);
  }
}

/**
 * Get details for keyword matching
 */
function getKeywordMatchDetails(
  candidate: Candidate,
  keywords: string[],
  type: string
): { matched: string[]; missing: string[] } {
  const candidateData = extractCandidateText(candidate).toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];

  for (const keyword of keywords) {
    if (candidateData.includes(keyword.toLowerCase())) {
      matched.push(keyword);
    } else {
      missing.push(keyword);
    }
  }

  return { matched, missing };
}

// ==================== Duration Evaluation ====================

/**
 * Evaluate based on years of experience
 */
function evaluateDuration(
  candidate: Candidate,
  minYears: number,
  preferredYears: number
): number {
  const totalYears = calculateTotalYears(candidate);

  if (totalYears >= preferredYears) return 100;
  if (totalYears >= minYears) {
    // Linear interpolation between min and preferred
    return Math.round(
      ((totalYears - minYears) / (preferredYears - minYears)) * 40 + 60
    );
  }
  // Below minimum: proportional penalty
  return Math.round((totalYears / minYears) * 50);
}

/**
 * Calculate total years of experience
 */
function calculateTotalYears(candidate: Candidate): number {
  const experience = candidate.resume.parsedData?.experience || [];
  let totalYears = 0;

  for (const exp of experience) {
    const years = parseDuration(exp.duration);
    totalYears += years;
  }

  return totalYears;
}

/**
 * Parse duration string to years
 */
function parseDuration(duration: string): number {
  // Match patterns like "3年", "2-3年", "2018-2021", etc.
  const yearMatch = duration.match(/(\d+(?:\.\d+)?)\s*年/);
  if (yearMatch) {
    return parseFloat(yearMatch[1]);
  }

  // Match date ranges like "2018.06 - 2021.05"
  const rangeMatch = duration.match(/(\d{4})[.\-/](\d{1,2})?\s*[~-至]\s*(\d{4}|至今)/);
  if (rangeMatch) {
    const startYear = parseInt(rangeMatch[1]);
    const endYear = rangeMatch[3] === "至今" ? new Date().getFullYear() : parseInt(rangeMatch[3]);
    return endYear - startYear;
  }

  // Default to 1 year if unparseable
  return 1;
}

/**
 * Get duration evaluation details
 */
function getDurationDetails(
  candidate: Candidate,
  minYears: number,
  score: number
): string {
  const totalYears = calculateTotalYears(candidate);
  if (totalYears >= minYears) {
    return `工作经验 ${totalYears.toFixed(1)} 年，满足最低要求 (${minYears}年)`;
  }
  return `工作经验 ${totalYears.toFixed(1)} 年，低于最低要求 (${minYears}年)`;
}

// ==================== AI Evaluation ====================

/**
 * Evaluate using AI for complex assessments
 */
async function evaluateWithAI(
  candidate: Candidate,
  job: Job,
  dimension: ScoringDimension
): Promise<number> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return 50;

  try {
    const anthropic = new Anthropic({
      apiKey,
      baseURL: process.env.ANTHROPIC_BASE_URL,
    });

    const prompt = buildAIPrompt(candidate, job, dimension);

    const response = await anthropic.messages.create({
      model: process.env.DEFAULT_CLAUDE_MODEL || "claude-3-5-sonnet-20241022",
      max_tokens: 100,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type === "text") {
      const scoreMatch = content.text.match(/(\d+)/);
      if (scoreMatch) {
        const score = parseInt(scoreMatch[1]);
        return Math.max(0, Math.min(100, score));
      }
    }
  } catch (error) {
    console.error("AI evaluation error:", error);
  }

  return 50;
}

/**
 * Build full JD context string for AI prompts
 */
function buildJobContext(job: Job): string {
  const parts: string[] = [];
  parts.push(`职位：${job.title} (${job.level})`);
  if (job.department) parts.push(`部门：${job.department}`);
  if (job.description?.overview) parts.push(`概述：${job.description.overview}`);
  if (job.description?.responsibilities?.length) {
    parts.push(`职责：\n${job.description.responsibilities.map((r, i) => `${i + 1}. ${r}`).join("\n")}`);
  }
  if (job.description?.requirements?.length) {
    parts.push(`要求：\n${job.description.requirements.map((r, i) => `${i + 1}. ${r}`).join("\n")}`);
  }
  if (job.skills?.length) parts.push(`核心技能：${job.skills.join("、")}`);
  return parts.join("\n");
}

/**
 * Build AI prompt for dimension evaluation
 */
function buildAIPrompt(
  candidate: Candidate,
  job: Job,
  dimension: ScoringDimension
): string {
  const resumeText = extractCandidateText(candidate);
  const customPrompt = dimension.evaluator.aiPrompt || "";
  const jobContext = buildJobContext(job);

  return `请评估候选人在以下维度的得分（0-100分）：

维度名称：${dimension.name}
维度描述：${dimension.description || ""}

${jobContext}

候选人简历：
${resumeText.slice(0, 2000)}

${customPrompt ? `评估标准：${customPrompt}` : ""}

注意：评分时需要综合考虑岗位JD中的职责描述和任职要求，而不仅仅是关键词匹配。
请只返回一个0-100之间的数字分数。`;
}

// ==================== Boolean Evaluation ====================

/**
 * Evaluate boolean conditions
 */
function evaluateBoolean(candidate: Candidate, field: string): number {
  switch (field) {
    case "education":
      const hasDegree =
        candidate.resume.parsedData?.education &&
        candidate.resume.parsedData.education.length > 0;
      return hasDegree ? 100 : 0;

    case "projects":
      const hasProjects =
        candidate.resume.parsedData?.projects &&
        candidate.resume.parsedData.projects.length > 0;
      return hasProjects ? 100 : 0;

    case "experience":
      const hasExp =
        candidate.resume.parsedData?.experience &&
        candidate.resume.parsedData.experience.length > 0;
      return hasExp ? 100 : 0;

    default:
      return 50;
  }
}

/**
 * Get boolean evaluation details
 */
function getBooleanDetails(candidate: Candidate, field: string): string {
  switch (field) {
    case "education":
      const eduCount = candidate.resume.parsedData?.education?.length || 0;
      return eduCount > 0 ? `有 ${eduCount} 条教育记录` : "无教育记录";
    case "projects":
      const projCount = candidate.resume.parsedData?.projects?.length || 0;
      return projCount > 0 ? `有 ${projCount} 个项目经验` : "无项目经验";
    case "experience":
      const expCount = candidate.resume.parsedData?.experience?.length || 0;
      return expCount > 0 ? `有 ${expCount} 段工作经历` : "无工作经历";
    default:
      return "";
  }
}

// ==================== Range Evaluation ====================

/**
 * Evaluate based on numeric ranges
 */
function evaluateRange(
  candidate: Candidate,
  type: string,
  minValue: number,
  maxValue: number
): number {
  const value = extractNumericValue(candidate, type);
  if (value === null) return 50;

  if (value >= maxValue) return 100;
  if (value <= minValue) return 0;
  // Linear interpolation
  return Math.round(((value - minValue) / (maxValue - minValue)) * 100);
}

/**
 * Extract numeric value from candidate
 */
function extractNumericValue(candidate: Candidate, type: string): number | null {
  switch (type) {
    case "experience":
      return calculateTotalYears(candidate);
    case "age":
      // Not typically available in resumes
      return null;
    default:
      return null;
  }
}

/**
 * Get range evaluation details
 */
function getRangeDetails(
  candidate: Candidate,
  type: string,
  score: number
): string {
  const value = extractNumericValue(candidate, type);
  if (value === null) return "无法评估";
  return `数值: ${value.toFixed(1)}`;
}

// ==================== Utility Functions ====================

/**
 * Extract all text from candidate resume for searching
 */
function extractCandidateText(candidate: Candidate): string {
  const parsed = candidate.resume.parsedData;
  if (!parsed) return "";

  const parts: string[] = [];

  // Skills
  if (parsed.skills && parsed.skills.length > 0) {
    parts.push("技能: " + parsed.skills.join(", "));
  }

  // Experience
  if (parsed.experience && parsed.experience.length > 0) {
    parts.push(
      "工作经历: " +
        parsed.experience
          .map((e) => `${e.position}@${e.company} ${e.description}`)
          .join("; ")
    );
  }

  // Education
  if (parsed.education && parsed.education.length > 0) {
    parts.push(
      "教育: " +
        parsed.education.map((e) => `${e.school} ${e.major} ${e.degree}`).join("; ")
    );
  }

  // Projects
  if (parsed.projects && parsed.projects.length > 0) {
    parts.push(
      "项目: " +
        parsed.projects
          .map((p) => `${p.name} ${p.description} ${p.technologies?.join(", ") || ""}`)
          .join("; ")
    );
  }

  // Summary
  if (parsed.summary) {
    parts.push("简介: " + parsed.summary);
  }

  return parts.join("\n");
}

/**
 * Generate evaluation summary (pros/cons/reason) — uses AI for JD-aware analysis
 */
async function generateEvaluationSummary(
  candidate: Candidate,
  job: Job,
  dimensionScores: DimensionScore[],
  totalScore: number
): Promise<{ pros: string[]; cons: string[]; reason: string }> {
  const dimensionSummary = dimensionScores
    .map(ds => `- ${ds.dimensionName}: ${ds.score}/${ds.maxScore} (权重${ds.weight}%)${ds.details?.notes ? ` ${ds.details.notes}` : ""}${ds.details?.matched?.length ? ` 匹配: ${ds.details.matched.join("、")}` : ""}${ds.details?.missing?.length ? ` 缺失: ${ds.details.missing.join("、")}` : ""}`)
    .join("\n");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return generateBasicSummary(dimensionScores, totalScore);
  }

  try {
    const anthropic = new Anthropic({
      apiKey,
      baseURL: process.env.ANTHROPIC_BASE_URL,
    });

    const jobContext = buildJobContext(job);
    const resumeText = extractCandidateText(candidate);

    const prompt = `你是一位资深HR顾问。请根据以下信息，对候选人与岗位的匹配情况做出全面评估。

${jobContext}

候选人：${candidate.name}
${resumeText.slice(0, 1500)}

维度评分明细（总分 ${totalScore}/100）：
${dimensionSummary}

请综合维度评分结果和岗位JD的完整要求（包括职责描述、任职要求），给出分析。
特别注意：不要仅看评分参考维度的分数，还要考虑JD中提到但维度未覆盖的要求（如行业背景、管理能力、特定业务经验等）。

返回JSON（只返回JSON）：
{"reason":"一句话总结匹配评价","pros":["优势1","优势2","优势3"],"cons":["风险/不足1","风险/不足2","风险/不足3"]}

pros和cons各至少2条，需具体、有针对性，避免泛泛而谈。`;

    const response = await anthropic.messages.create({
      model: process.env.DEFAULT_CLAUDE_MODEL || "claude-3-5-sonnet-20241022",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type === "text") {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          reason: parsed.reason || getDefaultReason(totalScore),
          pros: Array.isArray(parsed.pros) ? parsed.pros : [],
          cons: Array.isArray(parsed.cons) ? parsed.cons : [],
        };
      }
    }
  } catch (error) {
    console.error("AI summary generation failed, using basic summary:", error);
  }

  return generateBasicSummary(dimensionScores, totalScore);
}

function getDefaultReason(totalScore: number): string {
  if (totalScore >= 80) return "综合评分优秀，强烈推荐面试";
  if (totalScore >= 60) return "综合评分良好，可以考虑面试";
  if (totalScore >= 40) return "综合评分一般，建议谨慎评估";
  return "综合评分较低，不建议面试";
}

function generateBasicSummary(
  dimensionScores: DimensionScore[],
  totalScore: number
): { pros: string[]; cons: string[]; reason: string } {
  const pros: string[] = [];
  const cons: string[] = [];

  for (const ds of dimensionScores) {
    const percentage = (ds.score / ds.maxScore) * 100;
    if (percentage >= 70) {
      if (ds.details?.matched && ds.details.matched.length > 0) {
        pros.push(`${ds.dimensionName}优秀: ${ds.details.matched.slice(0, 3).join("、")}`);
      } else if (ds.details?.notes) {
        pros.push(`${ds.dimensionName}: ${ds.details.notes}`);
      } else {
        pros.push(`${ds.dimensionName}得分高 (${ds.score}/${ds.maxScore})`);
      }
    }
    if (percentage < 50) {
      if (ds.details?.missing && ds.details.missing.length > 0) {
        cons.push(`${ds.dimensionName}不足: 缺少 ${ds.details.missing.slice(0, 3).join("、")}`);
      } else if (ds.details?.notes) {
        cons.push(`${ds.dimensionName}: ${ds.details.notes}`);
      } else {
        cons.push(`${ds.dimensionName}得分低 (${ds.score}/${ds.maxScore})`);
      }
    }
  }

  return { pros, cons, reason: getDefaultReason(totalScore) };
}

// ==================== Rule Snapshots ====================

/**
 * Create a snapshot of a scoring rule for traceability
 */
export function createRuleSnapshot(rule: ScoringRule): ScoringRuleSnapshot {
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    version: rule.version,
    dimensions: JSON.parse(JSON.stringify(rule.dimensions)), // Deep copy
    snapshotAt: new Date(),
  };
}

// ==================== Default Rules ====================

/**
 * Get default scoring rule for a job type
 */
export function getDefaultScoringRule(job: Job): ScoringRule {
  const now = new Date();
  const id = `rule-${job.id}`;

  // Determine default weights based on job level and department
  let dimensions: ScoringDimension[] = [];

  if (job.department.toLowerCase().includes("技术") || job.department.toLowerCase().includes("engineering")) {
    // Tech roles: emphasize skills
    dimensions = [
      {
        id: `${id}-skills`,
        name: "技能匹配",
        weight: 50,
        description: "核心技能匹配度",
        type: "skills",
        evaluator: {
          method: "keyword",
          keywords: job.skills || [],
          matchMode: "any",
        },
      },
      {
        id: `${id}-experience`,
        name: "工作经验",
        weight: 30,
        description: "相关工作年限和质量",
        type: "experience",
        evaluator: {
          method: "duration",
          minYears: getMinYearsForLevel(job.level),
          preferredYears: getPreferredYearsForLevel(job.level),
        },
      },
      {
        id: `${id}-projects`,
        name: "项目经验",
        weight: 20,
        description: "项目相关性和复杂度",
        type: "projects",
        evaluator: {
          method: "ai",
          aiPrompt: "评估项目经验的相关性、技术深度和候选人的贡献度",
        },
      },
    ];
  } else if (job.department.toLowerCase().includes("产品") || job.department.toLowerCase().includes("product")) {
    // Product roles: emphasize experience and projects
    dimensions = [
      {
        id: `${id}-experience`,
        name: "产品经验",
        weight: 40,
        description: "产品相关工作经验",
        type: "experience",
        evaluator: {
          method: "duration",
          minYears: getMinYearsForLevel(job.level),
          preferredYears: getPreferredYearsForLevel(job.level),
        },
      },
      {
        id: `${id}-skills`,
        name: "技能匹配",
        weight: 30,
        description: "产品技能和工具",
        type: "skills",
        evaluator: {
          method: "keyword",
          keywords: job.skills || [],
          matchMode: "any",
        },
      },
      {
        id: `${id}-projects`,
        name: "项目经验",
        weight: 30,
        description: "产品项目经验",
        type: "projects",
        evaluator: {
          method: "ai",
          aiPrompt: "评估产品项目的商业价值、创新性和候选人的产品思维",
        },
      },
    ];
  } else {
    // General roles: balanced approach
    dimensions = [
      {
        id: `${id}-skills`,
        name: "技能匹配",
        weight: 40,
        description: "岗位技能匹配度",
        type: "skills",
        evaluator: {
          method: "keyword",
          keywords: job.skills || [],
          matchMode: "any",
        },
      },
      {
        id: `${id}-experience`,
        name: "工作经验",
        weight: 35,
        description: "相关工作年限",
        type: "experience",
        evaluator: {
          method: "duration",
          minYears: getMinYearsForLevel(job.level),
          preferredYears: getPreferredYearsForLevel(job.level),
        },
      },
      {
        id: `${id}-education`,
        name: "教育背景",
        weight: 25,
        description: "学历和专业相关性",
        type: "education",
        evaluator: {
          method: "ai",
          aiPrompt: "评估教育背景、学历层次和专业与岗位的相关性",
        },
      },
    ];
  }

  return {
    id,
    name: `${job.title} 默认规则`,
    description: `根据 ${job.title} (${job.level}) 自动生成的打分规则`,
    version: "1.0.0",
    dimensions,
    totalScore: 100,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get minimum years of experience for job level
 */
function getMinYearsForLevel(level: string): number {
  switch (level) {
    case "junior":
      return 0;
    case "mid":
      return 2;
    case "senior":
      return 5;
    case "expert":
      return 8;
    default:
      return 2;
  }
}

/**
 * Get preferred years of experience for job level
 */
function getPreferredYearsForLevel(level: string): number {
  switch (level) {
    case "junior":
      return 2;
    case "mid":
      return 4;
    case "senior":
      return 7;
    case "expert":
      return 10;
    default:
      return 4;
  }
}
