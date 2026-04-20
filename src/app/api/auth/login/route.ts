import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { User } from "@/models/User";
import { verifyRecaptcha } from "@/lib/recaptcha";

// Rate limiting middleware for Next.js API routes
async function applyRateLimit(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  
  // Simple in-memory store for rate limiting
  const store = new Map<string, { count: number; resetTime: number }>();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5;
  
  const now = Date.now();
  const key = `login:${ip}`;
  const record = store.get(key);
  
  if (!record || now > record.resetTime) {
    store.set(key, { count: 1, resetTime: now + windowMs });
    return null;
  }
  
  if (record.count >= maxAttempts) {
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

    // Validate email domain
    if (!email.endsWith("@testprepkart.com")) {
      return NextResponse.json(
        { error: "Only testprepkart.com email addresses are allowed" },
        { status: 400 }
      );
    }

    // Verify CAPTCHA token
    if (!captchaToken) {
      return NextResponse.json(
        { error: "CAPTCHA verification is required" },
        { status: 400 }
      );
    }

    const isCaptchaValid = await verifyRecaptcha(captchaToken);
    if (!isCaptchaValid) {
      return NextResponse.json(
        { error: "CAPTCHA verification failed" },
        { status: 400 }
      );
    }

    // Connect to database
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
    if (user.isLocked()) {
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

    response.cookies.set("auth-token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
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
