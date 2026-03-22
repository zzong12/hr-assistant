import { NextRequest, NextResponse } from "next/server";
import { formatJDAsMarkdown } from "@/lib/jd-utils";
import { getAgentManager } from "@/lib/agents";
import { generateId, saveJob, getStorageInitErrorMessage } from "@/lib/storage";
import type { Job } from "@/lib/types";

export const runtime = "nodejs";

/**
 * POST /api/jobs/generate
 * Generate a job description using AI
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, level, department, requirements, skills, save: shouldSave = false, freeText } = body;

    // New: Free text mode - AI extracts everything
    if (freeText) {
      try {
        let textToAnalyze = freeText;

        // URL detection and scraping
        const urlMatch = freeText.trim().match(/^(https?:\/\/[^\s]+)$/i);
        if (urlMatch) {
          const targetUrl = urlMatch[1];
          try {
            const res = await fetch(targetUrl, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
              },
              signal: AbortSignal.timeout(10000),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const html = await res.text();

            const cheerio = await import("cheerio");
            const $ = cheerio.load(html);
            $("script, style, nav, footer, header, iframe, noscript").remove();

            // Try common JD selectors from major platforms
            let jdText = "";
            const selectors = [
              ".job-detail", ".job-sec-text", ".job-desc", ".position-content",
              ".job-detail-section", ".job_bt", ".job-info", ".recruit-text",
              '[class*="job-detail"]', '[class*="position-detail"]',
              "article", "main", ".content",
            ];
            for (const sel of selectors) {
              const el = $(sel);
              if (el.length && el.text().trim().length > 100) {
                jdText = el.text().trim();
                break;
              }
            }
            if (!jdText) {
              jdText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 5000);
            }

            // Validate extracted content quality
            const hasJobKeywords = /职责|要求|薪资|经验|学历|技能|responsibilities|requirements|salary|experience/i.test(jdText);

            if (jdText.length < 50 || (!hasJobKeywords && jdText.length < 200)) {
              return NextResponse.json({
                needManualInput: true,
                originalUrl: targetUrl,
                suggestion: "该网站使用动态加载，无法自动抓取。请按以下步骤操作：\n1. 在浏览器中打开上述链接\n2. 全选页面文字（Ctrl+A）\n3. 复制（Ctrl+C）\n4. 粘贴到输入框中",
              }, { status: 200 });
            }

            textToAnalyze = `以下是从招聘网站抓取的职位信息：\n\n${jdText.slice(0, 4000)}`;
          } catch (urlErr) {
            console.error("URL scraping error:", urlErr);
            return NextResponse.json({
              needManualInput: true,
              originalUrl: targetUrl,
              suggestion: `无法访问该网站（${urlErr instanceof Error ? urlErr.message : "网络错误"}）。请手动复制JD文本粘贴到输入框。`,
            }, { status: 200 });
          }
        }

        const agentManager = getAgentManager();
        const extractPrompt = `请从以下文本中提取职位信息，并生成完整的JD。如果文本是一句话描述，请据此生成完整职位；如果是已有的JD文本，请提取并优化。

输入文本：
${textToAnalyze}

请严格按以下JSON格式返回（只返回JSON，不要其他内容）：
{
  "title": "职位名称",
  "department": "所属部门",
  "level": "junior/mid/senior/expert",
  "skills": ["技能1", "技能2"],
  "salary": {"min": 数字, "max": 数字, "currency": "CNY"},
  "description": {
    "overview": "职位概述(2-3句话)",
    "responsibilities": ["职责1", "职责2", "...5-8条"],
    "requirements": ["要求1", "要求2", "...5-8条"],
    "benefits": ["福利1", "福利2", "...3-5条"]
  }
}

注意：
- salary的min和max是月薪，单位为K（千元），如25表示25K
- 如果文本中没有明确薪资，请根据职位级别和市场行情给出合理范围
- level如果不确定默认mid
- department如果不确定写"未指定"`;

        const response = await agentManager.processMessage(extractPrompt, []);
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          return NextResponse.json({ error: "AI解析失败，请重试" }, { status: 500 });
        }
        const parsed = JSON.parse(jsonMatch[0]);

        const job = {
          id: generateId(),
          title: parsed.title || "未命名职位",
          level: parsed.level || "mid",
          department: parsed.department || "未指定",
          skills: parsed.skills || [],
          salary: parsed.salary || undefined,
          description: {
            overview: parsed.description?.overview || "",
            responsibilities: parsed.description?.responsibilities || [],
            requirements: parsed.description?.requirements || [],
            benefits: parsed.description?.benefits || [],
          },
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (shouldSave) {
          const { saveJob } = await import("@/lib/storage");
          const saved = saveJob(job as any);
          if (!saved) {
            const storageError = getStorageInitErrorMessage();
            return NextResponse.json(
              { error: storageError || "职位保存失败，请检查存储服务" },
              { status: 500 }
            );
          }

          // Send Feishu notification
          try {
            const { notifyJDGenerated } = await import("@/lib/notify");
            await notifyJDGenerated(job.title, job.department);
          } catch {}
        }

        return NextResponse.json({ job, raw: response.content });
      } catch (error) {
        console.error("Free text generation error:", error);
        const errMsg = error instanceof Error ? error.message : "未知错误";
        return NextResponse.json({ error: `JD生成失败: ${errMsg}` }, { status: 500 });
      }
    }

    // Validate required fields
    if (!title || !department) {
      return NextResponse.json(
        { error: "Missing required fields: title, department" },
        { status: 400 }
      );
    }

    // Build prompt for AI
    const prompt = `请为以下职位生成完整的职位描述(JD):

职位名称: ${title}
级别: ${level || "中级"}
部门: ${department}
${skills ? `技能要求: ${skills.join(", ")}` : ""}
${requirements ? `其他要求: ${requirements.join(", ")}` : ""}

请生成结构化的JD，包含:
1. 职位概述(2-3句话)
2. 岗位职责(5-8条)
3. 任职要求(5-8条)
4. 福利待遇(3-5条)

请使用清晰的格式，专业且吸引人的语言。`;

    // Get AI-generated JD
    const agentManager = getAgentManager();
    const response = await agentManager.processMessage(prompt, []);

    // Parse AI response to extract JD sections
    const aiContent = response.content;

    // Simple parsing - in production, use more sophisticated parsing
    const description = {
      overview: extractSection(aiContent, ["职位概述", "概述", "职位介绍"]) ||
        `我们正在寻找一位${title}，加入我们的${department}团队。`,
      responsibilities: extractList(aiContent, ["岗位职责", "职责", "工作内容"]) || [],
      requirements: extractList(aiContent, ["任职要求", "要求", "任职资格"]) || [],
      benefits: extractList(aiContent, ["福利待遇", "福利", "员工福利"]) || [],
    };

    // Create job object
    const job: Job = {
      id: generateId(),
      title,
      level: level || "mid",
      department,
      description,
      skills: skills || [],
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save job if requested
    if (shouldSave) {
      const saved = saveJob(job);
      if (!saved) {
        const storageError = getStorageInitErrorMessage();
        return NextResponse.json(
          { error: storageError || "职位保存失败，请检查存储服务" },
          { status: 500 }
        );
      }
    }

    // Format as markdown
    const markdown = formatJDAsMarkdown(job);

    return NextResponse.json({
      job,
      markdown,
      raw: aiContent,
    });
  } catch (error) {
    console.error("Error generating JD:", error);
    const errMsg = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json(
      { error: `JD生成失败: ${errMsg}` },
      { status: 500 }
    );
  }
}

/**
 * Extract a section text from content
 */
function extractSection(content: string, keywords: string[]): string {
  for (const keyword of keywords) {
    const regex = new RegExp(
      `(?:#{1,3}\\s*)?(?:[\\u{1F4CB}\\u{1F6E0}\\u{1F464}\\u{1F381}\\u{1F4A1}]\\s*)?${keyword}[^\\n]*\\n([\\s\\S]*?)(?=\\n#{1,3}\\s|$)`,
      "iu"
    );
    const match = content.match(regex);
    if (match && match[1]) {
      return match[1].replace(/^[\s\n]+|[\s\n]+$/g, "");
    }
  }
  return "";
}

/**
 * Extract a list from content
 */
function extractList(content: string, keywords: string[]): string[] {
  for (const keyword of keywords) {
    const regex = new RegExp(
      `(?:#{1,3}\\s*)?(?:[\\u{1F4CB}\\u{1F6E0}\\u{1F464}\\u{1F381}\\u{1F4A1}]\\s*)?${keyword}[^\\n]*\\n([\\s\\S]*?)(?=\\n#{1,3}\\s|$)`,
      "iu"
    );
    const match = content.match(regex);
    if (match && match[1]) {
      const items = match[1]
        .split("\n")
        .map((line) => line.replace(/^\s*[-*•]\s*/, "").replace(/^\s*\d+[.)、]\s*/, "").trim())
        .filter((line) => line.length > 0 && !line.startsWith("---"));
      if (items.length > 0) {
        return items;
      }
    }
  }
  return [];
}
