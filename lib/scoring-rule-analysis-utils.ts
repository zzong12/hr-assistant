import type { Job, ScoringRule, ScoringRuleAnalysis, ScoringDimension } from "@/lib/types";

export function buildScoringRuleAnalysisPrompt(rule: ScoringRule, linkedJobs: Job[]): string {
  const rulePayload = {
    id: rule.id,
    name: rule.name,
    description: rule.description || "",
    version: rule.version,
    totalScore: rule.totalScore,
    dimensions: rule.dimensions.map((dimension) => ({
      name: dimension.name,
      weight: dimension.weight,
      description: dimension.description || "",
      type: dimension.type,
      evaluator: dimension.evaluator,
    })),
  };

  const jobsPayload = linkedJobs.map((job) => ({
    id: job.id,
    title: job.title,
    level: job.level,
    department: job.department,
    skills: job.skills,
    description: job.description,
  }));

  return `你是一名资深招聘策略顾问，请根据当前评分参考和关联岗位，分析这套评分参考是否合理，并给出一套可直接调整的优化草案。

当前评分参考：
${JSON.stringify(rulePayload, null, 2)}

关联岗位：
${JSON.stringify(jobsPayload, null, 2)}

请严格返回 JSON，不要附加其他文字，结构如下：
{
  "summary": "整体判断，说明这套规则当前最主要的问题或优点",
  "coverageGaps": ["覆盖不足 1", "覆盖不足 2"],
  "weightAdjustments": ["权重失衡建议 1", "权重失衡建议 2"],
  "industrySignals": ["行业/业务门槛判断 1", "行业/业务门槛判断 2"],
  "recommendedChanges": ["建议动作 1", "建议动作 2"],
  "proposedRule": {
    "name": "${rule.name}",
    "description": "优化后规则的核心理念",
    "dimensions": [
      {
        "id": "dim-1",
        "name": "维度名称",
        "weight": 40,
        "description": "维度说明",
        "type": "skills|experience|education|projects|custom",
        "evaluator": {
          "method": "keyword|duration|ai|boolean|range",
          "keywords": ["需要时填写"],
          "matchMode": "any|all",
          "minYears": 0,
          "preferredYears": 0,
          "aiPrompt": "需要时填写",
          "minValue": 0,
          "maxValue": 100,
          "booleanField": "需要时填写"
        }
      }
    ],
    "totalScore": 100
  }
}

要求：
1. 结合评分参考和关联岗位一起判断，不要脱离岗位内容给泛泛建议。
2. 明确指出哪些岗位要求没有被当前维度覆盖。
3. 如果权重不合理，直接给出调整方向。
4. proposedRule 必须是一套可落地的完整规则草案，维度总权重为 100。`;
}

export function normalizeScoringRuleAnalysis(raw: unknown, baseRule: ScoringRule): ScoringRuleAnalysis {
  const candidate = typeof raw === "string" ? parseJsonFromText(raw) : raw;
  const data = isRecord(candidate) ? candidate : {};
  const normalizedProposedRule = normalizeProposedRule(data.proposedRule, baseRule);

  return {
    summary: normalizeString(data.summary),
    coverageGaps: normalizeStringArray(data.coverageGaps),
    weightAdjustments: normalizeStringArray(data.weightAdjustments),
    industrySignals: normalizeStringArray(data.industrySignals),
    recommendedChanges: normalizeStringArray(data.recommendedChanges),
    proposedRule: normalizedProposedRule,
    generatedAt: normalizeDate(data.generatedAt),
  };
}

export function applyScoringRuleAnalysis(rule: ScoringRule, analysis: ScoringRuleAnalysis): ScoringRule {
  const proposed = analysis.proposedRule;

  return {
    ...rule,
    description: proposed.description || rule.description,
    totalScore: proposed.totalScore || rule.totalScore,
    dimensions: proposed.dimensions.map((dimension, index) => ({
      ...dimension,
      id: dimension.id || `${rule.id}-dim-${index}`,
    })),
    updatedAt: new Date(),
  };
}

function normalizeProposedRule(raw: unknown, baseRule: ScoringRule): ScoringRule {
  const data = isRecord(raw) ? raw : {};
  const dimensions = Array.isArray(data.dimensions)
    ? data.dimensions.map((dimension, index) => normalizeDimension(dimension, baseRule, index))
    : baseRule.dimensions;

  const normalizedDimensions = rebalanceDimensions(dimensions);

  return {
    ...baseRule,
    name: normalizeString(data.name) || baseRule.name,
    description: normalizeString(data.description) || baseRule.description,
    dimensions: normalizedDimensions,
    totalScore: 100,
    updatedAt: new Date(),
  };
}

function normalizeDimension(raw: unknown, baseRule: ScoringRule, index: number): ScoringDimension {
  const data = isRecord(raw) ? raw : {};
  const evaluatorRaw = isRecord(data.evaluator) ? data.evaluator : {};

  return {
    id: normalizeString(data.id) || `${baseRule.id}-dim-${index}`,
    name: normalizeString(data.name) || `维度${index + 1}`,
    weight: typeof data.weight === "number" ? data.weight : 0,
    description: normalizeString(data.description),
    type: normalizeDimensionType(data.type),
    evaluator: {
      method: normalizeMethod(evaluatorRaw.method),
      keywords: normalizeStringArray(evaluatorRaw.keywords),
      matchMode: evaluatorRaw.matchMode === "all" ? "all" : "any",
      minYears: normalizeNumber(evaluatorRaw.minYears),
      preferredYears: normalizeNumber(evaluatorRaw.preferredYears),
      aiPrompt: normalizeString(evaluatorRaw.aiPrompt),
      minValue: normalizeNumber(evaluatorRaw.minValue),
      maxValue: normalizeNumber(evaluatorRaw.maxValue),
      booleanField: normalizeString(evaluatorRaw.booleanField),
    },
  };
}

function rebalanceDimensions(dimensions: ScoringDimension[]): ScoringDimension[] {
  if (dimensions.length === 0) {
    return [];
  }

  const total = dimensions.reduce((sum, dimension) => sum + (dimension.weight || 0), 0);
  if (total === 100) {
    return dimensions;
  }

  if (total <= 0) {
    const equal = Math.floor(100 / dimensions.length);
    const result = dimensions.map((dimension) => ({ ...dimension, weight: equal }));
    result[0].weight += 100 - result.reduce((sum, dimension) => sum + dimension.weight, 0);
    return result;
  }

  const scaled = dimensions.map((dimension) => ({
    ...dimension,
    weight: Math.round(((dimension.weight || 0) / total) * 100),
  }));
  scaled[0].weight += 100 - scaled.reduce((sum, dimension) => sum + dimension.weight, 0);
  return scaled;
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

function normalizeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeMethod(value: unknown): "ai" | "keyword" | "duration" | "boolean" | "range" {
  if (value === "keyword" || value === "duration" || value === "boolean" || value === "range") {
    return value;
  }
  return "ai";
}

function normalizeDimensionType(value: unknown): "skills" | "experience" | "education" | "projects" | "custom" {
  if (value === "skills" || value === "experience" || value === "education" || value === "projects") {
    return value;
  }
  return "custom";
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
