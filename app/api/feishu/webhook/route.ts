import { NextRequest, NextResponse } from "next/server";
import { replyFeishuCard, replyFeishuMessage, downloadFeishuFile, isFeishuConfigured } from "@/lib/feishu";
import { getAgentManager } from "@/lib/agents";
import { loadSetting, generateId, saveCandidate, saveRawResumeText } from "@/lib/storage";
import type { Candidate } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const processedEvents = new Set<string>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Handle URL verification challenge
    if (body.challenge) {
      return NextResponse.json({ challenge: body.challenge });
    }

    // Verify token
    const verificationToken = process.env.FEISHU_VERIFICATION_TOKEN || loadSetting("feishu_verification_token");
    if (verificationToken && body.header?.token !== verificationToken) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }

    // Deduplicate events
    const eventId = body.header?.event_id;
    if (eventId) {
      if (processedEvents.has(eventId)) {
        return NextResponse.json({ ok: true });
      }
      processedEvents.add(eventId);
      if (processedEvents.size > 1000) {
        const entries = Array.from(processedEvents);
        entries.slice(0, 500).forEach((e) => processedEvents.delete(e));
      }
    }

    const eventType = body.header?.event_type;
    if (eventType !== "im.message.receive_v1") {
      return NextResponse.json({ ok: true });
    }

    const message = body.event?.message;
    const sender = body.event?.sender;
    if (!message || !sender) return NextResponse.json({ ok: true });

    // Skip bot's own messages
    if (sender.sender_type === "app") return NextResponse.json({ ok: true });

    const messageId = message.message_id;
    const messageType = message.message_type;
    const chatId = message.chat_id;

    // Process in background to respond within 3s
    handleFeishuMessage(messageId, messageType, message, chatId).catch(console.error);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Feishu Webhook] Error:", error);
    return NextResponse.json({ ok: true });
  }
}

async function handleFeishuMessage(messageId: string, messageType: string, message: any, chatId: string) {
  try {
    if (!isFeishuConfigured()) {
      await replyFeishuMessage(messageId, "飞书应用未配置，请在设置页面配置 App ID 和 App Secret");
      return;
    }

    let userText = "";

    if (messageType === "text") {
      try {
        const content = JSON.parse(message.content);
        userText = content.text || "";
        // Remove @mentions
        userText = userText.replace(/@\w+/g, "").trim();
      } catch {
        userText = message.content || "";
      }
    } else if (messageType === "file") {
      // Handle file uploads (resumes)
      try {
        const content = JSON.parse(message.content);
        const fileKey = content.file_key;
        const fileName = content.file_name || "resume.pdf";

        if (!fileKey) {
          await replyFeishuMessage(messageId, "无法读取文件，请重新发送");
          return;
        }

        const fileBuffer = await downloadFeishuFile(messageId, fileKey);
        if (!fileBuffer) {
          await replyFeishuMessage(messageId, "文件下载失败，请重试");
          return;
        }

        await replyFeishuMessage(messageId, `正在分析简历: ${fileName}...`);

        let text = "";
        if (fileName.toLowerCase().endsWith(".pdf")) {
          const pdfParseModule = await import("pdf-parse");
          const pdfParse = (pdfParseModule as any).default || pdfParseModule;
          const pdfData = await pdfParse(fileBuffer);
          text = pdfData.text;
        } else {
          text = fileBuffer.toString("utf-8");
        }

        if (!text.trim()) {
          await replyFeishuMessage(messageId, "无法从文件中提取文本内容");
          return;
        }

        // Create candidate with AI analysis
        const { parseResume } = await import("@/lib/resume-utils");
        const parsedData = await parseResume(fileName, text, fileName.endsWith(".pdf") ? "pdf" : "text");

        const candidate: Candidate = {
          id: generateId(),
          name: "待分析",
          contact: { email: "" },
          resume: { filename: fileName, filepath: "", parsedData: parsedData || undefined },
          matchedJobs: [],
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        saveCandidate(candidate);
        saveRawResumeText(candidate.id, text);

        // AI analysis
        try {
          const agentManager = getAgentManager();
          const prompt = `分析以下简历，返回JSON（只返回JSON）：
{"name":"姓名","email":"邮箱","phone":"手机","skills":["技能"],"summary":"一句话总结"}

简历：${text.slice(0, 3000)}`;

          const response = await agentManager.processMessage(prompt, []);
          const jsonMatch = response.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            candidate.name = parsed.name || candidate.name;
            candidate.contact = { email: parsed.email || "", phone: parsed.phone || "" };
            candidate.resume.parsedData = {
              skills: parsed.skills || [],
              summary: parsed.summary || "",
              experience: [],
              education: [],
            };
            candidate.updatedAt = new Date();
            saveCandidate(candidate);
          }
        } catch {}

        await replyFeishuCard(messageId, "简历分析完成",
          `**候选人**: ${candidate.name}\n**技能**: ${candidate.resume.parsedData?.skills?.join(", ") || "待分析"}\n**摘要**: ${candidate.resume.parsedData?.summary || "待分析"}`,
          "green"
        );
        return;
      } catch (fileErr) {
        console.error("[Feishu] File processing error:", fileErr);
        await replyFeishuMessage(messageId, "文件处理失败，请重试");
        return;
      }
    } else {
      await replyFeishuMessage(messageId, "目前支持文本消息和文件（简历PDF），其他消息类型暂不支持");
      return;
    }

    if (!userText) return;

    // Process text with AI
    const agentManager = getAgentManager();
    const response = await agentManager.processMessage(userText, []);

    // Parse and execute actions
    const actionRegex = /<!--ACTION:([\s\S]*?)-->/g;
    let match;
    const actions: string[] = [];
    let cleanContent = response.content;

    while ((match = actionRegex.exec(response.content)) !== null) {
      actions.push(match[1]);
      cleanContent = cleanContent.replace(match[0], "");
    }
    cleanContent = cleanContent.trim();

    // Execute actions
    for (const actionJson of actions) {
      try {
        const action = JSON.parse(actionJson);
        switch (action.type) {
          case "create_job": {
            const res = await fetch(`${getBaseUrl()}/api/jobs/generate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ freeText: `职位: ${action.data.title}, 部门: ${action.data.department}, 技能: ${(action.data.skills || []).join(",")}`, save: true }),
            });
            if (res.ok) cleanContent += `\n\n✅ 已创建职位「${action.data.title}」`;
            break;
          }
          case "update_status": {
            const res = await fetch(`${getBaseUrl()}/api/candidates`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: action.data.candidateId, status: action.data.newStatus }),
            });
            if (res.ok) cleanContent += `\n\n✅ 候选人状态已更新`;
            break;
          }
          case "schedule_interview": {
            const res = await fetch(`${getBaseUrl()}/api/interviews`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(action.data),
            });
            if (res.ok) cleanContent += `\n\n✅ 面试已安排`;
            break;
          }
        }
      } catch {}
    }

    // Reply via Feishu
    if (cleanContent.length > 500) {
      await replyFeishuCard(messageId, "Nexus 回复", cleanContent.slice(0, 2000), "blue");
    } else {
      await replyFeishuMessage(messageId, cleanContent);
    }
  } catch (error) {
    console.error("[Feishu] Message handling error:", error);
    try {
      await replyFeishuMessage(messageId, "处理消息时出错，请稍后重试");
    } catch {}
  }
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
}
