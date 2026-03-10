import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    country: { type: String, required: true, trim: true },
    branch: { type: String, required: true, trim: true },
    block: { type: String, required: true, trim: true },
    floor: { type: String, required: true, trim: true },
    roomNumber: { type: String, required: true, trim: true },
    roomType: {
      type: String,
      enum: ["Conference Room", "Meeting Room (10 members)", "Meeting Room (5 members)"],
      required: true
    },
    capacity: { type: Number, required: true, min: 1 },
    imageUrl: { type: String, default: "", trim: true },
    amenities: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    secretCode: {
      type: String,
      default: () => String(Math.floor(100000 + Math.random() * 900000)),
      trim: true
    }
  },
  { timestamps: true }
);

roomSchema.index({ country: 1, branch: 1, block: 1, floor: 1, roomNumber: 1 }, { unique: true });

export const Room = mongoose.model("Room", roomSchema);
