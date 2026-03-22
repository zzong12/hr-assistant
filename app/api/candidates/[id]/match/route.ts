import { NextRequest, NextResponse } from "next/server";
import { CandidateMatchError, matchCandidateToJob } from "@/lib/candidate-matching";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json(
        { error: "jobId is required" },
        { status: 400 }
      );
    }

    const candidate = await matchCandidateToJob(id, jobId);
    return NextResponse.json(candidate);
  } catch (error) {
    console.error("Match error:", error);
    if (error instanceof CandidateMatchError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Failed to match candidate" },
      { status: 500 }
    );
  }
}
