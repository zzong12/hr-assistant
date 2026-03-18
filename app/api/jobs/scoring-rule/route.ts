import { NextRequest, NextResponse } from "next/server";
import { getAgentManager } from "@/lib/agents";
import type { ScoringRule } from "@/lib/types";
import { generateId } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      jobTitle,
      jobLevel,
      jobSkills,
      naturalLanguageCriteria,
      department,
      description,
    } = body;

    if (!jobTitle) {
      return NextResponse.json(
        { error: "jobTitle is required" },
        { status: 400 }
      );
    }

    const promptParts: string[] = [
      `你是一个资深 HR 专家。请根据以下职位信息和用户的评估偏好，拆解出候选人评估维度。`,
      ``,
      `职位名称: ${jobTitle}`,
    ];

    if (jobLevel) promptParts.push(`职位级别: ${jobLevel}`);
    if (department) promptParts.push(`所属部门: ${department}`);
    if (jobSkills && jobSkills.length > 0) {
      promptParts.push(`技能要求: ${jobSkills.join(", ")}`);
    }
    if (description?.requirements && description.requirements.length > 0) {
      promptParts.push(`职位要求: ${description.requirements.slice(0, 5).join("; ")}`);
    }
    if (naturalLanguageCriteria) {
      promptParts.push(`\n用户评估偏好: ${naturalLanguageCriteria}`);
    }

    promptParts.push(`
请完成以下任务：
1. 用专业 HR 语言重新组织用户的偏好描述
2. 拆解为 3-6 个评估维度，每个维度包含清晰的名称和说明
3. AI 自动分配权重（总和 = 100），用户不需要关心具体权重
4. 为每个维度选择最合适的评估方法

严格按以下 JSON 格式输出（只输出 JSON，不要其他文字）：
\`\`\`json
{
  "rule": {
    "id": "rule-auto",
    "name": "${jobTitle}评估规则",
    "description": "用一句话总结这套评估规则的核心理念",
    "version": "1.0.0",
    "dimensions": [
      {
        "id": "dim-0",
        "name": "维度名称（简洁2-4字）",
        "weight": 数字（所有维度权重总和=100），
        "description": "用一句话说明这个维度评估什么、为什么重要",
        "type": "skills|experience|education|projects|custom",
        "evaluator": {
          "method": "keyword|duration|ai",
          "keywords": ["关键词列表，仅keyword方法需要"],
          "matchMode": "any|all",
          "minYears": 0,
          "preferredYears": 0,
          "aiPrompt": "AI评估时的具体指导"
        }
      }
    ],
    "totalScore": 100
  },
  "explanation": "用 2-3 句话解释这套规则的设计思路"
}
\`\`\`

注意：
- 根据职位和偏好合理分配权重，无需用户手动调整
- keyword 方法适合技能匹配，duration 适合经验年限，ai 适合需要综合判断的维度
- 维度说明要专业、具体，不要泛泛而谈`);

    const prompt = promptParts.join("\n");
    const agentManager = getAgentManager();
    const response = await agentManager.processMessage(prompt, []);

    const jsonMatch = response.content.match(/```json\s*([\s\S]*?)\s*```/) ||
                      response.content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to generate valid scoring rule" },
        { status: 500 }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
    } catch (e) {
      return NextResponse.json(
        { error: "Failed to parse generated rule", details: String(e) },
        { status: 500 }
      );
    }

    const rule = parsed.rule as ScoringRule;

    if (!rule || !rule.dimensions || rule.dimensions.length === 0) {
      return NextResponse.json(
        { error: "Generated rule has no dimensions" },
        { status: 500 }
      );
    }

    // Normalize weights
    const totalWeight = rule.dimensions.reduce((sum, dim) => sum + (dim.weight || 0), 0);
    if (totalWeight !== 100 && totalWeight > 0) {
      const scale = 100 / totalWeight;
      rule.dimensions = rule.dimensions.map(dim => ({
        ...dim,
        weight: Math.round((dim.weight || 0) * scale),
      }));
      const newTotal = rule.dimensions.reduce((sum, dim) => sum + dim.weight, 0);
      if (newTotal !== 100) {
        const largestDim = rule.dimensions.reduce((max, dim) =>
          dim.weight > max.weight ? dim : max
        );
        largestDim.weight += (100 - newTotal);
      }
    } else if (totalWeight === 0) {
      const equalWeight = Math.floor(100 / rule.dimensions.length);
      rule.dimensions = rule.dimensions.map(dim => ({
        ...dim,
        weight: equalWeight,
      }));
      const newTotal = rule.dimensions.reduce((sum, dim) => sum + dim.weight, 0);
      if (newTotal !== 100) {
        rule.dimensions[0].weight += (100 - newTotal);
      }
    }

    if (!rule.id) rule.id = `rule-${generateId()}`;
    if (!rule.createdAt) rule.createdAt = new Date();
    if (!rule.updatedAt) rule.updatedAt = new Date();
    if (!rule.totalScore) rule.totalScore = 100;

    rule.dimensions = rule.dimensions.map((dim, idx) => ({
      ...dim,
      id: dim.id || `${rule.id}-dim-${idx}`,
      type: dim.type || "custom",
      evaluator: dim.evaluator || { method: "ai", aiPrompt: dim.description || "" },
    }));

    return NextResponse.json({
      rule,
      explanation: parsed.explanation || "",
      agentUsed: response.agentUsed,
    });
  } catch (error) {
    console.error("Scoring rule generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate scoring rule", details: String(error) },
      { status: 500 }
    );
  }
}
