import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateSessionToken } from "@/lib/auth";

// Define public routes that don't require authentication
const publicRoutes = ["/login", "/api/auth/login", "/api/auth/logout"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Skip middleware for static files and API routes that don't need auth
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/uploads/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check for session token in cookies
  const token = req.cookies.get("auth-token")?.value;

  if (!token) {
    // Redirect to login if no token
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Validate the token
  const user = await validateSessionToken(token);
  
  if (!user) {
    // Token is invalid, redirect to login
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    
    // Clear the invalid token
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("auth-token");
    return response;
  }

  // User is authenticated, proceed
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
