import { NextRequest, NextResponse } from "next/server";
import {
  generateId,
  saveCandidate,
  loadAllCandidates,
  loadCandidate,
  deleteCandidate,
  saveRawResumeText,
} from "@/lib/storage";
import { parseResume, calculateMatchScore, generateMatchReason } from "@/lib/resume-utils";
import type { Candidate } from "@/lib/types";

export const runtime = "nodejs";

/**
 * GET /api/candidates
 * Get all candidates or a specific candidate by ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      // Get specific candidate
      const candidate = loadCandidate(id);
      if (!candidate) {
        return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
      }
      return NextResponse.json(candidate);
    }

    // Get all candidates
    const candidates = loadAllCandidates();
    return NextResponse.json({ candidates });
  } catch (error) {
    console.error("Error loading candidates:", error);
    return NextResponse.json(
      { error: "Failed to load candidates" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/candidates
 * Create a new candidate or upload and parse resume
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, resumeText, jobId, jobSkills } = body;

    // For resume upload with parsing
    if (resumeText) {
      // Parse resume
      const parsedData = await parseResume(
        body.filename || "resume",
        resumeText,
        "text"
      );

      if (!parsedData) {
        return NextResponse.json(
          { error: "Failed to parse resume" },
          { status: 500 }
        );
      }

      // Create candidate with parsed data
      const candidate: Candidate = {
        id: generateId(),
        name: name || "未命名候选人",
        contact: {
          email: email || "",
          phone,
        },
        resume: {
          filename: body.filename || "resume.txt",
          filepath: "",
          parsedData,
        },
        matchedJobs: [],
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // If jobId provided, calculate match score
      if (jobId && jobSkills) {
        const score = calculateMatchScore(
          parsedData.skills || [],
          jobSkills || [],
          parsedData.experience || [],
          [] // jobRequirements would come from job data
        );

        candidate.matchedJobs.push({
          jobId,
          score,
          reason: generateMatchReason(candidate, jobSkills || [], score).join("; "),
        });

        // Update status based on score
        if (score >= 80) {
          candidate.status = "interview";
        } else if (score >= 60) {
          candidate.status = "screening";
        }
      }

      const saved = saveCandidate(candidate);
      if (!saved) {
        return NextResponse.json(
          { error: "Failed to save candidate" },
          { status: 500 }
        );
      }

      if (resumeText) {
        saveRawResumeText(candidate.id, resumeText);
      }

      return NextResponse.json(candidate, { status: 201 });
    }

    // For manual candidate creation
    if (!name || !email) {
      return NextResponse.json(
        { error: "Missing required fields: name, email" },
        { status: 400 }
      );
    }

    const candidate: Candidate = {
      id: generateId(),
      name,
      contact: {
        email,
        phone,
      },
      resume: {
        filename: "",
        filepath: "",
      },
      matchedJobs: [],
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const saved = saveCandidate(candidate);
    if (!saved) {
      return NextResponse.json(
        { error: "Failed to save candidate" },
        { status: 500 }
      );
    }

    return NextResponse.json(candidate, { status: 201 });
  } catch (error) {
    console.error("Error creating candidate:", error);
    return NextResponse.json(
      { error: "Failed to create candidate" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/candidates
 * Update an existing candidate
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Candidate ID is required" },
        { status: 400 }
      );
    }

    // Load existing candidate
    const existingCandidate = loadCandidate(id);
    if (!existingCandidate) {
      return NextResponse.json(
        { error: "Candidate not found" },
        { status: 404 }
      );
    }

    // Update candidate
    const updatedCandidate: Candidate = {
      ...existingCandidate,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date(),
    };

    // Save updated candidate
    const saved = saveCandidate(updatedCandidate);
    if (!saved) {
      return NextResponse.json(
        { error: "Failed to update candidate" },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedCandidate);
  } catch (error) {
    console.error("Error updating candidate:", error);
    return NextResponse.json(
      { error: "Failed to update candidate" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/candidates
 * Delete a candidate
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Candidate ID is required" },
        { status: 400 }
      );
    }

    const deleted = deleteCandidate(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Candidate not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting candidate:", error);
    return NextResponse.json(
      { error: "Failed to delete candidate" },
      { status: 500 }
    );
  }
}
