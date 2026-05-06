const express = require("express");
const router = express.Router();
const Highlight = require("../models/Highlights");

// GET /api/highlights — all published highlights (public)
router.get("/", async (req, res) => {
  try {
    const highlights = await Highlight.find({ isPublished: true })
      .populate("relatedEvent", "title date")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: highlights.length, data: highlights });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
});

// GET /api/highlights/:id — single highlight (public)
router.get("/:id", async (req, res) => {
  try {
    const highlight = await Highlight.findOne({ _id: req.params.id, isPublished: true }).populate(
      "relatedEvent",
      "title date"
    );
    if (!highlight) {
      return res.status(404).json({ success: false, message: "Highlight not found." });
    }
    res.json({ success: true, data: highlight });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid highlight ID." });
    }
    res.status(500).json({ success: false, message: "Server error." });
  }
});

module.exports = router;