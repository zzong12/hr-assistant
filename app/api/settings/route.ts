import { NextRequest, NextResponse } from "next/server";
import { loadAllSettings, saveSetting } from "@/lib/storage";

export async function GET() {
  try {
    const settings = loadAllSettings();
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({}, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    for (const [key, value] of Object.entries(body)) {
      saveSetting(key, String(value));
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "保存设置失败" },
      { status: 500 }
    );
  }
}
