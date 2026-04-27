import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const response = NextResponse.json({
    success: true,
    message: "Logged out successfully"
  });

  const isSecure = req.headers.get("x-forwarded-proto") === "https" ||
                   req.nextUrl.protocol === "https:" ||
                   (process.env.NODE_ENV === "production" && process.env.FORCE_SECURE_COOKIES === "1");

  // Clear the auth token cookie
  response.cookies.set("auth-token", "", {
    httpOnly: true,
    secure: isSecure,
    sameSite: "strict",
    maxAge: 0 // Expire immediately
  });

  return response;
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
