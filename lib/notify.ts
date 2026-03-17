import { loadSetting } from "@/lib/storage";

interface FeishuCardMessage {
  msg_type: "interactive";
  card: {
    header: { title: { tag: string; content: string }; template?: string };
    elements: Array<{ tag: string; text?: { tag: string; content: string }; actions?: any[] }>;
  };
}

export async function sendFeishuNotification(
  title: string,
  content: string,
  color: "blue" | "green" | "red" | "orange" = "blue"
): Promise<boolean> {
  const webhookUrl = process.env.FEISHU_WEBHOOK_URL || loadSetting("feishu_webhook_url");
  if (!webhookUrl) return false;

  const enabled = loadSetting("feishu_notify_enabled");
  if (enabled === "false") return false;

  const templateMap = { blue: "blue", green: "green", red: "red", orange: "orange" };

  const message: FeishuCardMessage = {
    msg_type: "interactive",
    card: {
      header: {
        title: { tag: "plain_text", content: `[HR数字助手] ${title}` },
        template: templateMap[color],
      },
      elements: [
        { tag: "div", text: { tag: "lark_md", content } },
      ],
    },
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
    return res.ok;
  } catch (error) {
    console.error("[Feishu] Notification failed:", error);
    return false;
  }
}

export async function notifyResumeAnalyzed(candidateName: string, topMatch?: { jobTitle: string; score: number }) {
  const matchInfo = topMatch
    ? `\n**最佳匹配**: ${topMatch.jobTitle} (${topMatch.score}分)`
    : "\n暂无匹配职位";
  return sendFeishuNotification(
    "简历分析完成",
    `**候选人**: ${candidateName}${matchInfo}`,
    topMatch && topMatch.score >= 80 ? "green" : "blue"
  );
}

export async function notifyJDGenerated(jobTitle: string, department: string) {
  return sendFeishuNotification("JD已生成", `**职位**: ${jobTitle}\n**部门**: ${department}`, "blue");
}

export async function notifyInterviewScheduled(candidateName: string, jobTitle: string, time: string) {
  return sendFeishuNotification(
    "面试已安排",
    `**候选人**: ${candidateName}\n**职位**: ${jobTitle}\n**时间**: ${time}`,
    "blue"
  );
}

export async function notifyFeedbackSubmitted(candidateName: string, recommendation: string, score: number) {
  const color = recommendation.includes("hire") && !recommendation.includes("no") ? "green" : "orange";
  const recMap: Record<string, string> = {
    strong_hire: "强烈推荐录用", hire: "推荐录用",
    no_hire: "不推荐", strong_no_hire: "强烈不推荐"
  };
  return sendFeishuNotification(
    "面试反馈已提交",
    `**候选人**: ${candidateName}\n**综合评分**: ${score}/100\n**建议**: ${recMap[recommendation] || recommendation}`,
    color
  );
}

export async function notifyStatusChanged(candidateName: string, oldStatus: string, newStatus: string) {
  const statusMap: Record<string, string> = {
    pending: "待筛选", screening: "筛选中", interview: "面试中",
    offered: "已发Offer", hired: "已录用", rejected: "已淘汰"
  };
  return sendFeishuNotification(
    "候选人状态变更",
    `**候选人**: ${candidateName}\n**变更**: ${statusMap[oldStatus] || oldStatus} → ${statusMap[newStatus] || newStatus}`,
    newStatus === "hired" ? "green" : newStatus === "rejected" ? "red" : "orange"
  );
}
