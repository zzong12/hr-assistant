import type { Conversation, Message } from "@/lib/types";
import {
  saveConversation,
  loadAllConversations,
  loadConversation,
  deleteConversation,
} from "@/lib/storage";

/**
 * Create a new conversation
 */
export function createConversation(
  title: string = "新对话"
): Conversation {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title,
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Add message to conversation
 */
export function addMessageToConversation(
  conversation: Conversation,
  message: Message
): Conversation {
  return {
    ...conversation,
    messages: [...conversation.messages, message],
    updatedAt: new Date(),
  };
}

/**
 * Update conversation title based on first user message
 */
export function generateConversationTitle(
  conversation: Conversation
): string {
  const firstUserMessage = conversation.messages.find(
    (msg) => msg.role === "user"
  );

  if (!firstUserMessage) {
    return conversation.title;
  }

  const content = firstUserMessage.content;
  const maxLength = 30;

  // Truncate and add ellipsis if needed
  return content.length > maxLength
    ? content.substring(0, maxLength) + "..."
    : content;
}

/**
 * Search conversations
 */
export function searchConversations(
  query: string,
  conversations: Conversation[]
): Conversation[] {
  if (!query.trim()) {
    return conversations;
  }

  const lowerQuery = query.toLowerCase();

  return conversations.filter((conv) => {
    // Search in title
    if (conv.title.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    // Search in messages
    return conv.messages.some(
      (msg) => msg.content.toLowerCase().includes(lowerQuery)
    );
  });
}

/**
 * Filter conversations by date range
 */
export function filterConversationsByDate(
  conversations: Conversation[],
  fromDate?: Date,
  toDate?: Date
): Conversation[] {
  return conversations.filter((conv) => {
    const convDate = new Date(conv.createdAt);

    if (fromDate && convDate < fromDate) {
      return false;
    }

    if (toDate && convDate > toDate) {
      return false;
    }

    return true;
  });
}

/**
 * Get conversation statistics
 */
export function getConversationStats(conversations: Conversation[]): {
  total: number;
  totalMessages: number;
  averageMessagesPerConversation: number;
  todayCount: number;
  weekCount: number;
} {
  const total = conversations.length;
  const totalMessages = conversations.reduce(
    (sum, conv) => sum + conv.messages.length,
    0
  );

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const todayCount = conversations.filter(
    (conv) => new Date(conv.createdAt) >= today
  ).length;

  const weekCount = conversations.filter(
    (conv) => new Date(conv.createdAt) >= weekAgo
  ).length;

  return {
    total,
    totalMessages,
    averageMessagesPerConversation:
      total > 0 ? Math.round(totalMessages / total) : 0,
    todayCount,
    weekCount,
  };
}

/**
 * Export conversation as text
 */
export function exportConversationAsText(conversation: Conversation): string {
  let text = `对话记录: ${conversation.title}\n`;
  text += `创建时间: ${conversation.createdAt.toLocaleString()}\n`;
  text += `消息数量: ${conversation.messages.length}\n`;
  text += `\n${"=".repeat(50)}\n\n`;

  for (const message of conversation.messages) {
    const role = message.role === "user" ? "用户" : "助手";
    text += `[${role}] ${message.timestamp.toLocaleString()}\n`;
    text += `${message.content}\n\n`;
  }

  return text;
}

/**
 * Export conversation as markdown
 */
export function exportConversationAsMarkdown(
  conversation: Conversation
): string {
  let md = `# ${conversation.title}\n\n`;
  md += `**创建时间**: ${conversation.createdAt.toLocaleString()}  \n`;
  md += `**消息数量**: ${conversation.messages.length}\n\n`;
  md += `---\n\n`;

  for (const message of conversation.messages) {
    const role = message.role === "user" ? "👤 用户" : "🤖 助手";
    md += `### ${role}\n`;
    md += `*${message.timestamp.toLocaleString()}*\n\n`;
    md += `${message.content}\n\n`;
  }

  return md;
}

/**
 * Export conversation as JSON
 */
export function exportConversationAsJSON(
  conversation: Conversation
): string {
  return JSON.stringify(conversation, null, 2);
}

/**
 * Delete old conversations (older than specified days)
 */
export function deleteOldConversations(
  conversations: Conversation[],
  daysOld: number = 30
): string[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const toDelete: string[] = [];

  for (const conv of conversations) {
    const convDate = new Date(conv.createdAt);
    if (convDate < cutoffDate) {
      deleteConversation(conv.id);
      toDelete.push(conv.id);
    }
  }

  return toDelete;
}
