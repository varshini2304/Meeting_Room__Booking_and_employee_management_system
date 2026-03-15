import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    gender: { type: String, enum: ["female", "male", "other", "unspecified"], default: "unspecified" },
    role: { type: String, enum: ["employee", "manager"], default: "employee" },
    country: { type: String, default: "" },
    branch: { type: String, default: "" },
    block: { type: String, default: "" },
    floor: { type: String, default: "" },
    department: { type: String, default: "", trim: true },
    designation: { type: String, default: "", trim: true },
    joiningDate: { type: Date, default: null },
    reportingManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    phone: { type: String, default: "", trim: true },
    avatarUrl: { type: String, default: "", trim: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model("User", userSchema);

