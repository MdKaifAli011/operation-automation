import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcrypt";

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  role: "admin" | "user";
  isActive: boolean;
  lastLogin?: Date;
  loginAttempts: number;
  lockUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  incLoginAttempts(): Promise<void>;
  resetLoginAttempts(): Promise<void>;
  isLocked: boolean; // Virtual getter, not a method
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function(email: string) {
          // Only allow testprepkart.com domain
          return /^[^\s@]+@testprepkart\.com$/.test(email);
        },
        message: "Only testprepkart.com email addresses are allowed"
      }
    },
    password: {
      type: String,
      required: true,
      minlength: 6
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user"
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastLogin: {
      type: Date
    },
    loginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Index for email lookup
userSchema.index({ email: 1 });

// Virtual for checking if account is locked
userSchema.virtual("isLocked").get(function() {
  return !!(this.lockUntil && this.lockUntil > new Date());
});

// Pre-save middleware to hash password
userSchema.pre("save", async function(next: any) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified("password")) {
    if (typeof next === "function") return next();
    return;
  }

  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    if (typeof next === "function") next();
  } catch (error) {
    if (typeof next === "function") next(error as Error);
    else throw error;
  }
});

// Instance method to compare password
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  // Validate both arguments before calling bcrypt.compare
  if (!candidatePassword || !this.password) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method to increment login attempts and lock account if needed
userSchema.methods.incLoginAttempts = async function(): Promise<void> {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < new Date()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates: Record<string, unknown> = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 attempts for 1 hour
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: new Date(Date.now() + 60 * 60 * 1000) }; // 1 hour
  }
  
  return this.updateOne(updates);
};

// Instance method to reset login attempts on successful login
userSchema.methods.resetLoginAttempts = async function(): Promise<void> {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 },
    $set: { lastLogin: new Date() }
  });
};

// Ensure virtuals are included in JSON
userSchema.set("toJSON", {
  virtuals: true,
  transform: function(doc, ret: any) {
    delete ret.password;
    delete ret.loginAttempts;
    delete ret.lockUntil;
    return ret;
  }
});

export const User = mongoose.models.User || mongoose.model<IUser>("User", userSchema);
