const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const Admin = require("../models/Admin");
const Event = require("../models/Event");
const Registration = require("../models/Registration");
const Highlight = require("../models/Highlights");
const { protect, superAdminOnly } = require("../middleware/auth");
const {
  uploadEventImage,
  uploadHighlights,
  deleteFromCloudinary,
} = require("../config/cloudinary");

// Helper to sign JWT
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

// Multer error handler middleware
const handleMulterError = (err, req, res, next) => {
  if (err && err.message) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
};

// ─── POST /api/admin/login ────────────────────────────────────────────────────
router.post(
  "/login",
  [
    body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { email, password } = req.body;
      const admin = await Admin.findOne({ email }).select("+password");
      if (!admin || !(await admin.comparePassword(password))) {
        return res
          .status(401)
          .json({ success: false, message: "Invalid email or password." });
      }
      if (!admin.isActive) {
        return res
          .status(401)
          .json({ success: false, message: "Account is inactive." });
      }
      admin.lastLogin = new Date();
      await admin.save({ validateBeforeSave: false });
      const token = signToken(admin._id);
      res.json({
        success: true,
        token,
        admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
      });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ success: false, message: "Server error." });
    }
  }
);

// ─── GET /api/admin/me ────────────────────────────────────────────────────────
router.get("/me", protect, (req, res) => {
  res.json({
    success: true,
    admin: {
      id: req.admin._id,
      name: req.admin.name,
      email: req.admin.email,
      role: req.admin.role,
      lastLogin: req.admin.lastLogin,
    },
  });
});

// ════════════════════════════════════════════════════════
// EVENT MANAGEMENT (Admin Protected)
// ════════════════════════════════════════════════════════

// GET /api/admin/events
router.get("/events", protect, async (req, res) => {
  try {
    const { status, category } = req.query;
    const filter = {};
    if (status === "published") filter.isPublished = true;
    if (status === "unpublished") filter.isPublished = false;
    if (status === "past") filter.date = { $lt: new Date() };
    if (status === "upcoming") filter.date = { $gte: new Date() };
    if (category) filter.category = category;

    const events = await Event.find(filter)
      .populate("registrationCount")
      .populate("createdBy", "name email")
      .sort({ date: -1 });

    res.json({ success: true, count: events.length, data: events });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
});

// POST /api/admin/events — create event (with optional flyer image)
// Field name for image upload must be "image" in the form-data
router.post(
  "/events",
  protect,
  uploadEventImage.single("image"),  // ← handles the file upload
  handleMulterError,
  [
    body("title").trim().notEmpty().withMessage("Title is required"),
    body("description").trim().notEmpty().withMessage("Description is required"),
    body("date").isISO8601().withMessage("Valid date required"),
    body("time").trim().notEmpty().withMessage("Time is required"),
    body("location").trim().notEmpty().withMessage("Location is required"),
    body("category").optional().isIn([
      "Sunday Service", "Prayer Meeting", "Bible Study",
      "Youth Program", "Special Event", "Conference", "Outreach", "Other",
    ]),
    body("capacity").optional().isInt({ min: 1 }),
    body("registrationRequired").optional().isBoolean(),
    body("registrationDeadline").optional().isISO8601(),
    body("isPublished").optional().isBoolean(),
    body("isFeatured").optional().isBoolean(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // If validation fails but a file was uploaded, delete it from Cloudinary
      if (req.file?.filename) {
        await deleteFromCloudinary(req.file.filename).catch(() => {});
      }
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const eventData = { ...req.body, createdBy: req.admin._id };

      // Attach Cloudinary image URL if a file was uploaded
      if (req.file) {
        eventData.imageUrl = req.file.path;           // Cloudinary secure URL
        eventData.imagePublicId = req.file.filename;  // Public ID for future deletion
      }

      const event = await Event.create(eventData);
      res.status(201).json({
        success: true,
        message: "Event created successfully.",
        data: event,
      });
    } catch (error) {
      console.error("Create event error:", error);
      res.status(500).json({ success: false, message: "Server error." });
    }
  }
);

// PUT /api/admin/events/:id — update event (optionally replace flyer)
router.put(
  "/events/:id",
  protect,
  uploadEventImage.single("image"),
  handleMulterError,
  async (req, res) => {
    try {
      const existingEvent = await Event.findById(req.params.id);
      if (!existingEvent) {
        return res.status(404).json({ success: false, message: "Event not found." });
      }

      const updateData = { ...req.body };

      if (req.file) {
        // Delete the old image from Cloudinary if one existed
        if (existingEvent.imagePublicId) {
          await deleteFromCloudinary(existingEvent.imagePublicId).catch(() => {});
        }
        updateData.imageUrl = req.file.path;
        updateData.imagePublicId = req.file.filename;
      }

      const event = await Event.findByIdAndUpdate(req.params.id, updateData, {
        new: true,
        runValidators: true,
      });

      res.json({ success: true, message: "Event updated.", data: event });
    } catch (error) {
      if (error.name === "CastError") {
        return res.status(400).json({ success: false, message: "Invalid event ID." });
      }
      res.status(500).json({ success: false, message: "Server error." });
    }
  }
);

// DELETE /api/admin/events/:id
router.delete("/events/:id", protect, async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found." });
    }
    // Delete flyer from Cloudinary
    if (event.imagePublicId) {
      await deleteFromCloudinary(event.imagePublicId).catch(() => {});
    }
    await Registration.deleteMany({ event: req.params.id });
    res.json({
      success: true,
      message: "Event and all its registrations have been deleted.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
});

// ════════════════════════════════════════════════════════
// HIGHLIGHTS MANAGEMENT (Admin Protected)
// ════════════════════════════════════════════════════════

// GET /api/admin/highlights — all highlights
router.get("/highlights", protect, async (req, res) => {
  try {
    const highlights = await Highlight.find()
      .populate("createdBy", "name email")
      .populate("relatedEvent", "title date")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: highlights.length, data: highlights });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
});

// POST /api/admin/highlights — create highlight with media uploads
// Field name must be "media" in the form-data (supports multiple files)
router.post(
  "/highlights",
  protect,
  uploadHighlights.array("media", 10),  // up to 10 files at once
  handleMulterError,
  [
    body("title").trim().notEmpty().withMessage("Title is required"),
    body("description").optional().trim(),
    body("isPublished").optional().isBoolean(),
    body("relatedEvent").optional().isMongoId(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Cleanup any uploaded files on validation error
      if (req.files?.length) {
        for (const file of req.files) {
          const isVideo = file.mimetype?.startsWith("video/");
          await deleteFromCloudinary(file.filename, isVideo ? "video" : "image").catch(() => {});
        }
      }
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please upload at least one image or video.",
      });
    }

    try {
      // Build media array from uploaded files
      const media = req.files.map((file) => {
        const isVideo = file.mimetype?.startsWith("video/");
        return {
          url: file.path,             // Cloudinary secure URL
          publicId: file.filename,   // Cloudinary public_id
          resourceType: isVideo ? "video" : "image",
          // For videos, Cloudinary can auto-generate a thumbnail
          thumbnailUrl: isVideo
            ? file.path.replace("/upload/", "/upload/so_0/").replace(/\.[^.]+$/, ".jpg")
            : null,
        };
      });

      const highlight = await Highlight.create({
        title: req.body.title,
        description: req.body.description,
        isPublished: req.body.isPublished,
        relatedEvent: req.body.relatedEvent || null,
        media,
        createdBy: req.admin._id,
      });

      res.status(201).json({
        success: true,
        message: "Highlight created successfully.",
        data: highlight,
      });
    } catch (error) {
      console.error("Create highlight error:", error);
      res.status(500).json({ success: false, message: "Server error." });
    }
  }
);

// PUT /api/admin/highlights/:id — update title/description/published status
router.put("/highlights/:id", protect, async (req, res) => {
  try {
    const { title, description, isPublished, relatedEvent } = req.body;
    const highlight = await Highlight.findByIdAndUpdate(
      req.params.id,
      { title, description, isPublished, relatedEvent },
      { new: true, runValidators: true }
    );
    if (!highlight) {
      return res.status(404).json({ success: false, message: "Highlight not found." });
    }
    res.json({ success: true, message: "Highlight updated.", data: highlight });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
});

// POST /api/admin/highlights/:id/media — add more media to an existing highlight
router.post(
  "/highlights/:id/media",
  protect,
  uploadHighlights.array("media", 10),
  handleMulterError,
  async (req, res) => {
    try {
      const highlight = await Highlight.findById(req.params.id);
      if (!highlight) {
        return res.status(404).json({ success: false, message: "Highlight not found." });
      }
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, message: "No files uploaded." });
      }

      const newMedia = req.files.map((file) => {
        const isVideo = file.mimetype?.startsWith("video/");
        return {
          url: file.path,
          publicId: file.filename,
          resourceType: isVideo ? "video" : "image",
          thumbnailUrl: isVideo
            ? file.path.replace("/upload/", "/upload/so_0/").replace(/\.[^.]+$/, ".jpg")
            : null,
        };
      });

      highlight.media.push(...newMedia);
      await highlight.save();

      res.json({ success: true, message: "Media added.", data: highlight });
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error." });
    }
  }
);

// DELETE /api/admin/highlights/:id/media/:publicId — remove a single media item
router.delete("/highlights/:id/media/:publicId", protect, async (req, res) => {
  try {
    const highlight = await Highlight.findById(req.params.id);
    if (!highlight) {
      return res.status(404).json({ success: false, message: "Highlight not found." });
    }

    // Decode the publicId from URL (Cloudinary IDs contain slashes)
    const publicId = decodeURIComponent(req.params.publicId);
    const mediaItem = highlight.media.find((m) => m.publicId === publicId);

    if (!mediaItem) {
      return res.status(404).json({ success: false, message: "Media item not found." });
    }

    // Remove from Cloudinary
    await deleteFromCloudinary(publicId, mediaItem.resourceType).catch(() => {});

    // Remove from DB
    highlight.media = highlight.media.filter((m) => m.publicId !== publicId);
    await highlight.save();

    res.json({ success: true, message: "Media removed.", data: highlight });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
});

// DELETE /api/admin/highlights/:id — delete entire highlight + all its media
router.delete("/highlights/:id", protect, async (req, res) => {
  try {
    const highlight = await Highlight.findByIdAndDelete(req.params.id);
    if (!highlight) {
      return res.status(404).json({ success: false, message: "Highlight not found." });
    }
    // Delete all media from Cloudinary
    for (const item of highlight.media) {
      await deleteFromCloudinary(item.publicId, item.resourceType).catch(() => {});
    }
    res.json({ success: true, message: "Highlight deleted." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
});

// ════════════════════════════════════════════════════════
// REGISTRATION MANAGEMENT (Admin Protected)
// ════════════════════════════════════════════════════════

router.get("/registrations/:eventId", protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found." });
    }
    const registrations = await Registration.find({ event: req.params.eventId }).sort({ createdAt: -1 });
    const stats = {
      total: registrations.length,
      confirmed: registrations.filter((r) => r.status === "confirmed").length,
      cancelled: registrations.filter((r) => r.status === "cancelled").length,
      members: registrations.filter((r) => r.isMember).length,
      totalGuests: registrations.reduce((sum, r) => sum + r.numberOfGuests, 0),
    };
    res.json({
      success: true,
      event: { id: event._id, title: event.title, date: event.date },
      stats,
      data: registrations,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid event ID." });
    }
    res.status(500).json({ success: false, message: "Server error." });
  }
});

router.get("/registrations", protect, async (req, res) => {
  try {
    const registrations = await Registration.find()
      .populate("event", "title date")
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, count: registrations.length, data: registrations });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
});

router.patch("/registrations/:id/status", protect, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["pending", "confirmed", "cancelled"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status." });
    }
    const registration = await Registration.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!registration) {
      return res.status(404).json({ success: false, message: "Registration not found." });
    }
    res.json({ success: true, message: `Status updated to ${status}.`, data: registration });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
});

// ════════════════════════════════════════════════════════
// ADMIN USER MANAGEMENT (Superadmin only)
// ════════════════════════════════════════════════════════

router.post(
  "/create",
  protect,
  superAdminOnly,
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
    body("role").optional().isIn(["admin", "superadmin"]),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    try {
      const { name, email, password, role } = req.body;
      const admin = await Admin.create({ name, email, password, role });
      res.status(201).json({
        success: true,
        message: "Admin created successfully.",
        data: { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ success: false, message: "Email already in use." });
      }
      res.status(500).json({ success: false, message: "Server error." });
    }
  }
);

// GET /api/admin/dashboard
router.get("/dashboard", protect, async (req, res) => {
  try {
    const now = new Date();
    const [totalEvents, upcomingEvents, totalRegistrations, recentRegistrations, totalHighlights] =
      await Promise.all([
        Event.countDocuments(),
        Event.countDocuments({ date: { $gte: now }, isPublished: true }),
        Registration.countDocuments(),
        Registration.find().sort({ createdAt: -1 }).limit(5).populate("event", "title date"),
        Highlight.countDocuments(),
      ]);

    res.json({
      success: true,
      data: { totalEvents, upcomingEvents, totalRegistrations, recentRegistrations, totalHighlights },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
});

module.exports = router;