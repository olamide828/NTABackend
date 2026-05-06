const mongoose = require("mongoose");

const registrationSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: [true, "Event reference is required"],
    },
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    numberOfGuests: {
      type: Number,
      default: 1,
      min: [1, "At least 1 person required"],
      max: [10, "Cannot register more than 10 people at once"],
    },
    isMember: {
      type: Boolean,
      default: false, // Whether they're a church member
    },
    notes: {
      type: String,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "confirmed",
    },
    confirmationCode: {
      type: String,
      unique: true,
    },
  },
  { timestamps: true }
);

// Generate confirmation code before saving
registrationSchema.pre("save", function (next) {
  if (!this.confirmationCode) {
    const prefix = "TP"; // Testimony Parish
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
    this.confirmationCode = `${prefix}-${random}-${timestamp}`;
  }
  next();
});

// Compound index: prevent same email registering twice for same event
registrationSchema.index({ event: 1, email: 1 }, { unique: true });

module.exports = mongoose.model("Registration", registrationSchema);
