require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const eventRoutes = require("./routes/events");
const adminRoutes = require("./routes/admin");
const highlightRoutes = require("./routes/highlights");

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Database Connection ──────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// NOTE: Do NOT use express.json() before multer routes — multer handles multipart parsing.
// express.json() only applies to application/json requests, so it's safe to keep both.
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: "Too many attempts. Please try again later.",
  },
});

app.use("/api", generalLimiter);
app.use("/api/events/:id/register", strictLimiter);
app.use("/api/admin/login", strictLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/events", eventRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/highlights", highlightRoutes); // ← new public highlights route

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Testimony Parish API is running 🙏",
    timestamp: new Date().toISOString(),
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res
    .status(500)
    .json({ success: false, message: "An unexpected error occurred." });
});

app.listen(PORT, () => {
  console.log(`\n🙏 Testimony Parish Backend running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});
