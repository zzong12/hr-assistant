import { NextRequest, NextResponse } from "next/server";
import { loadInterview } from "@/lib/storage";
import { getAgentManager } from "@/lib/agents";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { transcript, currentQuestion, questionIndex } = body;

    if (!transcript?.trim()) {
      return NextResponse.json({ suggestions: [], coveredPointIds: [] });
    }

    const interview = loadInterview(id);
    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    const keyPointsInfo = currentQuestion?.keyPoints?.length
      ? `\n关键点:\n${currentQuestion.keyPoints.map((kp: any, i: number) => `${i + 1}. [${kp.level}] ${kp.point} - ${kp.explanation}`).join("\n")}`
      : "";

    const prompt = `你是面试官的AI助手。根据以下信息，分析候选人的回答并给出建议。

当前面试题: ${currentQuestion?.question || "通用对话"}
考察目的: ${currentQuestion?.purpose || "综合评估"}${keyPointsInfo}

最近转录内容:
${transcript.slice(-1500)}

请返回JSON（只返回JSON）：
{
  "suggestions": ["建议1: 基于候选人已说的内容给出追问建议", "建议2: 指出候选人尚未覆盖的关键领域"],
  "coveredPointIds": ["${questionIndex}-0", "${questionIndex}-2"],
  "summary": "候选人回答质量简评"
}

coveredPointIds: 根据转录内容判断候选人已覆盖了哪些关键点，格式为 "题目索引-关键点索引"
suggestions: 给面试官的实时建议（2-4条），如追问方向、评估提示等`;

    const agentManager = getAgentManager();
    const response = await agentManager.processMessage(prompt, []);

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return NextResponse.json({
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        coveredPointIds: Array.isArray(parsed.coveredPointIds) ? parsed.coveredPointIds : [],
        summary: parsed.summary || "",
      });
    }

    return NextResponse.json({ suggestions: [], coveredPointIds: [] });
  } catch (error) {
    console.error("Voice assist error:", error);
    return NextResponse.json({ suggestions: ["分析暂时不可用"], coveredPointIds: [] });
  }
}
