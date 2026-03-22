import { NextRequest, NextResponse } from "next/server";
import {
  isLocalStorageMigrationDone,
  markLocalStorageMigrationDone,
  saveConversationsBatch,
  saveUIPreferences,
} from "@/lib/storage";
import type { Conversation } from "@/lib/types";

export const runtime = "nodejs";

function sanitizeConversations(input: unknown): Conversation[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      if (typeof row.id !== "string") return null;

      const createdAt = row.createdAt ? new Date(String(row.createdAt)) : new Date();
      const updatedAt = row.updatedAt ? new Date(String(row.updatedAt)) : createdAt;

      return {
        id: row.id,
        title: typeof row.title === "string" ? row.title : "",
        messages: Array.isArray(row.messages) ? (row.messages as any[]) : [],
        context: row.context as any,
        archived: Boolean(row.archived),
        favorite: Boolean(row.favorite),
        createdAt,
        updatedAt,
      } satisfies Conversation;
    })
    .filter((item): item is Conversation => item !== null);
}

export async function POST(request: NextRequest) {
  try {
    if (isLocalStorageMigrationDone()) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "already_migrated",
      });
    }

    const body = await request.json();
    const conversations = sanitizeConversations(body?.conversations);

    const preferences = {
      currentModule:
        typeof body?.currentModule === "string" ? body.currentModule : undefined,
      isSidebarCollapsed:
        typeof body?.isSidebarCollapsed === "boolean"
          ? body.isSidebarCollapsed
          : undefined,
    };

    const result = saveConversationsBatch(conversations);
    const prefSaved = saveUIPreferences(preferences);

    if (!prefSaved) {
      return NextResponse.json(
        { error: "Failed to save UI preferences" },
        { status: 500 }
      );
    }

    if (result.failed > 0) {
      return NextResponse.json(
        {
          error: "Partial migration failure",
          migratedConversations: result.saved,
          failedConversations: result.failed,
        },
        { status: 500 }
      );
    }

    const marked = markLocalStorageMigrationDone({
      migratedConversations: result.saved,
    });

    if (!marked) {
      return NextResponse.json(
        { error: "Failed to save migration status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      migratedConversations: result.saved,
      failedConversations: result.failed,
    });
  } catch (error) {
    console.error("Error migrating localStorage data:", error);
    return NextResponse.json(
      { error: "Failed to migrate localStorage data" },
      { status: 500 }
    );
  }
}
