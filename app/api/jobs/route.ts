import { NextRequest, NextResponse } from "next/server";
import { generateId, saveJob, loadAllJobs, loadJob, deleteJob } from "@/lib/storage";
import type { Job } from "@/lib/types";

export const runtime = "nodejs";

/**
 * PATCH /api/jobs
 * Partially update an existing job (alias for PUT for convenience)
 */
export async function PATCH(request: NextRequest) {
  return PUT(request);
}

/**
 * GET /api/jobs
 * Get all jobs or a specific job by ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      // Get specific job
      const job = loadJob(id);
      if (!job) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      }
      return NextResponse.json(job);
    }

    // Get all jobs
    const jobs = loadAllJobs();
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error("Error loading jobs:", error);
    return NextResponse.json(
      { error: "Failed to load jobs" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/jobs
 * Create a new job
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, level, department, skills, requirements, responsibilities } = body;

    // Validate required fields
    if (!title || !level || !department) {
      return NextResponse.json(
        { error: "Missing required fields: title, level, department" },
        { status: 400 }
      );
    }

    const desc = body.description || {};
    const job: Job = {
      id: generateId(),
      title,
      level,
      department,
      description: {
        overview: desc.overview || body.overview || "",
        responsibilities: desc.responsibilities || responsibilities || [],
        requirements: desc.requirements || requirements || [],
        benefits: desc.benefits || body.benefits || [],
      },
      skills: skills || [],
      salary: body.salary,
      status: body.status || "active",
      scoringRuleId: body.scoringRuleId || undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save job
    const saved = saveJob(job);
    if (!saved) {
      return NextResponse.json(
        { error: "Failed to save job" },
        { status: 500 }
      );
    }

    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    console.error("Error creating job:", error);
    return NextResponse.json(
      { error: "Failed to create job" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/jobs
 * Update an existing job
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      );
    }

    // Load existing job
    const existingJob = loadJob(id);
    if (!existingJob) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Update job
    const updatedJob: Job = {
      ...existingJob,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date(),
    };

    // Save updated job
    const saved = saveJob(updatedJob);
    if (!saved) {
      return NextResponse.json(
        { error: "Failed to update job" },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedJob);
  } catch (error) {
    console.error("Error updating job:", error);
    return NextResponse.json(
      { error: "Failed to update job" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/jobs
 * Delete a job
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      );
    }

    const deleted = deleteJob(id);
    if (!deleted) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting job:", error);
    return NextResponse.json(
      { error: "Failed to delete job" },
      { status: 500 }
    );
  }
}
