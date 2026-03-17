import { NextRequest, NextResponse } from "next/server";
import { loadCandidate, saveCandidate, loadRawResumeText } from "@/lib/storage";
import { getAgentManager } from "@/lib/agents";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const candidate = loadCandidate(id);
    if (!candidate) {
      return NextResponse.json(
        { error: "候选人未找到" },
        { status: 404 }
      );
    }

    const rawText = loadRawResumeText(id);

    let resumeText = "";
    if (rawText) {
      resumeText = rawText;
    } else {
      const parts: string[] = [];
      const pd = candidate.resume.parsedData;
      if (pd?.summary) parts.push(`自我评价: ${pd.summary}`);
      if (pd?.skills?.length) parts.push(`技能: ${pd.skills.join(", ")}`);
      if (pd?.experience?.length) {
        parts.push("工作经历:\n" + pd.experience.map(
          (e) => `- ${e.position} @ ${e.company} (${e.duration}): ${e.description}`
        ).join("\n"));
      }
      if (pd?.education?.length) {
        parts.push("教育背景:\n" + pd.education.map(
          (e) => `- ${e.school}, ${e.degree} ${e.major}`
        ).join("\n"));
      }
      if (pd?.projects?.length) {
        parts.push("项目经历:\n" + pd.projects.map(
          (p) => `- ${p.name} (${p.role}): ${p.description}`
        ).join("\n"));
      }
      resumeText = parts.length > 0 ? parts.join("\n\n") : "暂无简历数据";
    }

    const prompt = `请分析以下候选人简历信息，提取结构化数据：

候选人姓名: ${candidate.name}
邮箱: ${candidate.contact.email}

简历内容:
${resumeText}

请以JSON格式返回以下信息（只返回JSON，不要其他内容）：
{
  "experience": [{"company": "", "position": "", "duration": "", "description": "", "achievements": []}],
  "education": [{"school": "", "degree": "", "major": "", "graduation": ""}],
  "skills": ["skill1", "skill2"],
  "projects": [{"name": "", "role": "", "description": "", "technologies": []}],
  "summary": "一句话总结该候选人的核心优势",
  "pros": ["正面评价1: 具体优势或亮点", "正面评价2"],
  "cons": ["风险/不足1: 具体问题或关注点", "风险/不足2"]
}

注意：pros和cons必须同时给出，即使候选人很优秀也要指出潜在风险（如技术栈单一、行业跨度大等）`;

    try {
      const agentManager = getAgentManager();
      const response = await agentManager.processMessage(prompt, []);

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        candidate.resume.parsedData = {
          experience: parsed.experience || candidate.resume.parsedData?.experience || [],
          education: parsed.education || candidate.resume.parsedData?.education || [],
          skills: parsed.skills || candidate.resume.parsedData?.skills || [],
          projects: parsed.projects ?? candidate.resume.parsedData?.projects,
          summary: parsed.summary ?? candidate.resume.parsedData?.summary,
          pros: Array.isArray(parsed.pros) ? parsed.pros : [],
          cons: Array.isArray(parsed.cons) ? parsed.cons : [],
        };
      }
    } catch (aiError) {
      console.error("AI analysis failed:", aiError);
      return NextResponse.json(
        { error: `AI分析失败: ${aiError instanceof Error ? aiError.message : "未知错误"}` },
        { status: 500 }
      );
    }

    candidate.status = candidate.status === "pending" ? "screening" : candidate.status;
    candidate.updatedAt = new Date();
    saveCandidate(candidate);

    return NextResponse.json(candidate);
  } catch (error) {
    console.error("Analyze error:", error);
    return NextResponse.json(
      { error: `分析失败: ${error instanceof Error ? error.message : "未知错误"}` },
      { status: 500 }
    );
  }
}
