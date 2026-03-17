import { NextResponse } from "next/server";
import { clearAllData, getDataStats, loadAllJobs, loadAllCandidates, loadAllInterviews, loadAllConversations, loadAllTemplates } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  try {
    const stats = getDataStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error getting data stats:", error);
    return NextResponse.json(
      { error: "获取数据统计失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.action === "clear") {
      const success = clearAllData();
      if (success) {
        return NextResponse.json({ message: "所有数据已清除" });
      }
      return NextResponse.json({ error: "清除数据失败" }, { status: 500 });
    }

    if (body.action === "export") {
      const data = {
        jobs: loadAllJobs(),
        candidates: loadAllCandidates(),
        interviews: loadAllInterviews(),
        conversations: loadAllConversations(),
        templates: loadAllTemplates(),
        exportedAt: new Date().toISOString(),
      };
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "未知操作" }, { status: 400 });
  } catch (error) {
    console.error("Data API error:", error);
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}
