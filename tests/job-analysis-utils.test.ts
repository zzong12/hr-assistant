import test from "node:test";
import assert from "node:assert/strict";

import {
  buildJobAnalysisPrompt,
  buildJobAnalysisInsight,
  isJobAnalysisStale,
  normalizeJobAnalysis,
} from "../lib/job-analysis-utils.ts";
import type { Job, JobAnalysis } from "../lib/types.ts";

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    title: "高级支付产品经理",
    level: "senior",
    department: "支付业务",
    description: {
      overview: "负责支付产品规划与落地",
      responsibilities: ["推进支付链路优化", "协同风控与清结算团队"],
      requirements: ["5年以上支付产品经验", "熟悉收单与清结算"],
      benefits: ["年度体检"],
    },
    skills: ["支付产品", "清结算", "风控协同"],
    status: "active",
    scoringRule: {
      id: "rule-1",
      name: "支付产品评分卡",
      version: "1.0.0",
      dimensions: [],
      totalScore: 100,
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    },
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-10T00:00:00.000Z"),
    ...overrides,
  };
}

test("normalizeJobAnalysis extracts JSON payload wrapped in markdown fences", () => {
  const raw = `这里是分析结果\n\n\`\`\`json
  {
    "summary": "该岗位核心在于支付业务理解与跨团队推动。",
    "requirementAnalysis": ["必备支付链路经验", "具备复杂协同能力"],
    "candidatePersona": ["有中大型支付平台背景", "善于驱动横向合作"],
    "industryCapabilityLevel": ["行业门槛高", "需要理解收单与清结算"],
    "hiringSuggestions": ["优先关注有支付闭环经验的人选", "谨慎评估纯通用产品背景"]
  }
  \`\`\``;

  const analysis = normalizeJobAnalysis(raw);

  assert.equal(analysis.summary, "该岗位核心在于支付业务理解与跨团队推动。");
  assert.deepEqual(analysis.requirementAnalysis, ["必备支付链路经验", "具备复杂协同能力"]);
  assert.deepEqual(analysis.candidatePersona, ["有中大型支付平台背景", "善于驱动横向合作"]);
});

test("normalizeJobAnalysis fills missing sections with safe defaults", () => {
  const analysis = normalizeJobAnalysis({
    summary: "聚焦供应链履约与效率。",
    requirementAnalysis: ["理解履约链路"],
  });

  assert.equal(analysis.summary, "聚焦供应链履约与效率。");
  assert.deepEqual(analysis.requirementAnalysis, ["理解履约链路"]);
  assert.deepEqual(analysis.candidatePersona, []);
  assert.deepEqual(analysis.industryCapabilityLevel, []);
  assert.deepEqual(analysis.hiringSuggestions, []);
  assert.ok(analysis.generatedAt instanceof Date);
});

test("isJobAnalysisStale returns true when job was updated after analysis generation", () => {
  const analysis: JobAnalysis = {
    summary: "分析摘要",
    requirementAnalysis: [],
    candidatePersona: [],
    industryCapabilityLevel: [],
    hiringSuggestions: [],
    generatedAt: new Date("2026-03-05T00:00:00.000Z"),
  };

  assert.equal(isJobAnalysisStale(makeJob({ analysis })), true);
  assert.equal(isJobAnalysisStale(makeJob({ updatedAt: new Date("2026-03-01T00:00:00.000Z"), analysis })), false);
});

test("buildJobAnalysisInsight creates candidate matching hints from analysis", () => {
  const insight = buildJobAnalysisInsight({
    summary: "该岗位看重支付场景理解与跨团队推进。",
    requirementAnalysis: ["必须有支付产品闭环经验", "具备跨团队推进能力"],
    candidatePersona: ["来自支付或金融科技平台", "有中后台复杂项目经验"],
    industryCapabilityLevel: ["行业迁移成本高", "需要理解清结算与风控协同"],
    hiringSuggestions: ["优先联系有收单与清结算经历的人选"],
    generatedAt: new Date("2026-03-10T00:00:00.000Z"),
  });

  assert.match(insight.headline, /AI岗位洞察/);
  assert.equal(insight.mustHaves.length, 2);
  assert.equal(insight.personaHighlights.length, 2);
  assert.equal(insight.industrySignals.length, 2);
});

test("buildJobAnalysisPrompt includes job core fields and output schema guidance", () => {
  const prompt = buildJobAnalysisPrompt(makeJob());

  assert.match(prompt, /高级支付产品经理/);
  assert.match(prompt, /支付业务/);
  assert.match(prompt, /清结算/);
  assert.match(prompt, /JSON/);
  assert.match(prompt, /candidatePersona/);
});
