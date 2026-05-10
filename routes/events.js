const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const Event = require("../models/Event");
const Registration = require("../models/Registration");

// ─── GET /api/events ─────────────────────────────────────────────────────────
// Get all upcoming published events (public)
router.get("/", async (req, res) => {
  try {
    const { category, featured } = req.query;

    const filter = {
      isPublished: true,
      date: { $gte: new Date() }, // Only upcoming events
    };

    if (category) filter.category = category;
    if (featured === "true") filter.isFeatured = true;

    const events = await Event.find(filter)
      .populate("registrationCount")
      .sort({ date: 1 }) // Soonest first
      .select("-createdBy");

    res.json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (error) {
    console.error("GET /events error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
});

// ─── GET /api/events/:id ──────────────────────────────────────────────────────
// Get single event details (public)
router.get("/:id", async (req, res) => {
  try {
    const event = await Event.findOne({
      _id: req.params.id,
      isPublished: true,
    }).populate("registrationCount");

    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found." });
    }

    // Check if event is at capacity
    const isFull =
      event.capacity !== null && event.registrationCount >= event.capacity;

    res.json({
      success: true,
      data: { ...event.toJSON(), isFull },
    });
  } catch (error) {
    console.error("GET /events/:id error:", error);
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid event ID." });
    }
    res.status(500).json({ success: false, message: "Server error." });
  }
});

// Add this to your routes/events.js (public route)
router.get('/verify/:code', async (req, res) => {
  try {
    const registration = await Registration.findOne({
      confirmationCode: req.params.code.toUpperCase()
    }).populate('event', 'title date time location category imageUrl')

    if (!registration) {
      return res.status(404).json({ success: false, message: 'No registration found for this code.' })
    }

    res.json({
      success: true,
      data: {
        confirmationCode: registration.confirmationCode,
        name: `${registration.firstName} ${registration.lastName}`,
        email: registration.email,
        numberOfGuests: registration.numberOfGuests,
        status: registration.status,
        event: registration.event,
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
});

// ─── POST /api/events/:id/register ───────────────────────────────────────────
// Register for an event (public)
router.post(
  "/:id/register",
  [
    body("firstName").trim().notEmpty().withMessage("First name is required"),
    body("lastName").trim().notEmpty().withMessage("Last name is required"),
    body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
    body("phone").optional().trim(),
    body("numberOfGuests")
      .optional()
      .isInt({ min: 1, max: 10 })
      .withMessage("Guests must be between 1 and 10"),
    body("isMember").optional().isBoolean(),
    body("notes").optional().trim().isLength({ max: 500 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const event = await Event.findOne({
        _id: req.params.id,
        isPublished: true,
      }).populate("registrationCount");

      if (!event) {
        return res
          .status(404)
          .json({ success: false, message: "Event not found." });
      }

      // Check if registration is required / open
      if (!event.registrationRequired) {
        return res.status(400).json({
          success: false,
          message: "This event does not require registration.",
        });
      }

      // Check registration deadline
      if (
        event.registrationDeadline &&
        new Date() > event.registrationDeadline
      ) {
        return res.status(400).json({
          success: false,
          message: "Registration deadline has passed.",
        });
      }

      // Check capacity
      if (event.capacity !== null && event.registrationCount >= event.capacity) {
        return res.status(400).json({
          success: false,
          message: "This event is fully booked.",
        });
      }

      const { firstName, lastName, email, phone, numberOfGuests, isMember, notes } =
        req.body;

      const registration = await Registration.create({
        event: event._id,
        firstName,
        lastName,
        email,
        phone,
        numberOfGuests: numberOfGuests || 1,
        isMember: isMember || false,
        notes,
      });

      res.status(201).json({
        success: true,
        message: "Registration successful! We look forward to seeing you.",
        data: {
          confirmationCode: registration.confirmationCode,
          event: event.title,
          date: event.date,
          time: event.time,
          location: event.location,
          name: `${firstName} ${lastName}`,
        },
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "You have already registered for this event with this email.",
        });
      }
      if (error.name === "CastError") {
        return res.status(400).json({ success: false, message: "Invalid event ID." });
      }
      console.error("POST /events/:id/register error:", error);
      res.status(500).json({ success: false, message: "Server error." });
    }
  }
);

module.exports = router;
