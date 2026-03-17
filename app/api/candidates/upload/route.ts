import { NextRequest, NextResponse } from "next/server";
import { generateId, saveCandidate, saveRawResumeText } from "@/lib/storage";
import { parseResume } from "@/lib/resume-utils";
import type { Candidate } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const name = (formData.get("name") as string) || "";
    const email = (formData.get("email") as string) || "";
    const phone = (formData.get("phone") as string) || "";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    let text = "";
    const fileType = file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "text";

    if (fileType === "pdf") {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const pdfParseModule = await import("pdf-parse") as any;
        const pdfParse = pdfParseModule.PDFParse || pdfParseModule.default || pdfParseModule;
        if (typeof pdfParse !== "function") {
          throw new Error(`pdf-parse module did not export a callable function. Exports: ${Object.keys(pdfParseModule).join(", ")}`);
        }
        const pdfData = await pdfParse(buffer);
        text = pdfData.text;
      } catch (err) {
        console.error("PDF parse error:", err);
        return NextResponse.json(
          { error: "Failed to parse PDF file" },
          { status: 400 }
        );
      }
    } else {
      text = await file.text();
    }

    if (!text.trim()) {
      return NextResponse.json(
        { error: "Could not extract text from file" },
        { status: 400 }
      );
    }

    const parsedData = await parseResume(file.name, text, fileType);

    const candidate: Candidate = {
      id: generateId(),
      name: name || "未命名候选人",
      contact: { email, phone },
      resume: {
        filename: file.name,
        filepath: "",
        parsedData: parsedData || undefined,
      },
      matchedJobs: [],
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const saved = saveCandidate(candidate);
    if (!saved) {
      return NextResponse.json(
        { error: "保存候选人失败" },
        { status: 500 }
      );
    }

    saveRawResumeText(candidate.id, text);

    // Auto AI analysis
    try {
      const { getAgentManager } = await import("@/lib/agents");
      const agentManager = getAgentManager();
      const analyzePrompt = `分析以下简历文本，返回JSON格式（只返回JSON，不要其他内容）：
{
  "name": "候选人姓名",
  "email": "邮箱",
  "phone": "手机号",
  "wechat": "微信号（如有）",
  "skills": ["技能1", "技能2"],
  "summary": "一句话总结候选人",
  "experience": [{"company":"公司","position":"职位","duration":"时间","description":"描述"}],
  "education": [{"school":"学校","degree":"学位","major":"专业"}],
  "projects": [{"name":"项目名","role":"角色","description":"描述","technologies":["技术"]}]
}

简历内容：
${text.slice(0, 4000)}`;

      const response = await agentManager.processMessage(analyzePrompt, []);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        candidate.name = parsed.name || candidate.name;
        candidate.contact = {
          email: parsed.email || candidate.contact.email || email,
          phone: parsed.phone || candidate.contact.phone || phone,
          wechat: parsed.wechat || undefined,
        };
        candidate.resume.parsedData = {
          skills: parsed.skills || [],
          summary: parsed.summary || "",
          experience: parsed.experience || [],
          education: parsed.education || [],
          projects: parsed.projects || [],
        };
        candidate.updatedAt = new Date();
        saveCandidate(candidate);
      }

      // Feishu notification
      try {
        const { notifyResumeAnalyzed } = await import("@/lib/notify");
        await notifyResumeAnalyzed(candidate.name);
      } catch {}
    } catch (aiErr) {
      console.error("AI analysis error (non-fatal):", aiErr);
    }

    return NextResponse.json(candidate, { status: 201 });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload resume" },
      { status: 500 }
    );
  }
}
