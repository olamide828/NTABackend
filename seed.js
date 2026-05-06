/**
 * Seed Script — Run ONCE to create the first superadmin
 * Usage: node seed.js
 * Delete or secure this file after running!
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Admin = require("./models/Admin");

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const existingAdmin = await Admin.findOne({ email: process.env.ADMIN_EMAIL });
    if (existingAdmin) {
      console.log("⚠️  Superadmin already exists. Exiting.");
      process.exit(0);
    }

    const admin = await Admin.create({
      name: "Parish Administrator",
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      role: "superadmin",
    });

    console.log("✅ Superadmin created successfully:");
    console.log(`   Email: ${admin.email}`);
    console.log(`   Role: ${admin.role}`);
    console.log("\n⚠️  IMPORTANT: Delete ADMIN_EMAIL and ADMIN_PASSWORD from your .env after this!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seed failed:", error.message);
    process.exit(1);
  }
};

seed();
