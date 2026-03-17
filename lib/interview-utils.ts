import type { Interview, InterviewQuestion, Job, Candidate } from "@/lib/types";

// ==================== Interview Question Bank ====================

export interface QuestionTemplate {
  category: string;
  questions: string[];
}

export const INTERVIEW_QUESTION_BANK: Record<string, QuestionTemplate> = {
  technical: {
    category: "技术能力",
    questions: [
      "请描述一下你最引以为豪的技术项目，你在其中扮演了什么角色？",
      "你是如何解决遇到的最具挑战性的技术问题的？",
      "请解释一下你最熟悉的技术的原理和最佳实践",
      "你是如何保证代码质量的？",
      "你是进行技术选型的？考虑哪些因素？",
      "你如何处理性能优化问题？",
      "你是如何进行代码审查的？",
      "请描述一下你的开发流程和使用的工具",
    ],
  },
  project: {
    category: "项目经验",
    questions: [
      "请详细介绍一个你参与过的项目，你的职责是什么？",
      "在项目中遇到过哪些困难？你是如何解决的？",
      "你是如何与团队成员协作的？",
      "项目中最有成就感的事情是什么？",
      "如果让你重新做这个项目，你会做哪些改进？",
      "你是如何管理项目进度和风险的？",
    ],
  },
  behavioral: {
    category: "行为面试",
    questions: [
      "请描述一次你与团队成员有分歧的经历，你是如何处理的？",
      "你是如何处理工作压力和紧急任务的？",
      "请举例说明你是如何学习新技术的",
      "你为什么想要加入我们公司？",
      "你未来3-5年的职业规划是什么？",
      "你认为自己最大的优点和缺点是什么？",
      "你是如何处理失败的项目的？",
    ],
  },
  culture: {
    category: "文化匹配",
    questions: [
      "你理想的工作环境是什么样的？",
      "你是如何看待团队合作的？",
      "你对加班和弹性工作制的看法是什么？",
      "你希望从公司获得什么？",
      "你如何处理工作与生活的平衡？",
      "你认为什么样的团队文化是高效的？",
    ],
  },
  frontend: {
    category: "前端专业",
    questions: [
      "React的生命周期方法和hooks有什么区别？",
      "你是如何优化React应用性能的？",
      "请解释一下JavaScript的事件循环机制",
      "你是如何管理应用状态的？",
      "请描述一下你使用过的前端工程化工具",
      "你是如何处理跨浏览器兼容性问题的？",
      "请解释一下CSS盒模型和布局方式",
    ],
  },
  backend: {
    category: "后端专业",
    questions: [
      "请解释一下RESTful API的设计原则",
      "你是如何设计数据库schema的？",
      "请描述一下你使用过的缓存策略",
      "你是如何处理并发和线程安全的？",
      "请解释一下微服务架构的优缺点",
      "你是如何保证API安全性的？",
    ],
  },
  product: {
    category: "产品专业",
    questions: [
      "你是如何进行用户需求分析的？",
      "请描述一下你的产品设计流程",
      "你是如何进行产品优先级排序的？",
      "你如何衡量产品成功的？",
      "请描述一次你成功的产品迭代经历",
      "你是如何平衡用户需求和商业目标的？",
    ],
  },
};

// ==================== Interview Generation Functions ====================

/**
 * Generate interview questions based on job and candidate
 */
export function generateInterviewQuestions(
  job: Job,
  candidate: Candidate,
  count: number = 8
): InterviewQuestion[] {
  const questions: InterviewQuestion[] = [];

  // Determine question categories based on job type
  const categories = determineQuestionCategories(job);

  // Select questions from each category
  let totalSelected = 0;
  const questionsPerCategory = Math.ceil(count / categories.length);

  for (const category of categories) {
    const template = INTERVIEW_QUESTION_BANK[category];
    if (template) {
      const availableQuestions = template.questions.filter((q) =>
        !questions.some((selected) => selected.question === q)
      );

      const selected = availableQuestions
        .slice(0, questionsPerCategory)
        .map((question) => ({
          question,
          category: template.category,
        }));

      questions.push(...selected);
      totalSelected += selected.length;

      if (totalSelected >= count) break;
    }
  }

  return questions.slice(0, count);
}

/**
 * Determine question categories based on job
 */
function determineQuestionCategories(job: Job): string[] {
  const categories: string[] = ["behavioral", "culture"];

  // Add technical questions based on department
  if (job.department.includes("技术") || job.department.includes("研发")) {
    if (job.title.includes("前端") || job.skills?.some((s) => s.includes("React") || s.includes("Vue"))) {
      categories.push("frontend");
    } else if (job.title.includes("后端") || job.skills?.some((s) => s.includes("Node") || s.includes("Java"))) {
      categories.push("backend");
    } else {
      categories.push("technical");
    }
  }

  if (job.department.includes("产品")) {
    categories.push("product");
  }

  // Add project experience questions
  categories.push("project");

  return categories;
}

/**
 * Generate interview schedule suggestion
 */
export function generateInterviewSchedule(
  job: Job,
  candidate: Candidate,
  preferredDate?: Date
): { suggestedTimes: Date[]; duration: number; notes: string } {
  const now = preferredDate || new Date();
  const suggestedTimes: Date[] = [];
  const duration = 60; // 60 minutes default

  // Generate time slots for next 5 business days
  let date = new Date(now);
  let daysChecked = 0;

  while (daysChecked < 10 && suggestedTimes.length < 5) {
    date.setDate(date.getDate() + 1);

    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) {
      continue;
    }

    daysChecked++;

    // Add time slots: 10:00, 14:00, 16:00
    const slots = [10, 14, 16];
    for (const hour of slots) {
      const slotDate = new Date(date);
      slotDate.setHours(hour, 0, 0, 0);

      // Only add future slots
      if (slotDate > now) {
        suggestedTimes.push(slotDate);
      }
    }
  }

  return {
    suggestedTimes,
    duration,
    notes: `面试时间约${duration}分钟，建议提前准备好简历和作品集。面试官：${job.department}负责人`,
  };
}

/**
 * Generate interview evaluation template
 */
export function generateEvaluationTemplate(interview: Interview): string {
  const template = `# 面试评估表

**候选人**: ${interview.candidateId}
**职位**: ${interview.jobId}
**面试时间**: ${new Date(interview.scheduledTime).toLocaleString()}
**面试地点**: ${interview.location}
**面试官**: ${interview.interviewer}

## 评分标准

请对以下维度进行评分（1-10分）：

### 技术能力
- [ ] 专业知识深度
- [ ] 技术广度
- [ ] 解决问题能力
- [ ] 代码质量/工程实践

**技术得分**: _____ / 40

### 沟通表达
- [ ] 表达清晰度
- [ ] 逻辑思维
- [ ] 互动能力
- [ ] 团队协作意识

**沟通得分**: _____ / 40

### 综合素质
- [ ] 学习能力
- [ ] 文化匹配度
- [ ] 职业规划
- [ ] 工作态度

**综合素质得分**: _____ / 20

## 总分
**总分**: _____ / 100

## 面试记录

### 回答情况记录
${interview.questions.map((q, i) => `${i + 1}. **${q.category}**: ${q.question}\n\n回答记录:\n\n`).join("\n")}

### 综合评价
请简要描述候选人的整体表现：



### 推荐意见
- [ ] 通过 - 进入下一轮
- [ ] 待定 - 需要进一步评估
- [ ] 不通过 - 不适合该职位

**推荐理由**:



**面试官签名**: _______________
**日期**: _______________
`;

  return template;
}

// ==================== Interview Helper Functions ====================

/**
 * Check if interview time conflicts with existing interviews
 */
export function checkTimeConflict(
  newInterview: Interview,
  existingInterviews: Interview[]
): boolean {
  const newStart = new Date(newInterview.scheduledTime);
  const newEnd = new Date(newStart.getTime() + 60 * 60 * 1000); // Assume 1 hour

  return existingInterviews.some((interview) => {
    if (interview.id === newInterview.id || interview.status === "cancelled") {
      return false;
    }

    const existingStart = new Date(interview.scheduledTime);
    const existingEnd = new Date(existingStart.getTime() + 60 * 60 * 1000);

    return (
      (newStart >= existingStart && newStart < existingEnd) ||
      (newEnd > existingStart && newEnd <= existingEnd) ||
      (newStart <= existingStart && newEnd >= existingEnd)
    );
  });
}

/**
 * Format interview as calendar event
 */
export function formatAsCalendarEvent(interview: Interview): string {
  const startDate = new Date(interview.scheduledTime);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//HR Assistant//Interview Calendar//CN
BEGIN:VEVENT
DTSTART:${formatDateForICal(startDate)}
DTEND:${formatDateForICal(endDate)}
SUMMARY:面试 - ${interview.candidateId}
DESCRIPTION:面试职位: ${interview.jobId}\\n面试地点: ${interview.location}\\n面试官: ${interview.interviewer}
LOCATION:${interview.location}
END:VEVENT
END:VCALENDAR`;
}

function formatDateForICal(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}
