import { NextRequest, NextResponse } from "next/server";
import { getAgentManager } from "@/lib/agents";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, conversationHistory = [], stream: useStream = false } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required and must be a string" },
        { status: 400 }
      );
    }

    const agentManager = getAgentManager();

    if (useStream) {
      const encoder = new TextEncoder();

      const agentId = agentManager.routeToAgent(message);
      const agent = agentId ? agentManager.getAgent(agentId) : null;

      const readable = new ReadableStream({
        async start(controller) {
          try {
            // Send agent info first
            if (agent) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ agentUsed: agent.name })}\n\n`
                )
              );
            }
            for await (const chunk of agentManager.streamMessage(
              message,
              conversationHistory
            )) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ content: chunk })}\n\n`
                )
              );
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (error) {
            console.error("Streaming error:", error);
            const errMsg =
              error instanceof Error ? error.message : "AI服务异常";
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ error: `消息处理失败: ${errMsg}` })}\n\n`
              )
            );
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const response = await agentManager.processMessage(
      message,
      conversationHistory
    );

    return NextResponse.json({
      content: response.content,
      agentUsed: response.agentUsed,
      metadata: response.metadata,
    });
  } catch (error) {
    console.error("Chat API error:", error);

    if (error instanceof Error) {
      if (error.message.includes("ANTHROPIC_API_KEY")) {
        return NextResponse.json(
          { error: "API密钥未配置，请检查 .env.local 中的 ANTHROPIC_API_KEY" },
          { status: 500 }
        );
      }

      const status = (error as any).status;
      if (status === 401 || status === 403) {
        return NextResponse.json(
          { error: "API密钥无效或已过期，请更新 ANTHROPIC_API_KEY" },
          { status: 401 }
        );
      }
      if (status === 429) {
        return NextResponse.json(
          { error: "API请求过于频繁，请稍后重试" },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: `AI服务异常: ${error.message}` },
        { status: status || 500 }
      );
    }

    return NextResponse.json(
      { error: "服务器内部错误，请稍后重试" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const agentManager = getAgentManager();
    return NextResponse.json({
      status: "ok",
      agents: agentManager.getAllAgents().map((agent) => ({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        description: agent.description,
      })),
    });
  } catch {
    return NextResponse.json({ status: "ok", agents: [] });
  }
}
