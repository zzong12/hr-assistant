import test from "node:test";
import assert from "node:assert/strict";

import {
  applyScoringRuleAnalysis,
  buildScoringRuleAnalysisPrompt,
  normalizeScoringRuleAnalysis,
} from "../lib/scoring-rule-analysis-utils.ts";
import type { Job, ScoringRule, ScoringRuleAnalysis } from "../lib/types.ts";

function makeRule(overrides: Partial<ScoringRule> = {}): ScoringRule {
  return {
    id: "rule-1",
    name: "支付产品评分参考",
    description: "关注支付业务理解与跨团队推进",
    version: "1.2.0",
    totalScore: 100,
    dimensions: [
      {
        id: "dim-1",
        name: "支付经验",
        weight: 35,
        description: "评估支付产品与闭环经验",
        type: "experience",
        evaluator: { method: "ai", aiPrompt: "评估支付产品经验" },
      },
      {
        id: "dim-2",
        name: "协同能力",
        weight: 25,
        description: "评估跨团队推进",
        type: "custom",
        evaluator: { method: "ai", aiPrompt: "评估协同能力" },
      },
    ],
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-10T00:00:00.000Z"),
    ...overrides,
  };
}

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    title: "高级支付产品经理",
    level: "senior",
    department: "支付业务",
    description: {
      overview: "负责支付产品规划",
      responsibilities: ["推进支付链路优化"],
      requirements: ["熟悉收单、清结算、风控协同"],
      benefits: [],
    },
    skills: ["支付产品", "清结算", "风控协同"],
    status: "active",
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-10T00:00:00.000Z"),
    ...overrides,
  };
}

test("normalizeScoringRuleAnalysis extracts wrapped JSON and preserves proposed rule", () => {
  const raw = `分析如下\n\n\`\`\`json
  {
    "summary": "当前规则对支付行业深度覆盖不足。",
    "coverageGaps": ["缺少行业能力维度"],
    "weightAdjustments": ["降低通用协同权重，提升行业经验权重"],
    "industrySignals": ["支付行业迁移成本较高"],
    "recommendedChanges": ["新增行业理解维度"],
    "proposedRule": {
      "name": "支付产品评分参考",
      "description": "更强调行业经验与复杂协同",
      "dimensions": [
        {
          "id": "dim-a",
          "name": "行业理解",
          "weight": 40,
          "description": "判断支付行业理解",
          "type": "custom",
          "evaluator": { "method": "ai", "aiPrompt": "评估行业理解" }
        },
        {
          "id": "dim-b",
          "name": "协同推进",
          "weight": 60,
          "description": "判断协同推进",
          "type": "custom",
          "evaluator": { "method": "ai", "aiPrompt": "评估协同推进" }
        }
      ],
      "totalScore": 100
    }
  }
  \`\`\``;

  const analysis = normalizeScoringRuleAnalysis(raw, makeRule());

  assert.equal(analysis.summary, "当前规则对支付行业深度覆盖不足。");
  assert.deepEqual(analysis.coverageGaps, ["缺少行业能力维度"]);
  assert.equal(analysis.proposedRule.dimensions.length, 2);
  assert.equal(analysis.proposedRule.totalScore, 100);
});

test("applyScoringRuleAnalysis loads proposed rule into current rule identity with draft marker", () => {
  const rule = makeRule();
  const analysis: ScoringRuleAnalysis = {
    summary: "建议强化支付行业判断",
    coverageGaps: [],
    weightAdjustments: [],
    industrySignals: [],
    recommendedChanges: [],
    proposedRule: {
      ...makeRule({
        id: "rule-temp",
        name: "候选草案",
        version: "9.9.9",
        dimensions: [
          {
            id: "draft-dim-1",
            name: "行业理解",
            weight: 55,
            description: "判断行业理解",
            type: "custom",
            evaluator: { method: "ai", aiPrompt: "评估行业理解" },
          },
          {
            id: "draft-dim-2",
            name: "复杂协同",
            weight: 45,
            description: "判断复杂协同",
            type: "custom",
            evaluator: { method: "ai", aiPrompt: "评估复杂协同" },
          },
        ],
      }),
    },
    generatedAt: new Date("2026-03-15T00:00:00.000Z"),
  };

  const applied = applyScoringRuleAnalysis(rule, analysis);

  assert.equal(applied.id, rule.id);
  assert.equal(applied.name, rule.name);
  assert.equal(applied.version, rule.version);
  assert.equal(applied.dimensions.length, 2);
  assert.equal(applied.dimensions[0].name, "行业理解");
});

test("buildScoringRuleAnalysisPrompt includes rule details and linked jobs context", () => {
  const prompt = buildScoringRuleAnalysisPrompt(makeRule(), [makeJob()]);

  assert.match(prompt, /支付产品评分参考/);
  assert.match(prompt, /高级支付产品经理/);
  assert.match(prompt, /关联岗位/);
  assert.match(prompt, /proposedRule/);
});
