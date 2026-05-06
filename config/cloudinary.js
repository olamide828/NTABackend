const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

// Configure Cloudinary with your credentials from .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Storage for Event Flyers (images only) ───────────────────────────────────
const eventImageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "testimony-parish/events",       // Organizes uploads in Cloudinary
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 1200, height: 630, crop: "fill", quality: "auto" }],
  },
});

// ─── Storage for Highlights (images + videos) ────────────────────────────────
const highlightStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith("video/");
    return {
      folder: "testimony-parish/highlights",
      resource_type: isVideo ? "video" : "image",
      allowed_formats: isVideo
        ? ["mp4", "mov", "avi", "mkv", "webm"]
        : ["jpg", "jpeg", "png", "webp", "gif"],
      transformation: isVideo
        ? [{ quality: "auto" }]
        : [{ width: 1080, height: 1080, crop: "fill", quality: "auto" }],
    };
  },
});

// ─── Multer upload instances ──────────────────────────────────────────────────

// Single image for event flyers (max 5MB)
const uploadEventImage = multer({
  storage: eventImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed for event flyers."), false);
    }
    cb(null, true);
  },
});

// Multiple files for highlights — up to 10 at once (images: 10MB, videos: 100MB)
const uploadHighlights = multer({
  storage: highlightStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isImage = file.mimetype.startsWith("image/");
    const isVideo = file.mimetype.startsWith("video/");
    if (!isImage && !isVideo) {
      return cb(new Error("Only image and video files are allowed."), false);
    }
    cb(null, true);
  },
});

// Helper to delete a file from Cloudinary by its public_id
const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};

module.exports = {
  cloudinary,
  uploadEventImage,
  uploadHighlights,
  deleteFromCloudinary,
};