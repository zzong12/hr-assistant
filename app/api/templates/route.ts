import { NextRequest, NextResponse } from "next/server";
import {
  getAllTemplates,
  getTemplateByCategory,
  fillTemplate,
} from "@/lib/communication-utils";
import { saveTemplate, loadTemplate, deleteTemplate } from "@/lib/storage";
import { getAgentManager } from "@/lib/agents";

export const runtime = "nodejs";

/**
 * GET /api/templates
 * Get all templates or a specific template
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const id = searchParams.get("id");

    if (id) {
      // Load saved template from storage
      const template = loadTemplate(id);
      if (!template) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
      return NextResponse.json(template);
    }

    if (category) {
      // Get template by category
      const template = getTemplateByCategory(category);
      if (!template) {
        return NextResponse.json(
          { error: "Template not found for category" },
          { status: 404 }
        );
      }
      return NextResponse.json(template);
    }

    // Get all default templates
    const templates = getAllTemplates();
    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Error loading templates:", error);
    return NextResponse.json(
      { error: "Failed to load templates" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/templates
 * Generate communication message or save custom template
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, scenario, context, template } = body;

    if (action === "generate") {
      // Generate message using AI
      const agentManager = getAgentManager();

      // Build prompt for communication agent
      const prompt = `请根据以下场景生成专业的HR沟通话术：

场景：${scenario}
上下文信息：
${Object.entries(context || {})
  .map(([key, value]) => `${key}: ${value}`)
  .join("\n")}

要求：
1. 语气专业、友好、得体
2. 内容清晰、完整
3. 符合HR沟通规范
4. 使用中文
5. 结构清晰，分段合理

请直接生成沟通内容。`;

      const response = await agentManager.processMessage(prompt, []);

      return NextResponse.json({
        message: response.content,
        agentUsed: response.agentUsed,
      });
    }

    if (action === "fill" && template) {
      // Fill template with variables
      const filled = fillTemplate(template, context || {});
      return NextResponse.json(filled);
    }

    // Save custom template
    if (template) {
      const saved = saveTemplate(template);
      if (!saved) {
        return NextResponse.json(
          { error: "Failed to save template" },
          { status: 500 }
        );
      }
      return NextResponse.json(template, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error processing template request:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/templates
 * Update a template
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 }
      );
    }

    const existingTemplate = loadTemplate(id);
    if (!existingTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const updatedTemplate = {
      ...existingTemplate,
      ...updates,
      id,
      updatedAt: new Date(),
    };

    const saved = saveTemplate(updatedTemplate);
    if (!saved) {
      return NextResponse.json(
        { error: "Failed to update template" },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedTemplate);
  } catch (error) {
    console.error("Error updating template:", error);
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/templates
 * Delete a template
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 }
      );
    }

    const deleted = deleteTemplate(id);
    if (!deleted) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting template:", error);
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }
}
