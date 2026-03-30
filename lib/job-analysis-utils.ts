import type { Job, JobAnalysis } from "@/lib/types";

export interface JobAnalysisInsight {
  headline: string;
  mustHaves: string[];
  personaHighlights: string[];
  industrySignals: string[];
  hiringTips: string[];
}

export function buildJobAnalysisPrompt(job: Job): string {
  const payload = {
    title: job.title,
    level: job.level,
    department: job.department,
    skills: job.skills,
    description: job.description,
    scoringRule: job.scoringRule
      ? {
          name: job.scoringRule.name,
          version: job.scoringRule.version,
          dimensions: job.scoringRule.dimensions.map((dimension) => ({
            name: dimension.name,
            weight: dimension.weight,
            type: dimension.type,
            description: dimension.description || "",
          })),
        }
      : null,
  };

  return `请你担任资深招聘顾问，分析以下岗位并输出结构化岗位洞察。

岗位输入：
${JSON.stringify(payload, null, 2)}

请严格返回 JSON，不要附加说明文字，字段结构如下：
{
  "summary": "用 2-3 句话概括岗位的核心挑战与价值",
  "requirementAnalysis": ["拆解出的关键要求1", "关键要求2"],
  "candidatePersona": ["理想候选人画像1", "理想候选人画像2"],
  "industryCapabilityLevel": ["行业门槛或迁移难度1", "能力级别判断2"],
  "hiringSuggestions": ["招聘建议1", "招聘建议2"]
}

要求：
1. 聚焦真实招聘判断，不要写空泛套话。
2. requirementAnalysis 需要覆盖显性要求、隐性要求、加分项或风险项。
3. candidatePersona 需要描述候选人的背景、成长阶段、擅长场景。
4. industryCapabilityLevel 需要判断行业理解门槛、可迁移性和能力层级。
5. hiringSuggestions 需要给出筛选与面试中的实际建议。`;
}

export function normalizeJobAnalysis(raw: unknown): JobAnalysis {
  const candidate = typeof raw === "string" ? parseJsonFromText(raw) : raw;
  const data = isRecord(candidate) ? candidate : {};

  return {
    summary: normalizeString(data.summary),
    requirementAnalysis: normalizeStringArray(data.requirementAnalysis),
    candidatePersona: normalizeStringArray(data.candidatePersona),
    industryCapabilityLevel: normalizeStringArray(data.industryCapabilityLevel),
    hiringSuggestions: normalizeStringArray(data.hiringSuggestions),
    generatedAt: normalizeDate(data.generatedAt),
  };
}

export function isJobAnalysisStale(job: Job): boolean {
  if (!job.analysis) {
    return false;
  }

  return normalizeDate(job.updatedAt).getTime() > normalizeDate(job.analysis.generatedAt).getTime();
}

export function buildJobAnalysisInsight(analysis: JobAnalysis): JobAnalysisInsight {
  return {
    headline: "AI岗位洞察",
    mustHaves: analysis.requirementAnalysis.slice(0, 3),
    personaHighlights: analysis.candidatePersona.slice(0, 3),
    industrySignals: analysis.industryCapabilityLevel.slice(0, 3),
    hiringTips: analysis.hiringSuggestions.slice(0, 3),
  };
}

function parseJsonFromText(raw: string): unknown {
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fencedMatch?.[1] || raw;
  const jsonMatch = source.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    return {};
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return {};
  }
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function normalizeDate(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return new Date();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
