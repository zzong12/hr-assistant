import type { CommunicationTemplate } from "@/lib/types";

// ==================== Communication Templates ====================

export const COMMUNICATION_TEMPLATES: Record<
  string,
  Omit<CommunicationTemplate, "id" | "createdAt" | "updatedAt">
> = {
  interview_invitation: {
    name: "面试邀约",
    category: "interview_invitation",
    subject: "面试邀请 - {{companyName}} - {{position}}",
    content: `尊敬的{{candidateName}}：

感谢您对{{companyName}}的{{position}}职位表现出兴趣！

经过对您的简历的初步评估，我们很高兴地邀请您参加面试。以下是面试的详细信息：

面试时间：{{interviewDate}} {{interviewTime}}
面试地点：{{interviewLocation}} / 线上面试链接：{{interviewLink}}
面试官：{{interviewer}}
预计时长：{{duration}}分钟

面试内容将包括：
- 专业技能交流
- 项目经验讨论
- 团队文化介绍
- 薪资期望沟通

请提前10分钟到达面试地点或准备好面试设备。如有任何问题或需要调整时间，请及时与我们联系。

期待与您的交流！

此致
敬礼

{{hrName}}
HR | {{companyName}}
{{contactPhone}}
{{email}}`,
    variables: [
      "candidateName",
      "companyName",
      "position",
      "interviewDate",
      "interviewTime",
      "interviewLocation",
      "interviewLink",
      "interviewer",
      "duration",
      "hrName",
      "contactPhone",
      "email",
    ],
  },

  interview_feedback_positive: {
    name: "面试通过-后续安排",
    category: "interview_feedback",
    subject: "面试结果通知 - {{position}} - {{companyName}}",
    content: `尊敬的{{candidateName}}：

您好！

很高兴地通知您，您在{{position}}职位的面试中表现出色，我们希望能继续推进招聘流程。

面试反馈：
- 专业技能：{{skillsFeedback}}
- 项目经验：{{projectFeedback}}
- 综合素质：{{overallFeedback}}

接下来的安排：
{{nextSteps}}

预计将于{{timeline}}内完成最终评估。

如有任何问题，欢迎随时与我们联系。

再次感谢您对{{companyName}}的关注！

此致
敬礼

{{hrName}}
HR | {{companyName}}`,
    variables: [
      "candidateName",
      "position",
      "companyName",
      "skillsFeedback",
      "projectFeedback",
      "overallFeedback",
      "nextSteps",
      "timeline",
      "hrName",
    ],
  },

  interview_feedback_negative: {
    name: "面试未通过",
    category: "interview_feedback",
    subject: "感谢您的参与 - {{position}} - {{companyName}}",
    content: `尊敬的{{candidateName}}：

您好！

感谢您抽出时间参加{{companyName}}的{{position}}职位面试。

经过综合评估，我们很遗憾地通知您，本次面试未能通过。这是一个艰难的决定，因为我们看到了您的诸多优点。

未能通过的主要原因：
{{reasons}}

您的简历将保留在我们的人才库中，未来有合适的职位时，我们会优先考虑。

感谢您对{{companyName}}的关注和认可，祝您职业发展顺利！

此致
敬礼

{{hrName}}
HR | {{companyName}}`,
    variables: ["candidateName", "position", "companyName", "reasons", "hrName"],
  },

  offer_letter: {
    name: "Offer发放",
    category: "offer",
    subject: "Offer Letter - {{position}} - {{companyName}}",
    content: `尊敬的{{candidateName}}：

恭喜您！

我们非常高兴地邀请您加入{{companyName}}，担任{{position}}一职。

职位详情：
- 所属部门：{{department}}
- 工作地点：{{location}}
- 入职日期：{{startDate}}

薪资福利：
- 基本工资：{{salary}}元/月
- 绩效奖金：{{bonus}}元/月（根据绩效考核）
- 年终奖金：{{annualBonus}}个月工资
- 社保公积金：按国家标准缴纳
- 其他福利：{{benefits}}

入职所需材料：
1. 身份证原件及复印件
2. 学历学位证书原件及复印件
3. 离职证明（如有）
4. 银行卡信息
5. 体检报告（近3个月内）

请于{{responseDeadline}}前确认是否接受此Offer。如有任何问题，请随时联系。

期待您的加入！

此致
敬礼

{{hrName}}
HR | {{companyName}}
{{contactPhone}}
{{email}}`,
    variables: [
      "candidateName",
      "companyName",
      "position",
      "department",
      "location",
      "startDate",
      "salary",
      "bonus",
      "annualBonus",
      "benefits",
      "responseDeadline",
      "hrName",
      "contactPhone",
      "email",
    ],
  },

  salary_negotiation: {
    name: "薪资谈判",
    category: "salary_negotiation",
    subject: "关于{{position}}职位的薪资沟通 - {{companyName}}",
    content: `尊敬的{{candidateName}}：

您好！

关于您提出的薪资期望{{expectedSalary}}，我们非常重视您的想法。

经过内部讨论和评估，我们可以提供的薪资方案为：
- 基本工资：{{offerSalary}}元/月
- 绩效奖金：{{bonus}}元/月
- 年终奖金：{{annualBonus}}个月工资
- 股票期权：{{stockOptions}}

此外，我们还提供：
- 弹性工作时间
- 远程工作选项
- 培训发展预算
- 年度体检
- 团队建设活动

虽然基本工资与期望有差距，但我们相信综合考虑福利待遇和发展空间，这是一个有竞争力的整体package。

我们真诚希望您能加入我们的团队。期待您的回复！

此致
敬礼

{{hrName}}
HR | {{companyName}}`,
    variables: [
      "candidateName",
      "position",
      "companyName",
      "expectedSalary",
      "offerSalary",
      "bonus",
      "annualBonus",
      "stockOptions",
      "hrName",
    ],
  },

  rejection_letter: {
    name: "拒绝信",
    category: "rejection",
    subject: "关于您的求职申请 - {{position}} - {{companyName}}",
    content: `尊敬的{{candidateName}}：

您好！

感谢您对{{companyName}}的{{position}}职位表示兴趣并投递简历。

经过仔细评估，我们很遗憾地通知您，您的资历与当前职位的需求匹配度不够高，因此无法进入下一轮面试。

这是一个艰难的决定，因为我们需要在众多优秀候选人中做出选择。

您的简历已录入我们的人才库，未来有合适的职位时，我们会优先考虑。

感谢您对{{companyName}}的关注，祝您早日找到理想的工作！

此致
敬礼

{{hrName}}
HR | {{companyName}}`,
    variables: ["candidateName", "position", "companyName", "hrName"],
  },

  follow_up: {
    name: "跟进沟通",
    category: "follow_up",
    subject: "跟进沟通 - {{position}} - {{companyName}}",
    content: `尊敬的{{candidateName}}：

您好！

距离我们上次沟通已经过去{{daysSinceContact}}天了，想跟进一下您的想法。

关于{{position}}职位，我们：
{{previousDiscussion}}

如果您有任何疑问或需要更多考虑时间，请随时告诉我们。

我们非常重视加入{{companyName}}的机会，期待您的回复。

此致
敬礼

{{hrName}}
HR | {{companyName}}
{{contactPhone}}`,
    variables: [
      "candidateName",
      "position",
      "companyName",
      "daysSinceContact",
      "previousDiscussion",
      "hrName",
      "contactPhone",
    ],
  },
};

// ==================== Template Functions ====================

/**
 * Get template by category
 */
export function getTemplateByCategory(
  category: string
): CommunicationTemplate | null {
  const templateKey = Object.keys(COMMUNICATION_TEMPLATES).find(
    (key) => COMMUNICATION_TEMPLATES[key].category === category
  );

  if (!templateKey) return null;

  const template = COMMUNICATION_TEMPLATES[templateKey];

  return {
    id: templateKey,
    ...template,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Get all templates
 */
export function getAllTemplates(): CommunicationTemplate[] {
  return Object.entries(COMMUNICATION_TEMPLATES).map(([id, template]) => ({
    id,
    ...template,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
}

/**
 * Fill template with variables
 */
export function fillTemplate(
  template: CommunicationTemplate,
  variables: Record<string, string>
): { subject?: string; content: string } {
  let content = template.content;
  let subject = template.subject;

  // Replace variables in content
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    content = content.replace(new RegExp(placeholder, "g"), value);
    if (subject) {
      subject = subject.replace(new RegExp(placeholder, "g"), value);
    }
  }

  return { subject, content };
}

/**
 * Generate communication message using AI
 */
export async function generateCommunicationMessage(
  scenario: string,
  context: Record<string, any>
): Promise<string> {
  // Build prompt for AI
  const prompt = `请根据以下场景生成专业的HR沟通话术：

场景：${scenario}
上下文信息：
${Object.entries(context)
  .map(([key, value]) => `${key}: ${value}`)
  .join("\n")}

要求：
1. 语气专业、友好、得体
2. 内容清晰、完整
3. 符合HR沟通规范
4. 中文表达
5. 可以适当加入emoji使语气更亲和

请直接生成沟通内容，不需要额外说明。`;

  // This would call the agent, but for now return a placeholder
  return `[AI生成的${scenario}话术将在这里显示]
场景：${scenario}
上下文已接收，正在生成专业话术...]`;
}

/**
 * Get tone adjustment suggestions
 */
export function getToneAdjustments(): Array<{
  tone: string;
  description: string;
  examples: string[];
}> {
  return [
    {
      tone: "正式",
      description: "用于正式场合、首次沟通、Offer等",
      examples: ["您好", "敬请", "此致敬礼", "谨此"],
    },
    {
      tone: "亲切",
      description: "用于后续沟通、关系较熟络时",
      examples: ["你好", "很高兴", "期待", "加油"],
    },
    {
      tone: "直接",
      description: "用于时间紧张、需要快速决策时",
      examples: ["请于", "需要", "务必", "谢谢"],
    },
  ];
}
