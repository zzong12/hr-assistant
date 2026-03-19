import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    isElectron: process.env.IS_ELECTRON === "true",
    dataDir: process.env.DATA_DIR || null,
  });
}
