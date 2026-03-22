import { NextRequest, NextResponse } from "next/server";
import {
  getStorageInitErrorMessage,
  loadUIPreferences,
  saveUIPreferences,
} from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  try {
    const preferences = loadUIPreferences();
    const storageError = getStorageInitErrorMessage();
    return NextResponse.json({
      ...preferences,
      degraded: Boolean(storageError),
      warning: storageError || undefined,
    });
  } catch (error) {
    console.error("Error loading preferences:", error);
    return NextResponse.json(
      {
        currentModule: "chat",
        isSidebarCollapsed: false,
        degraded: true,
        warning: getStorageInitErrorMessage() || "Failed to load preferences",
      }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const ok = saveUIPreferences({
      currentModule: typeof body.currentModule === "string" ? body.currentModule : undefined,
      isSidebarCollapsed:
        typeof body.isSidebarCollapsed === "boolean"
          ? body.isSidebarCollapsed
          : undefined,
    });

    if (!ok) {
      const storageError = getStorageInitErrorMessage();
      return NextResponse.json({
        success: false,
        degraded: true,
        warning: storageError || "Failed to save preferences",
      });
    }

    return NextResponse.json({ success: true, degraded: false });
  } catch (error) {
    console.error("Error saving preferences:", error);
    return NextResponse.json(
      {
        success: false,
        degraded: true,
        warning: getStorageInitErrorMessage() || "Failed to save preferences",
      }
    );
  }
}
