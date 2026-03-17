import { NextRequest, NextResponse } from "next/server";
import {
  saveConversation,
  loadAllConversations,
  loadConversation,
  deleteConversation,
} from "@/lib/storage";
import {
  createConversation,
  addMessageToConversation,
  generateConversationTitle,
  searchConversations,
  exportConversationAsText,
  exportConversationAsMarkdown,
  exportConversationAsJSON,
} from "@/lib/conversation-utils";
import type { Conversation, Message } from "@/lib/types";

export const runtime = "nodejs";

/**
 * GET /api/conversations
 * Get all conversations or a specific conversation
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const search = searchParams.get("search");
    const exportFormat = searchParams.get("export");

    // Load all conversations
    let conversations = loadAllConversations();

    // Apply search filter if provided
    if (search) {
      conversations = searchConversations(search, conversations);
    }

    // Return specific conversation
    if (id) {
      const conversation = loadConversation(id);
      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }

      // Handle export
      if (exportFormat) {
        return handleExport(conversation, exportFormat);
      }

      return NextResponse.json(conversation);
    }

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("Error loading conversations:", error);
    return NextResponse.json(
      { error: "Failed to load conversations" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversations
 * Create a new conversation or add message to existing one
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, conversationId, message, title } = body;

    if (action === "create") {
      // Create new conversation
      const conversation = createConversation(title);
      const saved = saveConversation(conversation);

      if (!saved) {
        return NextResponse.json(
          { error: "Failed to create conversation" },
          { status: 500 }
        );
      }

      return NextResponse.json(conversation, { status: 201 });
    }

    if (action === "addMessage" && conversationId && message) {
      // Load existing conversation
      const conversation = loadConversation(conversationId);
      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }

      // Add message
      const newMessage: Message = {
        id: Date.now().toString(),
        role: message.role,
        content: message.content,
        timestamp: new Date(message.timestamp),
        metadata: message.metadata,
      };

      const updatedConversation = addMessageToConversation(
        conversation,
        newMessage
      );

      // Generate title from first user message
      if (
        conversation.messages.length === 0 &&
        newMessage.role === "user"
      ) {
        updatedConversation.title = generateConversationTitle(
          updatedConversation
        );
      }

      const saved = saveConversation(updatedConversation);
      if (!saved) {
        return NextResponse.json(
          { error: "Failed to save message" },
          { status: 500 }
        );
      }

      return NextResponse.json(updatedConversation);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error processing conversation request:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/conversations
 * Update a conversation
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Conversation ID is required" },
        { status: 400 }
      );
    }

    const existingConversation = loadConversation(id);
    if (!existingConversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const updatedConversation: Conversation = {
      ...existingConversation,
      ...updates,
      id,
      updatedAt: new Date(),
    };

    const saved = saveConversation(updatedConversation);
    if (!saved) {
      return NextResponse.json(
        { error: "Failed to update conversation" },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedConversation);
  } catch (error) {
    console.error("Error updating conversation:", error);
    return NextResponse.json(
      { error: "Failed to update conversation" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/conversations
 * Delete a conversation
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Conversation ID is required" },
        { status: 400 }
      );
    }

    const deleted = deleteConversation(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    return NextResponse.json(
      { error: "Failed to delete conversation" },
      { status: 500 }
    );
  }
}

/**
 * Handle conversation export
 */
function handleExport(conversation: Conversation, format: string) {
  let content: string;
  let contentType: string;
  let filename: string;

  switch (format) {
    case "text":
      content = exportConversationAsText(conversation);
      contentType = "text/plain";
      filename = `conversation-${conversation.id}.txt`;
      break;
    case "markdown":
      content = exportConversationAsMarkdown(conversation);
      contentType = "text/markdown";
      filename = `conversation-${conversation.id}.md`;
      break;
    case "json":
      content = exportConversationAsJSON(conversation);
      contentType = "application/json";
      filename = `conversation-${conversation.id}.json`;
      break;
    default:
      return NextResponse.json({ error: "Invalid export format" }, { status: 400 });
  }

  return new NextResponse(content, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
