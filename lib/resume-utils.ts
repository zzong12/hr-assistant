import type { Candidate, ParsedResumeData, WorkExperience, Education } from "@/lib/types";

// ==================== Resume Parsing Functions ====================

/**
 * Parse resume from file content
 */
export async function parseResume(
  filename: string,
  content: string,
  filetype: "pdf" | "text" | "docx"
): Promise<ParsedResumeData | null> {
  try {
    let text = content;

    // For PDF, content should already be extracted text
    // For text, use as-is
    // For docx, content should already be extracted text

    // Parse sections from text
    const parsed: ParsedResumeData = {
      experience: extractExperience(text),
      education: extractEducation(text),
      skills: extractSkills(text),
      summary: extractSummary(text),
    };

    return parsed;
  } catch (error) {
    console.error("Error parsing resume:", error);
    return null;
  }
}

/**
 * Extract work experience from resume text
 */
function extractExperience(text: string): WorkExperience[] {
  const experience: WorkExperience[] = [];

  // Look for experience section
  const experienceSection = extractSection(text, [
    "工作经历",
    "工作经验",
    "经历",
    "Experience",
    "Work Experience",
  ]);

  if (!experienceSection) return experience;

  // Split by common delimiters
  const entries = experienceSection.split(/\n\n+/);

  for (const entry of entries) {
    const lines = entry.split("\n").filter((l) => l.trim());

    if (lines.length < 2) continue;

    // Try to extract company and position
    const firstLine = lines[0];
    const companyMatch = firstLine.match(/(.+?)\s+(?:公司|有限公司|Inc|Ltd|Corp)/);
    const company = companyMatch ? companyMatch[0] : firstLine.split(/\s+/)[0];

    // Position is usually in first or second line
    const position = lines[0].replace(company, "").trim() || lines[1]?.trim() || "";

    // Duration - look for date patterns
    const durationMatch = entry.match(
      /(\d{4}|\d{1,2})[\.\-/年](\d{1,2}|)[\.\-/月]?\s*[~-至]\s*(\d{4}|\d{1,2}|至今)[\.\-/年]?(\d{1,2}|)[月]?/
    );
    const duration = durationMatch ? durationMatch[0] : "";

    // Description is the rest
    const description = lines.slice(1).join("\n").trim();

    if (company || position) {
      experience.push({
        company: company || "未知公司",
        position: position || "未知职位",
        duration: duration || "未注明",
        description,
      });
    }
  }

  return experience;
}

/**
 * Extract education from resume text
 */
function extractEducation(text: string): Education[] {
  const education: Education[] = [];

  const educationSection = extractSection(text, [
    "教育经历",
    "学历",
    "教育背景",
    "Education",
  ]);

  if (!educationSection) return education;

  const entries = educationSection.split(/\n\n+/);

  for (const entry of entries) {
    const lines = entry.split("\n").filter((l) => l.trim());

    if (lines.length === 0) continue;

    // School is usually first
    const school = lines[0].trim();

    // Degree and major
    let degree = "";
    let major = "";

    for (const line of lines) {
      if (line.includes("博士") || line.includes("硕士") || line.includes("本科")) {
        degree = line.match(/博士|硕士|本科|大专|高中/)?.[0] || "";
      }
      if (line.includes("专业") || line.includes("主修")) {
        major = line.replace(/专业|主修|:/g, "").trim();
      }
    }

    if (school) {
      education.push({
        school,
        degree: degree || "未注明",
        major: major || "未注明",
      });
    }
  }

  return education;
}

/**
 * Extract skills from resume text
 */
function extractSkills(text: string): string[] {
  const skills: string[] = [];

  // Common skill keywords
  const skillKeywords = [
    "JavaScript",
    "TypeScript",
    "Python",
    "Java",
    "React",
    "Vue",
    "Angular",
    "Node.js",
    "HTML",
    "CSS",
    "SQL",
    "MongoDB",
    "Redis",
    "Docker",
    "Kubernetes",
    "AWS",
    "Azure",
    "GCP",
    "Git",
    "Agile",
    "Scrum",
    "产品经理",
    "项目管理",
    "UI设计",
    "UX设计",
    "Figma",
    "Sketch",
    "数据分析",
    "机器学习",
    "深度学习",
  ];

  // Look for skills section
  const skillsSection = extractSection(text, [
    "技能",
    "专业技能",
    "技术栈",
    "Skills",
  ]);

  const textToSearch = skillsSection || text;

  // Find matching skills
  for (const skill of skillKeywords) {
    if (textToSearch.toLowerCase().includes(skill.toLowerCase())) {
      skills.push(skill);
    }
  }

  return [...new Set(skills)]; // Remove duplicates
}

/**
 * Extract summary from resume text
 */
function extractSummary(text: string): string | undefined {
  const summarySection = extractSection(text, [
    "个人简介",
    "自我评价",
    "简介",
    "Summary",
    "Profile",
  ]);

  return summarySection || undefined;
}

/**
 * Extract a section from resume text
 */
function extractSection(text: string, keywords: string[]): string | null {
  for (const keyword of keywords) {
    const regex = new RegExp(
      `${keyword}[\\s\\S]*?((?=\\n[\\u4e00-\\u9fa5a-zA-Z]{2,}[\\s\\S]*?)|$)`,
      "i"
    );
    const match = text.match(regex);
    if (match) {
      let section = match[0].replace(new RegExp(`${keyword}`, "i"), "").trim();
      // Remove next section header
      section = section.split(/\n[\\u4e00-\\u9fa5a-zA-Z]{2,}/)[0];
      return section.trim();
    }
  }
  return null;
}

// ==================== Candidate Matching ====================

/**
 * Calculate match score between candidate and job
 */
export function calculateMatchScore(
  candidateSkills: string[],
  jobSkills: string[],
  candidateExperience: WorkExperience[],
  jobRequirements: string[]
): number {
  let score = 0;

  // Skill match (40% weight)
  const skillScore = calculateSkillMatch(candidateSkills, jobSkills);
  score += skillScore * 0.4;

  // Experience relevance (30% weight)
  const experienceScore = calculateExperienceRelevance(
    candidateExperience,
    jobRequirements
  );
  score += experienceScore * 0.3;

  // Base score for having any relevant experience (30% weight)
  const baseScore = candidateExperience.length > 0 ? 30 : 0;
  score += baseScore * 0.3;

  return Math.round(Math.min(score, 100));
}

/**
 * Calculate skill match percentage
 */
function calculateSkillMatch(
  candidateSkills: string[],
  jobSkills: string[]
): number {
  if (jobSkills.length === 0) return 50;

  const matchingSkills = jobSkills.filter((jobSkill) =>
    candidateSkills.some(
      (candidateSkill) =>
        candidateSkill.toLowerCase() === jobSkill.toLowerCase()
    )
  );

  return (matchingSkills.length / jobSkills.length) * 100;
}

/**
 * Calculate experience relevance
 */
function calculateExperienceRelevance(
  experience: WorkExperience[],
  requirements: string[]
): number {
  if (requirements.length === 0) return 50;

  let relevanceCount = 0;

  for (const req of requirements) {
    const lowerReq = req.toLowerCase();

    // Check if any experience matches the requirement
    const matches = experience.some((exp) => {
      const expText = `${exp.position} ${exp.description}`.toLowerCase();
      return expText.includes(lowerReq) || lowerReq.includes(expText);
    });

    if (matches) relevanceCount++;
  }

  return (relevanceCount / requirements.length) * 100;
}

/**
 * Generate match reason
 */
export function generateMatchReason(
  candidate: Candidate,
  jobSkills: string[],
  score: number
): string[] {
  const reasons: string[] = [];

  if (score >= 80) {
    reasons.push("技能匹配度高，符合大部分岗位要求");
  } else if (score >= 60) {
    reasons.push("基本符合岗位要求，部分技能需要补充");
  } else {
    reasons.push("技能匹配度较低，建议进一步评估");
  }

  // Skill highlights
  const matchingSkills = candidate.resume.parsedData?.skills?.filter((skill) =>
    jobSkills.some((js) => js.toLowerCase() === skill.toLowerCase())
  );

  if (matchingSkills && matchingSkills.length > 0) {
    reasons.push(`掌握关键技能: ${matchingSkills.join("、")}`);
  }

  // Experience highlights
  if (candidate.resume.parsedData?.experience) {
    const expCount = candidate.resume.parsedData.experience.length;
    if (expCount > 0) {
      reasons.push(`有${expCount}段相关工作经历`);
    }
  }

  return reasons;
}
