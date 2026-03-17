import { NextRequest, NextResponse } from "next/server";
import {
  generateId,
  saveInterview,
  loadAllInterviews,
  loadInterview,
  deleteInterview,
  loadJob,
  loadCandidate,
  loadSetting,
} from "@/lib/storage";
import {
  generateInterviewQuestions,
  checkTimeConflict,
} from "@/lib/interview-utils";
import type { Interview } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const interview = loadInterview(id);
      if (!interview) {
        return NextResponse.json(
          { error: "Interview not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(interview);
    }

    const interviews = loadAllInterviews();

    const status = searchParams.get("status");
    const filtered = status
      ? interviews.filter((i) => i.status === status)
      : interviews;

    return NextResponse.json({ interviews: filtered });
  } catch (error) {
    console.error("Error loading interviews:", error);
    return NextResponse.json(
      { error: "Failed to load interviews" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      jobId,
      candidateId,
      scheduledTime,
      location,
      interviewer,
      autoGenerate = true,
      evaluationPresetId,
    } = body;

    if (!jobId || !candidateId || !scheduledTime || !location || !interviewer) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: jobId, candidateId, scheduledTime, location, interviewer",
        },
        { status: 400 }
      );
    }

    const job = loadJob(jobId);
    const candidate = loadCandidate(candidateId);

    let evaluationPreset: Interview["evaluationPreset"];
    if (evaluationPresetId) {
      const presetsJson = loadSetting("evaluation_presets");
      if (presetsJson) {
        try {
          const presets = JSON.parse(presetsJson);
          evaluationPreset = presets.find((p: any) => p.id === evaluationPresetId);
        } catch {}
      }
    }

    const newInterview: Interview = {
      id: generateId(),
      jobId,
      candidateId,
      jobTitle: job?.title,
      candidateName: candidate?.name,
      scheduledTime: new Date(scheduledTime),
      location,
      interviewer,
      questions: [],
      status: "scheduled",
      createdAt: new Date(),
      ...(evaluationPreset && { evaluationPreset }),
    };

    // Check time conflicts
    const existingInterviews = loadAllInterviews();
    const hasConflict = checkTimeConflict(newInterview, existingInterviews);
    if (hasConflict) {
      return NextResponse.json(
        { error: "该时间段已有面试安排，存在时间冲突" },
        { status: 409 }
      );
    }

    // Generate questions using the question bank
    if (autoGenerate && job && candidate) {
      newInterview.questions = generateInterviewQuestions(job, candidate, 8);
    } else if (autoGenerate) {
      newInterview.questions = [
        { question: "请简单介绍一下你自己", category: "开场" },
        { question: "请描述一下你的工作经历", category: "项目经验" },
        { question: "你如何处理工作中的技术挑战？", category: "行为面试" },
        { question: "你对未来的职业规划是什么？", category: "文化匹配" },
      ];
    }

    // Update candidate status
    if (candidate && candidate.status === "screening") {
      candidate.status = "interview";
      candidate.updatedAt = new Date();
      const { saveCandidate } = await import("@/lib/storage");
      saveCandidate(candidate);
    }

    const saved = saveInterview(newInterview);
    if (!saved) {
      return NextResponse.json(
        { error: "Failed to save interview" },
        { status: 500 }
      );
    }

    return NextResponse.json(newInterview, { status: 201 });
  } catch (error) {
    console.error("Error creating interview:", error);
    return NextResponse.json(
      { error: "Failed to create interview" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, feedback, status, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Interview ID is required" },
        { status: 400 }
      );
    }

    const existingInterview = loadInterview(id);
    if (!existingInterview) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 }
      );
    }

    const updatedInterview: Interview = {
      ...existingInterview,
      ...updates,
      id,
      feedback: feedback || existingInterview.feedback,
      status: status || existingInterview.status,
    };

    if (updates.scheduledTime) {
      const existingInterviews = loadAllInterviews();
      const hasConflict = checkTimeConflict(updatedInterview, existingInterviews);
      if (hasConflict) {
        return NextResponse.json(
          { error: "时间冲突" },
          { status: 409 }
        );
      }
    }

    const saved = saveInterview(updatedInterview);
    if (!saved) {
      return NextResponse.json(
        { error: "Failed to update interview" },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedInterview);
  } catch (error) {
    console.error("Error updating interview:", error);
    return NextResponse.json(
      { error: "Failed to update interview" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Interview ID is required" },
        { status: 400 }
      );
    }

    const deleted = deleteInterview(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting interview:", error);
    return NextResponse.json(
      { error: "Failed to delete interview" },
      { status: 500 }
    );
  }
}
