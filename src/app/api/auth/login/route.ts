import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { User } from "@/models/User";
import { verifyTurnstile, isCaptchaEnabled } from "@/lib/captcha";

// Rate limiting middleware for Next.js API routes
// Module-level store so it persists across requests in the same process
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_ATTEMPTS = 5;

async function applyRateLimit(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  
  const now = Date.now();
  const key = `login:${ip}`;
  const record = rateLimitStore.get(key);
  
  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return null;
  }
  
  if (record.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      { status: 429 }
    );
  }
  
  record.count++;
  return null;
}

export async function POST(req: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await applyRateLimit(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { email, password, captchaToken } = await req.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Check against env credentials first (for admin login without database)
    const envEmail = process.env.ADMIN_EMAIL || process.env.INITIAL_ADMIN_EMAIL;
    const envPassword = process.env.ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD;
    const envName = process.env.ADMIN_NAME || "Administrator";

    if (envEmail && envPassword && email.toLowerCase() === envEmail.toLowerCase() && password === envPassword) {
      // Create session token for env-based admin
      const sessionToken = Buffer.from(`env-admin:${Date.now()}`).toString('base64');
      
      const response = NextResponse.json({
        success: true,
        user: {
          id: "env-admin",
          email: envEmail,
          name: envName,
          role: "admin"
        }
      });

      const isSecure = req.headers.get("x-forwarded-proto") === "https" ||
                       req.nextUrl.protocol === "https:" ||
                       (process.env.NODE_ENV === "production" && process.env.FORCE_SECURE_COOKIES === "1");

      response.cookies.set("auth-token", sessionToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "strict",
        maxAge: 24 * 60 * 60 // 24 hours
      });

      return response;
    }

    // Validate email domain for database users
    if (!email.endsWith("@testprepkart.com")) {
      return NextResponse.json(
        { error: "Only testprepkart.com email addresses are allowed" },
        { status: 400 }
      );
    }

    // Verify CAPTCHA token (only when enabled)
    if (isCaptchaEnabled()) {
      if (!captchaToken) {
        return NextResponse.json(
          { error: "CAPTCHA verification is required" },
          { status: 400 }
        );
      }

      const isCaptchaValid = await verifyTurnstile(captchaToken);
      if (!isCaptchaValid) {
        return NextResponse.json(
          { error: "CAPTCHA verification failed" },
          { status: 400 }
        );
      }
    }

    // Connect to database for regular user login
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI!);
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { error: "Account is deactivated" },
        { status: 401 }
      );
    }

    // Check if account is locked due to too many failed attempts
    if (user.isLocked) {
      const lockTimeRemaining = Math.ceil((user.lockUntil!.getTime() - Date.now()) / (1000 * 60));
      return NextResponse.json(
        {
          error: `Account is locked due to too many failed attempts. Try again in ${lockTimeRemaining} minutes.` 
        },
        { status: 423 }
      );
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      // Increment login attempts
      await user.incLoginAttempts();
      
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Create session token (simple implementation - in production, use JWT with proper signing)
    const sessionToken = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
    
    // Set HTTP-only cookie with session token
    const response = NextResponse.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });

    const isSecure = req.headers.get("x-forwarded-proto") === "https" ||
                     req.nextUrl.protocol === "https:" ||
                     (process.env.NODE_ENV === "production" && process.env.FORCE_SECURE_COOKIES === "1");

    response.cookies.set("auth-token", sessionToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "strict",
      maxAge: 24 * 60 * 60 // 24 hours
    });

    return response;

  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
