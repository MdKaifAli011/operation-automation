import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { User } from "@/models/User";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
}

// Simple session token validation
export async function validateSessionToken(token: string): Promise<AuthUser | null> {
  try {
    // Decode the base64 token (simple implementation)
    // In production, use proper JWT with signing
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [userId, timestamp] = decoded.split(':');
    
    // Check if token is not too old (24 hours)
    const tokenAge = Date.now() - parseInt(timestamp);
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (tokenAge > maxAge) {
      return null;
    }
    
    // Connect to database if needed
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI!);
    }
    
    // Find user by ID
    const user = await User.findById(userId);
    if (!user || !user.isActive) {
      return null;
    }
    
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role
    };
  } catch (error) {
    console.error("Session validation error:", error);
    return null;
  }
}

// Get current user from request
export async function getCurrentUser(req: NextRequest): Promise<AuthUser | null> {
  const token = req.cookies.get("auth-token")?.value;
  if (!token) {
    return null;
  }
  
  return await validateSessionToken(token);
}

// Middleware to check if user is authenticated
export async function requireAuth(req: NextRequest): Promise<{ user: AuthUser } | { error: string; status: number }> {
  const user = await getCurrentUser(req);
  
  if (!user) {
    return { error: "Authentication required", status: 401 };
  }
  
  return { user };
}

// Middleware to check if user is admin
export async function requireAdmin(req: NextRequest): Promise<{ user: AuthUser } | { error: string; status: number }> {
  const authResult = await requireAuth(req);
  
  if ("error" in authResult) {
    return authResult;
  }
  
  if (authResult.user.role !== "admin") {
    return { error: "Admin access required", status: 403 };
  }
  
  return authResult;
}
