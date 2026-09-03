import { resolveBranchTimezone, DEFAULT_TIMEZONE } from "../config/timezones.js";
import { getAuthorizedCapabilities } from "./ai-capabilities.js";

/**
 * Server-Authoritative AI Context Builder
 *
 * Derives and freezes the authenticated runtime context for an AI conversation turn.
 * The client and LLM CANNOT tamper with or override:
 * - userId
 * - role
 * - branch authorization
 * - allowed capabilities
 *
 * @param {Object} reqUser - Authenticated user document (req.user)
 * @param {Object} [options] - Optional overrides like requested branch (validated)
 * @returns {Readonly<Object>}
 */
export const createAiContext = (reqUser, options = {}) => {
  if (!reqUser || !reqUser._id) {
    throw new Error("Cannot create AI context without authenticated user");
  }

  const userId = String(reqUser._id);
  const role = String(reqUser.role || "employee").toLowerCase().trim();
  const defaultBranch = String(reqUser.branch || "").trim();
  const country = String(reqUser.country || "India").trim();

  // Validate branch if explicitly provided in options
  let activeBranch = defaultBranch;
  if (options.requestedBranch && typeof options.requestedBranch === "string") {
    const candidate = options.requestedBranch.trim();
    if (resolveBranchTimezone(candidate) !== null) {
      activeBranch = candidate;
    }
  }

  // Authoritative timezone resolution
  const timeZone = resolveBranchTimezone(activeBranch) || DEFAULT_TIMEZONE;

  // Compute local date and time in the resolved branch timezone
  const now = new Date();
  const currentDate = now.toLocaleDateString("en-CA", { timeZone }); // YYYY-MM-DD
  const currentTime = now.toLocaleTimeString("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" }); // HH:mm

  // Fetch authorized capabilities for this user's role
  const allowedCapabilities = Object.freeze(getAuthorizedCapabilities(role));

  return Object.freeze({
    userId,
    user: reqUser,
    role,
    branch: activeBranch,
    country,
    timeZone,
    currentDate,
    currentTime,
    allowedCapabilities,
    /**
     * Helper to verify if an action key is authorized in this context
     */
    isAuthorized: (capabilityKey) => allowedCapabilities.includes(capabilityKey),
  });
};
