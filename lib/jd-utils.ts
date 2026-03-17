import type { Job, JobDescription } from "@/lib/types";

// ==================== JD Templates ====================

export interface JDTemplate {
  title: string;
  level: string;
  department: string;
  overview: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
}

export const JD_TEMPLATES: Record<string, JDTemplate> = {
  "frontend-engineer": {
    title: "前端工程师",
    level: "mid",
    department: "技术部",
    overview: "我们正在寻找一位经验丰富的前端工程师，负责开发和维护高质量的用户界面，提供卓越的用户体验。",
    responsibilities: [
      "使用React/Next.js开发和维护Web应用",
      "与产品设计师和后端工程师紧密合作",
      "优化前端性能，确保快速加载",
      "编写可维护、可测试的代码",
      "参与代码审查和技术方案讨论",
      "解决复杂的前端技术问题",
    ],
    requirements: [
      "3年以上前端开发经验",
      "精通React、TypeScript、现代JavaScript",
      "熟悉Next.js或类似框架",
      "良好的UI/UX意识",
      "熟悉前端工程化和性能优化",
      "良好的沟通和团队协作能力",
    ],
    benefits: [
      "有竞争力的薪资和股权",
      "灵活的工作时间和远程工作选项",
      "持续学习和成长的机会",
      "优秀的技术团队和工作环境",
    ],
  },
  "backend-engineer": {
    title: "后端工程师",
    level: "mid",
    department: "技术部",
    overview: "我们正在寻找一位技术精湛的后端工程师，负责构建高性能、可扩展的服务端应用。",
    responsibilities: [
      "设计和开发RESTful API和微服务",
      "优化数据库查询和系统性能",
      "参与系统架构设计和技术选型",
      "编写自动化测试和单元测试",
      "解决复杂的后端技术问题",
      "与前端团队协作，集成API",
    ],
    requirements: [
      "3年以上后端开发经验",
      "精通Node.js、Python或Java",
      "熟悉SQL和NoSQL数据库",
      "了解分布式系统和微服务架构",
      "良好的代码规范和工程实践",
      "有API设计经验",
    ],
    benefits: [
      "有竞争力的薪资",
      "技术分享和学习氛围",
      "参与开源项目的机会",
      "完善的技术栈和工具链",
    ],
  },
  "product-manager": {
    title: "产品经理",
    level: "mid",
    department: "产品部",
    overview: "我们正在寻找一位富有洞察力的产品经理，负责产品的规划、设计和迭代。",
    responsibilities: [
      "制定产品路线图和优先级",
      "进行用户研究和需求分析",
      "撰写产品需求文档(PRD)",
      "与设计和开发团队紧密合作",
      "跟踪产品数据，进行数据分析",
      "收集用户反馈，持续优化产品",
    ],
    requirements: [
      "3年以上产品管理经验",
      "良好的逻辑思维和数据分析能力",
      "优秀的沟通和协调能力",
      "熟悉产品设计工具(如Figma)",
      "有B端或C端产品经验",
      "较强的学习能力",
    ],
    benefits: [
      "具有竞争力的薪资",
      "参与产品全生命周期的机会",
      "与优秀团队共事",
      "职业发展空间大",
    ],
  },
};

// ==================== Skill Database ====================

export const SKILL_DATABASE = {
  frontend: [
    "React",
    "Vue",
    "Angular",
    "TypeScript",
    "JavaScript",
    "HTML/CSS",
    "Next.js",
    "Tailwind CSS",
    "Webpack",
    "Vite",
  ],
  backend: [
    "Node.js",
    "Python",
    "Java",
    "Go",
    "PostgreSQL",
    "MongoDB",
    "Redis",
    "Docker",
    "Kubernetes",
    "REST API",
    "GraphQL",
  ],
  product: [
    "产品规划",
    "需求分析",
    "用户研究",
    "数据分析",
    "原型设计",
    "项目管理",
    "Axure",
    "Figma",
    "SQL",
  ],
  design: [
    "UI设计",
    "UX设计",
    "Figma",
    "Sketch",
    "Adobe XD",
    "Photoshop",
    "Illustrator",
    "交互设计",
    "视觉设计",
  ],
};

// ==================== JD Generation Functions ====================

/**
 * Generate JD from template and custom requirements
 */
export function generateJD(params: {
  title: string;
  level: string;
  department: string;
  customRequirements?: string[];
  customResponsibilities?: string[];
  skills?: string[];
}): JobDescription {
  // Try to find matching template
  const templateKey = Object.keys(JD_TEMPLATES).find((key) =>
    params.title.includes(JD_TEMPLATES[key].title)
  );

  const template = templateKey ? JD_TEMPLATES[templateKey] : null;

  // Build description
  const description: JobDescription = {
    overview:
      template?.overview ||
      `我们正在寻找一位${params.title}，加入我们的${params.department}团队。`,
    responsibilities: params.customResponsibilities || template?.responsibilities || [
      "负责相关工作的执行和落地",
      "与团队协作完成项目目标",
      "持续优化和改进工作流程",
    ],
    requirements: params.customRequirements || template?.requirements || [
      "相关领域的工作经验",
      "良好的沟通能力",
      "团队协作精神",
      "学习能力强",
    ],
    benefits: template?.benefits || [
      "有竞争力的薪资",
      "良好的工作环境",
      "职业发展机会",
    ],
  };

  // Add skills to requirements if provided
  if (params.skills && params.skills.length > 0) {
    description.requirements.push(
      `熟练掌握: ${params.skills.join("、")}`
    );
  }

  return description;
}

/**
 * Parse JD from text
 */
export function parseJDFromText(text: string): Partial<Job> | null {
  try {
    // Simple parsing - in production, use AI or more sophisticated parsing
    const lines = text.split("\n").filter((line) => line.trim());

    const job: Partial<Job> = {
      title: "",
      level: "mid",
      department: "",
      description: {
        overview: "",
        responsibilities: [],
        requirements: [],
        benefits: [],
      },
      skills: [],
    };

    let currentSection: "overview" | "responsibilities" | "requirements" | "benefits" | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Detect sections
      if (trimmed.includes("职位概述") || trimmed.includes("概述")) {
        currentSection = "overview";
        continue;
      }
      if (trimmed.includes("岗位职责") || trimmed.includes("职责")) {
        currentSection = "responsibilities";
        continue;
      }
      if (trimmed.includes("任职要求") || trimmed.includes("要求")) {
        currentSection = "requirements";
        continue;
      }
      if (trimmed.includes("福利待遇") || trimmed.includes("福利")) {
        currentSection = "benefits";
        continue;
      }

      // Add to appropriate section
      if (currentSection && job.description) {
        if (currentSection === "overview") {
          job.description.overview = trimmed;
        } else if (currentSection === "responsibilities") {
          job.description.responsibilities.push(trimmed);
        } else if (currentSection === "requirements") {
          job.description.requirements.push(trimmed);
        } else if (currentSection === "benefits") {
          job.description.benefits.push(trimmed);
        }
      }
    }

    return job;
  } catch (error) {
    console.error("Error parsing JD:", error);
    return null;
  }
}

/**
 * Format JD as markdown
 */
export function formatJDAsMarkdown(job: Job): string {
  const md = `# ${job.title}

**级别**: ${job.level}
**部门**: ${job.department}
**状态**: ${job.status === "active" ? "招聘中" : job.status === "draft" ? "草稿" : "已关闭"}

## 职位概述

${job.description.overview}

## 岗位职责

${job.description.responsibilities.map((r) => `- ${r}`).join("\n")}

## 任职要求

${job.description.requirements.map((r) => `- ${r}`).join("\n")}

## 福利待遇

${job.description.benefits.map((b) => `- ${b}`).join("\n")}

${job.skills?.length ? `## 技能要求\n\n${job.skills.map((s) => `- ${s}`).join("\n")}` : ""}

${job.salary ? `## 薪资范围\n\n${job.salary.min} - ${job.salary.max} ${job.salary.currency}` : ""}
`;

  return md;
}
