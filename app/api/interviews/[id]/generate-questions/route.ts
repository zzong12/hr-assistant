import { NextRequest, NextResponse } from "next/server";
import {
  loadInterview,
  saveInterview,
  loadJob,
  loadCandidate,
} from "@/lib/storage";
import { getAgentManager } from "@/lib/agents";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const interview = loadInterview(id);
    if (!interview) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 }
      );
    }

    const job = loadJob(interview.jobId);
    const candidate = loadCandidate(interview.candidateId);

    const jobInfo = job
      ? `职位: ${job.title} (${job.level})\n部门: ${job.department}\n技能要求: ${job.skills?.join(", ")}\n职责: ${job.description.responsibilities.join("; ")}`
      : "无职位信息";

    const candidateInfo = candidate
      ? `候选人: ${candidate.name}\n技能: ${candidate.resume.parsedData?.skills?.join(", ") || "未知"}\n经历: ${candidate.resume.parsedData?.experience?.map((e) => `${e.position}@${e.company}`).join(", ") || "未知"}`
      : "无候选人信息";

    const prompt = `请为以下面试生成面试题目。

${jobInfo}

${candidateInfo}

请生成8-10道面试题，包含技术题、项目经验题、行为面试题。
每道题必须包含3-5个"回答关键点"（keyPoints），每个关键点标注水平等级和解释。

以JSON数组格式返回（只返回JSON数组，不要其他内容）：
[{
  "question": "题目",
  "category": "技术/项目经验/行为/文化匹配",
  "difficulty": "easy/medium/hard",
  "purpose": "考察点",
  "keyPoints": [
    {"point": "关键点描述", "level": "basic/intermediate/advanced/expert", "explanation": "提到此关键点代表候选人达到什么水平"}
  ]
}]

keyPoints说明：
- basic: 基础水平，能提到这个点说明有基本了解
- intermediate: 中级水平，能展开说明细节和实际应用
- advanced: 高级水平，能深入分析原理和权衡取舍
- expert: 专家水平，能给出创新性见解或跨领域整合`;

    try {
      const agentManager = getAgentManager();
      const response = await agentManager.processMessage(prompt, []);

      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const questions = JSON.parse(jsonMatch[0]);
        interview.questions = questions.map((q: any) => ({
          question: q.question,
          category: q.category || "通用",
          difficulty: q.difficulty,
          purpose: q.purpose,
          keyPoints: Array.isArray(q.keyPoints) ? q.keyPoints.map((kp: any) => ({
            point: kp.point || "",
            level: ["basic", "intermediate", "advanced", "expert"].includes(kp.level) ? kp.level : "basic",
            explanation: kp.explanation || "",
          })) : [],
        }));
      }
    } catch (aiError) {
      console.error("AI question generation failed:", aiError);
      // Fallback to basic questions
      interview.questions = [
        { question: "请简单介绍一下你自己", category: "开场" },
        { question: "请描述你最近的一个项目经历", category: "项目经验" },
        { question: "你如何处理工作中的技术挑战？", category: "行为" },
        { question: "你对未来3年的职业规划是什么？", category: "文化匹配" },
      ];
    }

    saveInterview(interview);
    return NextResponse.json(interview);
  } catch (error) {
    console.error("Generate questions error:", error);
    return NextResponse.json(
      { error: "Failed to generate questions" },
      { status: 500 }
    );
  }
}
