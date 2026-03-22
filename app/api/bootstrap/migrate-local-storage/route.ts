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

  const results: Conversation[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string") continue;

    const createdAt = row.createdAt ? new Date(String(row.createdAt)) : new Date();
    const updatedAt = row.updatedAt ? new Date(String(row.updatedAt)) : createdAt;

    results.push({
      id: row.id,
      title: typeof row.title === "string" ? row.title : "",
      messages: Array.isArray(row.messages) ? (row.messages as any[]) : [],
      context: row.context as any,
      archived: Boolean(row.archived),
      favorite: Boolean(row.favorite),
      createdAt,
      updatedAt,
    });
  }
  return results;
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
