import mongoose from "mongoose";
import { User } from "../src/models/User";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function seedAdmin() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log("Connected to MongoDB");

    // Get admin credentials from environment
    const adminEmail = process.env.INITIAL_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME || "Administrator";

    if (!adminEmail || !adminPassword) {
      console.error("Missing required environment variables:");
      console.error("INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD (or ADMIN_EMAIL and ADMIN_PASSWORD) must be set");
      process.exit(1);
    }

    // Validate email domain
    if (!adminEmail.endsWith("@testprepkart.com")) {
      console.error("ADMIN_EMAIL must be a testprepkart.com email address");
      process.exit(1);
    }

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: adminEmail.toLowerCase() });
    if (existingAdmin) {
      console.log(`Admin user ${adminEmail} already exists`);
      
      // Update password if FORCE_UPDATE_ADMIN is set
      if (process.env.FORCE_UPDATE_ADMIN === "1") {
        existingAdmin.password = adminPassword;
        existingAdmin.role = "admin";
        existingAdmin.isActive = true;
        await existingAdmin.save();
        console.log("Admin user password updated");
      }
      
      process.exit(0);
    }

    // Create admin user
    const adminUser = new User({
      email: adminEmail.toLowerCase(),
      name: adminName,
      password: adminPassword,
      role: "admin",
      isActive: true
    });

    await adminUser.save();
    console.log(`✅ Admin user created successfully:`);
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Name: ${adminName}`);
    console.log(`   Role: admin`);
    console.log(`   Status: active`);

  } catch (error) {
    console.error("Error seeding admin user:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  seedAdmin();
}

export { seedAdmin };
