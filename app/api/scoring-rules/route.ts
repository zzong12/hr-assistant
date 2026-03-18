import { NextRequest, NextResponse } from "next/server";
import {
  generateId,
  saveScoringRule,
  loadScoringRule,
  loadAllScoringRules,
  deleteScoringRule,
  getLinkedJobsForRule,
} from "@/lib/storage";
import type { ScoringRule } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const rule = loadScoringRule(id);
      if (!rule) {
        return NextResponse.json({ error: "Scoring rule not found" }, { status: 404 });
      }
      const linkedJobs = getLinkedJobsForRule(id);
      return NextResponse.json({ rule, linkedJobs });
    }

    const rules = loadAllScoringRules();
    return NextResponse.json({ rules });
  } catch (error) {
    console.error("Error loading scoring rules:", error);
    return NextResponse.json({ error: "Failed to load scoring rules" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, dimensions, totalScore, version } = body;

    if (!name) {
      return NextResponse.json({ error: "规则名称不能为空" }, { status: 400 });
    }

    const rule: ScoringRule = {
      id: body.id || generateId(),
      name,
      description: description || "",
      version: version || "1.0.0",
      dimensions: dimensions || [],
      totalScore: totalScore || 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const saved = saveScoringRule(rule);
    if (!saved) {
      return NextResponse.json({ error: "Failed to save scoring rule" }, { status: 500 });
    }

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error("Error creating scoring rule:", error);
    return NextResponse.json({ error: "Failed to create scoring rule" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Rule ID is required" }, { status: 400 });
    }

    const existing = loadScoringRule(id);
    if (!existing) {
      return NextResponse.json({ error: "Scoring rule not found" }, { status: 404 });
    }

    const currentVersion = existing.version || "1.0.0";
    const parts = currentVersion.split(".");
    const minor = parseInt(parts[1] || "0", 10) + 1;
    const nextVersion = `${parts[0]}.${minor}.${parts[2] || "0"}`;

    const updatedRule: ScoringRule = {
      ...existing,
      ...updates,
      id,
      version: updates.version || nextVersion,
      updatedAt: new Date(),
    };

    const saved = saveScoringRule(updatedRule);
    if (!saved) {
      return NextResponse.json({ error: "Failed to update scoring rule" }, { status: 500 });
    }

    return NextResponse.json(updatedRule);
  } catch (error) {
    console.error("Error updating scoring rule:", error);
    return NextResponse.json({ error: "Failed to update scoring rule" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Rule ID is required" }, { status: 400 });
    }

    const result = deleteScoringRule(id);
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to delete" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting scoring rule:", error);
    return NextResponse.json({ error: "Failed to delete scoring rule" }, { status: 500 });
  }
}
