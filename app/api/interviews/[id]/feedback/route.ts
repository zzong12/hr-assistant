import { NextRequest, NextResponse } from "next/server";
import {
  loadInterview,
  saveInterview,
  loadCandidate,
  saveCandidate,
} from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { freeText, ...manualScores } = body;

    const interview = loadInterview(id);
    if (!interview) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 }
      );
    }

    if (freeText) {
      try {
        const { getAgentManager } = await import("@/lib/agents");
        const { loadSetting } = await import("@/lib/storage");
        const agentManager = getAgentManager();

        let dimensionPrompt = "";
        const presetId = body.evaluationPresetId || interview.evaluationPreset?.id;
        if (presetId) {
          const presetsJson = loadSetting("evaluation_presets");
          if (presetsJson) {
            try {
              const presets = JSON.parse(presetsJson);
              const preset = presets.find((p: any) => p.id === presetId);
              if (preset?.dimensions?.length) {
                dimensionPrompt = `\n\n此外，请按以下自定义维度评分（每项0-10分）：\n"dimensionScores": {\n${preset.dimensions.map((d: any) => `  "${d.id}": 0-10  // ${d.name}（权重${d.weight}%）${d.description ? ": " + d.description : ""}`).join(",\n")}\n}`;
              }
            } catch {}
          }
        }

        const prompt = `请分析以下面试反馈文本，提取结构化评分。

反馈原文：
${freeText}

请严格按JSON格式返回（只返回JSON）：
{
  "technicalScore": 0-100,
  "communicationScore": 0-100,
  "problemSolvingScore": 0-100,
  "culturalFitScore": 0-100,
  "overallScore": 0-100,${dimensionPrompt}
  "strengths": ["优势1", "优势2"],
  "concerns": ["关注点1"],
  "pros": ["正面评价1: 具体优点", "正面评价2"],
  "cons": ["风险/不足1: 具体问题", "风险/不足2"],
  "notes": "原始反馈摘要",
  "recommendation": "strong_hire/hire/no_hire/strong_no_hire"
}

重要：pros和cons必须同时给出，客观平衡地分析候选人的优势和不足。`;

        const response = await agentManager.processMessage(prompt, []);
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("AI解析失败");
        const parsed = JSON.parse(jsonMatch[0]);

        interview.feedback = {
          technicalScore: Number(parsed.technicalScore) || 0,
          communicationScore: Number(parsed.communicationScore) || 0,
          problemSolvingScore: Number(parsed.problemSolvingScore) || 0,
          culturalFitScore: Number(parsed.culturalFitScore) || 0,
          overallScore: Number(parsed.overallScore) || 0,
          dimensionScores: parsed.dimensionScores || undefined,
          strengths: parsed.strengths || [],
          concerns: parsed.concerns || [],
          pros: Array.isArray(parsed.pros) ? parsed.pros : [],
          cons: Array.isArray(parsed.cons) ? parsed.cons : [],
          notes: freeText,
          recommendation: parsed.recommendation || "no_hire",
        };
        interview.status = "completed";
        saveInterview(interview);

        // Update candidate status
        if (interview.candidateId) {
          const candidate = loadCandidate(interview.candidateId);
          if (candidate) {
            const rec = parsed.recommendation;
            if (rec === "strong_hire" || rec === "hire") candidate.status = "offered";
            else if (rec === "no_hire" || rec === "strong_no_hire") candidate.status = "rejected";
            candidate.updatedAt = new Date();
            saveCandidate(candidate);
          }
        }

        // Feishu notification
        try {
          const { notifyFeedbackSubmitted } = await import("@/lib/notify");
          await notifyFeedbackSubmitted(
            interview.candidateName || "候选人",
            parsed.recommendation,
            Number(parsed.overallScore) || 0
          );
        } catch {}

        return NextResponse.json(interview);
      } catch (error) {
        console.error("AI feedback error:", error);
        return NextResponse.json(
          {
            error: `AI反馈分析失败: ${error instanceof Error ? error.message : "未知错误"}`,
          },
          { status: 500 }
        );
      }
    }

    const {
      technicalScore,
      communicationScore,
      problemSolvingScore,
      culturalFitScore,
      overallScore,
      strengths,
      concerns,
      notes,
      recommendation,
    } = manualScores;

    interview.feedback = {
      technicalScore: Number(technicalScore) || 0,
      communicationScore: Number(communicationScore) || 0,
      problemSolvingScore: Number(problemSolvingScore) || 0,
      culturalFitScore: Number(culturalFitScore) || 0,
      overallScore: Number(overallScore) || 0,
      strengths: strengths || [],
      concerns: concerns || [],
      notes: notes || "",
      recommendation,
    };
    interview.status = "completed";

    saveInterview(interview);

    // Update candidate status based on recommendation
    if (interview.candidateId) {
      const candidate = loadCandidate(interview.candidateId);
      if (candidate) {
        if (recommendation === "strong_hire" || recommendation === "hire") {
          candidate.status = "offered";
        } else if (
          recommendation === "no_hire" ||
          recommendation === "strong_no_hire"
        ) {
          candidate.status = "rejected";
        }
        candidate.updatedAt = new Date();
        saveCandidate(candidate);
      }
    }

    return NextResponse.json(interview);
  } catch (error) {
    console.error("Feedback error:", error);
    return NextResponse.json(
      { error: "Failed to save feedback" },
      { status: 500 }
    );
  }
}
