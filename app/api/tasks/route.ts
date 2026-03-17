import { NextRequest, NextResponse } from "next/server";
import { generateId, saveTask, loadTask, loadPendingTasks, saveCandidate, loadCandidate, loadAllJobs, saveRawResumeText } from "@/lib/storage";
import type { BackgroundTask } from "@/lib/types";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (id) {
    const task = loadTask(id);
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    return NextResponse.json(task);
  }
  const tasks = loadPendingTasks();
  return NextResponse.json({ tasks });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, input } = body;

    if (type === "batch_analyze") {
      const { candidateIds } = input;
      if (!candidateIds?.length) return NextResponse.json({ error: "No candidates" }, { status: 400 });

      const task: BackgroundTask = {
        id: generateId(),
        type: "batch_analyze",
        status: "processing",
        input: { candidateIds },
        progress: 0,
        createdAt: new Date(),
      };
      saveTask(task);

      // Process in background (non-blocking)
      processAnalysisBatch(task.id, candidateIds).catch(console.error);

      return NextResponse.json({ taskId: task.id, status: "processing" });
    }

    return NextResponse.json({ error: "Unknown task type" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: "Task creation failed" }, { status: 500 });
  }
}

async function processAnalysisBatch(taskId: string, candidateIds: string[]) {
  const results: Array<{ id: string; name: string; success: boolean; error?: string }> = [];
  
  for (let i = 0; i < candidateIds.length; i++) {
    try {
      const candidate = loadCandidate(candidateIds[i]);
      if (!candidate) {
        results.push({ id: candidateIds[i], name: "未知", success: false, error: "候选人不存在" });
        continue;
      }

      const { getAgentManager } = await import("@/lib/agents");
      const agentManager = getAgentManager();
      
      const rawText = (await import("@/lib/storage")).loadRawResumeText(candidateIds[i]);
      if (!rawText) {
        results.push({ id: candidateIds[i], name: candidate.name, success: false, error: "无简历文本" });
        continue;
      }

      const prompt = `分析以下简历，返回JSON格式（只返回JSON）：
{"name":"姓名","email":"邮箱","phone":"手机","skills":["技能"],"summary":"一句话总结","experience":[{"company":"公司","position":"职位","duration":"时间","description":"描述"}],"education":[{"school":"学校","degree":"学位","major":"专业"}]}

简历内容：
${rawText.slice(0, 3000)}`;

      const response = await agentManager.processMessage(prompt, []);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        candidate.name = parsed.name || candidate.name;
        candidate.contact = {
          email: parsed.email || candidate.contact.email,
          phone: parsed.phone || candidate.contact.phone,
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

        // Auto-match active jobs
        const activeJobs = loadAllJobs().filter((j) => j.status === "active");
        if (activeJobs.length > 0) {
          try {
            const matchPrompt = `候选人技能: ${(parsed.skills || []).join(", ")}
候选人摘要: ${parsed.summary || "无"}

请为每个职位打分(0-100)并给出原因，返回JSON数组：
[{"jobId":"id","score":分数,"reason":"原因"}]

活跃职位：
${activeJobs.map((j) => `- [${j.id}] ${j.title} (技能要求: ${(j.skills || []).join(", ")})`).join("\n")}`;

            const matchRes = await agentManager.processMessage(matchPrompt, []);
            const matchJson = matchRes.content.match(/\[[\s\S]*\]/);
            if (matchJson) {
              const matches = JSON.parse(matchJson[0]);
              candidate.matchedJobs = matches.map((m: any) => ({
                jobId: m.jobId,
                jobTitle: activeJobs.find((j) => j.id === m.jobId)?.title,
                score: m.score,
                reason: m.reason,
                assessedAt: new Date(),
              }));
              if (matches.some((m: any) => m.score >= 80)) {
                candidate.status = "screening";
              }
              saveCandidate(candidate);
            }
          } catch {}
        }
      }

      results.push({ id: candidateIds[i], name: candidate.name, success: true });
    } catch (err) {
      results.push({ id: candidateIds[i], name: "未知", success: false, error: err instanceof Error ? err.message : "分析失败" });
    }

    // Update progress
    saveTask({
      id: taskId, type: "batch_analyze", status: "processing",
      input: { candidateIds }, result: { results },
      progress: Math.round(((i + 1) / candidateIds.length) * 100),
      createdAt: new Date(),
    });
  }

  // Mark complete
  saveTask({
    id: taskId, type: "batch_analyze", status: "completed",
    input: { candidateIds }, result: { results },
    progress: 100, createdAt: new Date(), completedAt: new Date(),
  });

  // Send Feishu notification
  try {
    const { sendFeishuNotification } = await import("@/lib/notify");
    const successCount = results.filter((r) => r.success).length;
    await sendFeishuNotification(
      "批量简历分析完成",
      `共分析 **${candidateIds.length}** 份简历\n成功: ${successCount} / 失败: ${candidateIds.length - successCount}`,
      successCount === candidateIds.length ? "green" : "orange"
    );
  } catch {}
}
