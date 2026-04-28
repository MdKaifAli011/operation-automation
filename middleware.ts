import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public routes that don't require authentication
const publicRoutes = ["/login", "/api/auth/login", "/api/upload-excel"];

// Validate session token
function validateSessionToken(token: string): boolean {
  try {
    // Decode the base64 token
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [userId, timestamp] = decoded.split(':');
    
    // Check if token is not too old (24 hours)
    const tokenAge = Date.now() - parseInt(timestamp);
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (tokenAge > maxAge) {
      return false;
    }
    
    // Check if it's env-admin token
    if (userId === "env-admin") {
      const envEmail = process.env.ADMIN_EMAIL || process.env.INITIAL_ADMIN_EMAIL;
      return !!envEmail;
    }
    
    // For database users, we can't validate in middleware without DB connection
    // But we can check if the token format is valid
    return !!userId && !!timestamp;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check for auth token cookie
  const authToken = request.cookies.get("auth-token")?.value;

  if (!authToken || !validateSessionToken(authToken)) {
    // Check if it's an API route
    if (pathname.startsWith("/api")) {
      // Return 401 Unauthorized for API routes
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    } else {
      // Redirect to login page for page routes
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Allow authenticated requests
  return NextResponse.next();
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    // Match all routes except static files and public folder
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
