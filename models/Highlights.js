const mongoose = require("mongoose");

const highlightSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [150, "Title cannot exceed 150 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    // Each highlight can have multiple media items (images or videos)
    media: [
      {
        url: {
          type: String,
          required: true,
        },
        publicId: {
          type: String,   // Cloudinary public_id — needed for deletion
          required: true,
        },
        resourceType: {
          type: String,
          enum: ["image", "video"],
          required: true,
        },
        thumbnailUrl: {
          type: String,   // Auto-generated thumbnail for videos
        },
      },
    ],
    isPublished: {
      type: Boolean,
      default: true,
    },
    // Optional: link this highlight to an event
    relatedEvent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  { timestamps: true }
);

highlightSchema.index({ isPublished: 1, createdAt: -1 });

module.exports = mongoose.model("Highlight", highlightSchema);