import { NextRequest, NextResponse } from "next/server";

import { getAgentManager } from "@/lib/agents";
import { buildScoringRuleAnalysisPrompt, normalizeScoringRuleAnalysis } from "@/lib/scoring-rule-analysis-utils";
import { getLinkedJobsForRule, loadScoringRule, saveScoringRule } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ruleId = typeof body.ruleId === "string" ? body.ruleId : "";

    if (!ruleId) {
      return NextResponse.json({ error: "Rule ID is required" }, { status: 400 });
    }

    const rule = loadScoringRule(ruleId);
    if (!rule) {
      return NextResponse.json({ error: "Scoring rule not found" }, { status: 404 });
    }

    const linkedJobs = getLinkedJobsForRule(ruleId);
    const prompt = buildScoringRuleAnalysisPrompt(rule, linkedJobs);
    const agentManager = getAgentManager();
    const response = await agentManager.processMessage(prompt, [], "scoring_rule_generator");
    const analysis = normalizeScoringRuleAnalysis(response.content, rule);
    const persistedAt = new Date();
    analysis.generatedAt = persistedAt;
    analysis.proposedRule.updatedAt = persistedAt;

    const updatedRule = {
      ...rule,
      analysis,
      updatedAt: persistedAt,
    };

    const saved = saveScoringRule(updatedRule);
    if (!saved) {
      return NextResponse.json({ error: "Failed to save scoring rule analysis" }, { status: 500 });
    }

    return NextResponse.json({
      analysis,
      rule: updatedRule,
      linkedJobs,
      raw: response.content,
    });
  } catch (error) {
    console.error("Error analyzing scoring rule:", error);
    const message = error instanceof Error ? error.message : "Failed to analyze scoring rule";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
