import { User } from "../models/user.model.js";

/**
 * Phase 15: Authoritative domain service for user profile retrieval.
 * Provides explicit safe-field whitelisting and strictly excludes passwords,
 * authentication tokens, and user gender (per Phase 15 requirements).
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.userId
 * @returns {Promise<Object>}
 */
export const getUserProfileService = async ({ userId }) => {
  if (!userId) {
    return { success: false, error: "UNAUTHORIZED", message: "Authenticated user identity required." };
  }

  let userDoc = null;
  if (User?.findById) {
    const query = User.findById(userId);
    // Explicit safe-field whitelist projection
    if (query?.select) {
      userDoc = await query
        .select("employeeId name email role branch country department designation block floor joiningDate phone isActive")
        .lean();
    } else if (query?.lean) {
      userDoc = await query.lean();
    } else {
      userDoc = await query;
    }
  }

  if (!userDoc) {
    return { success: false, error: "NOT_FOUND", message: "User profile not found." };
  }

  return {
    success: true,
    profile: {
      employeeId: userDoc.employeeId || "",
      name: userDoc.name || "",
      email: userDoc.email || "",
      role: userDoc.role || "employee",
      branch: userDoc.branch || "",
      country: userDoc.country || "",
      department: userDoc.department || "",
      designation: userDoc.designation || "",
      block: userDoc.block || "",
      floor: userDoc.floor || "",
      joiningDate: userDoc.joiningDate ? new Date(userDoc.joiningDate).toISOString().split("T")[0] : null,
      phone: userDoc.phone || "",
    },
  };
};
