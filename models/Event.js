const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Event title is required"],
      trim: true,
      maxlength: [150, "Title cannot exceed 150 characters"],
    },
    description: {
      type: String,
      required: [true, "Event description is required"],
      trim: true,
    },
    date: {
      type: Date,
      required: [true, "Event date is required"],
    },
    endDate: {
      type: Date,
    },
    time: {
      type: String,
      required: [true, "Event time is required"],
    },
    location: {
      type: String,
      required: [true, "Event location is required"],
      trim: true,
    },
    category: {
      type: String,
      enum: [
        "Sunday Service",
        "Prayer Meeting",
        "Bible Study",
        "Youth Program",
        "Special Event",
        "Conference",
        "Outreach",
        "Other",
      ],
      default: "Special Event",
    },
    imageUrl: {
      type: String,   // Cloudinary secure URL
    },
    imagePublicId: {
      type: String,   // Cloudinary public_id — needed to delete the image later
    },
    capacity: {
      type: Number,
      default: null,
    },
    registrationRequired: {
      type: Boolean,
      default: true,
    },
    registrationDeadline: {
      type: Date,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

eventSchema.virtual("registrationCount", {
  ref: "Registration",
  localField: "_id",
  foreignField: "event",
  count: true,
});

eventSchema.index({ date: 1, isPublished: 1 });
eventSchema.index({ isFeatured: 1 });

module.exports = mongoose.model("Event", eventSchema);