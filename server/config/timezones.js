/**
 * Authoritative branch-to-timezone mapping grounded strictly in repository truth.
 * Verified branches in seed data: Bangalore, Hyderabad, Chennai (all located in India).
 */
export const SUPPORTED_BRANCH_TIMEZONES = Object.freeze({
  "Bangalore": "Asia/Kolkata",
  "Hyderabad": "Asia/Kolkata",
  "Chennai":   "Asia/Kolkata"
});

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

/**
 * Resolves IANA timezone from a branch name.
 * - If branch is recognized (case-insensitive): returns authoritative IANA timezone string.
 * - If branch is explicitly specified but unrecognized: returns null (caller must reject / clarify).
 * - If branch is null/undefined/empty: returns DEFAULT_TIMEZONE.
 *
 * @param {string | null | undefined} branchName
 * @returns {string | null} IANA timezone or null if unrecognized
 */
export const resolveBranchTimezone = (branchName) => {
  if (!branchName || typeof branchName !== "string" || !branchName.trim()) {
    return DEFAULT_TIMEZONE;
  }
  const normalized = branchName.trim().toLowerCase();
  const matchedKey = Object.keys(SUPPORTED_BRANCH_TIMEZONES).find(
    (b) => b.toLowerCase() === normalized
  );
  return matchedKey ? SUPPORTED_BRANCH_TIMEZONES[matchedKey] : null;
};

/**
 * Validates whether a specified branch is in the supported repository branches.
 * @param {string} branchName
 * @returns {boolean}
 */
export const isSupportedBranch = (branchName) => {
  if (!branchName || typeof branchName !== "string") return false;
  const normalized = branchName.trim().toLowerCase();
  return Object.keys(SUPPORTED_BRANCH_TIMEZONES).some(
    (b) => b.toLowerCase() === normalized
  );
};
