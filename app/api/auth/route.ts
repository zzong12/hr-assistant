import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

function getCredentials() {
  return {
    username: process.env.AUTH_USERNAME || "admin",
    password: process.env.AUTH_PASSWORD || "admin123",
  };
}

function generateToken(username: string): string {
  const secret = process.env.AUTH_PASSWORD || "admin123";
  return createHash("sha256")
    .update(`${username}:${secret}:nexus-hr`)
    .digest("hex");
}

export function verifyToken(token: string): boolean {
  const { username } = getCredentials();
  const expected = generateToken(username);
  return token === expected;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;
    const creds = getCredentials();

    if (username !== creds.username || password !== creds.password) {
      return NextResponse.json(
        { error: "用户名或密码错误" },
        { status: 401 }
      );
    }

    const token = generateToken(username);
    const response = NextResponse.json({ success: true, username });

    response.cookies.set("nexus_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "请求格式错误" },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("nexus_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("nexus_token")?.value;
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  const { username } = getCredentials();
  return NextResponse.json({ authenticated: true, username });
}
