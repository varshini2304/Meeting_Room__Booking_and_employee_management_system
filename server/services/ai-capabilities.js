/**
 * Centralized AI Capability Registry (Phase 7 Foundation)
 *
 * Defines all recognized AI capabilities across application domains.
 * Enforces server-side authorization:
 * - domain + action structure
 * - read vs write/staged classification
 * - allowed roles (employee vs manager)
 * - backward compatibility mapping to legacy 5 intents
 */

export const SUPPORTED_DOMAINS = Object.freeze([
  "BOOKING",
  "ATTENDANCE",
  "LEAVE",
  "MANAGER",
  "NOTIFICATIONS",
  "PROFILE",
  "NAVIGATION",
  "ROOM",
  "GENERAL",
]);

/**
 * Registry of all domain capabilities.
 * Note: Write actions are classified as WRITE_STAGED, meaning the LLM
 * can only stage intents or present action cards; actual writes MUST execute
 * via authoritative REST endpoints with explicit user confirmation.
 */
export const CAPABILITY_REGISTRY = Object.freeze({
  // ── BOOKING DOMAIN (Fully Implemented & Active) ──────────────────────────
  "BOOKING:SEARCH": {
    domain: "BOOKING",
    action: "SEARCH",
    classification: "READ",
    allowedRoles: ["employee", "manager"],
    description: "Search and inspect available meeting rooms in a branch or slot",
    legacyIntent: "SEARCH_ROOMS",
  },
  "BOOKING:BOOK": {
    domain: "BOOKING",
    action: "BOOK",
    classification: "WRITE_STAGED",
    allowedRoles: ["employee", "manager"],
    description: "Stage a 10-minute temporary room reservation intent requiring explicit user confirmation",
    legacyIntent: "BOOK_ROOM",
  },
  "BOOKING:MY_BOOKINGS": {
    domain: "BOOKING",
    action: "MY_BOOKINGS",
    classification: "READ",
    allowedRoles: ["employee", "manager"],
    description: "Retrieve active upcoming reservations belonging to the authenticated user",
    legacyIntent: "MY_BOOKINGS",
  },
  "BOOKING:CANCEL": {
    domain: "BOOKING",
    action: "CANCEL",
    classification: "WRITE_STAGED",
    allowedRoles: ["employee", "manager"],
    description: "Find an active reservation and present an actionable cancellation card",
    legacyIntent: "CANCEL_BOOKING",
  },
  "BOOKING:GET_DETAILS": {
    domain: "BOOKING",
    action: "GET_DETAILS",
    classification: "READ",
    allowedRoles: ["employee", "manager"],
    description: "Retrieve comprehensive details for a specific reservation belonging to authenticated user",
    legacyIntent: "MY_BOOKINGS",
  },
  "BOOKING:GET_STATUS": {
    domain: "BOOKING",
    action: "GET_STATUS",
    classification: "READ",
    allowedRoles: ["employee", "manager"],
    description: "Retrieve lifecycle and occupancy confirmation status for an employee booking",
    legacyIntent: "MY_BOOKINGS",
  },
  "BOOKING:GET_NEXT": {
    domain: "BOOKING",
    action: "GET_NEXT",
    classification: "READ",
    allowedRoles: ["employee", "manager"],
    description: "Retrieve the next strictly-future active meeting for authenticated employee",
    legacyIntent: "MY_BOOKINGS",
  },
  "BOOKING:GET_UPCOMING": {
    domain: "BOOKING",
    action: "GET_UPCOMING",
    classification: "READ",
    allowedRoles: ["employee", "manager"],
    description: "Retrieve upcoming active reservations for today, tomorrow, or upcoming schedule",
    legacyIntent: "MY_BOOKINGS",
  },

  // ── GENERAL DOMAIN (Fully Implemented & Active) ──────────────────────────
  "GENERAL:HELP": {
    domain: "GENERAL",
    action: "HELP",
    classification: "READ",
    allowedRoles: ["employee", "manager"],
    description: "General system assistance, navigation, and operational rules",
    legacyIntent: "GENERAL_HELP",
  },

  // ── ATTENDANCE DOMAIN (Phase 8 Employee Attendance) ────────────────────
  "ATTENDANCE:GET_TODAY": {
    domain: "ATTENDANCE",
    action: "GET_TODAY",
    classification: "READ",
    allowedRoles: ["employee", "manager"],
    description: "Check today's attendance record, punch-in time, punch-out time, work hours, and status",
  },
  "ATTENDANCE:GET_BY_DATE": {
    domain: "ATTENDANCE",
    action: "GET_BY_DATE",
    classification: "READ",
    allowedRoles: ["employee", "manager"],
    description: "Check personal attendance for a specific date (e.g. yesterday, specific date)",
  },
  "ATTENDANCE:GET_SUMMARY": {
    domain: "ATTENDANCE",
    action: "GET_SUMMARY",
    classification: "READ",
    allowedRoles: ["employee", "manager"],
    description: "Retrieve monthly attendance summary (total present, absent, late, work hours)",
  },
  "ATTENDANCE:GET_MY_SUMMARY": {
    domain: "ATTENDANCE",
    action: "GET_MY_SUMMARY",
    classification: "READ",
    allowedRoles: ["employee", "manager"],
    description: "Retrieve personal attendance history and monthly summary (alias for GET_SUMMARY)",
  },
  "ATTENDANCE:GET_HISTORY": {
    domain: "ATTENDANCE",
    action: "GET_HISTORY",
    classification: "READ",
    allowedRoles: ["employee", "manager"],
    description: "Retrieve recent attendance records or date range history",
  },
  "ATTENDANCE:PUNCH_IN": {
    domain: "ATTENDANCE",
    action: "PUNCH_IN",
    classification: "WRITE_STAGED",
    allowedRoles: ["employee", "manager"],
    description: "Stage attendance daily check-in requiring explicit user confirmation",
  },
  "ATTENDANCE:PUNCH_OUT": {
    domain: "ATTENDANCE",
    action: "PUNCH_OUT",
    classification: "WRITE_STAGED",
    allowedRoles: ["employee", "manager"],
    description: "Stage attendance daily check-out requiring explicit user confirmation",
  },

  // ── LEAVE DOMAIN (Phase 9 Employee Leave Capabilities) ─────────────────
  "LEAVE:GET_BALANCE": {
    domain: "LEAVE",
    action: "GET_BALANCE",
    classification: "READ",
    allowedRoles: ["employee", "manager"],
    description: "Check personal leave balance quotas and remaining days",
  },
  "LEAVE:GET_MY_REQUESTS": {
    domain: "LEAVE",
    action: "GET_MY_REQUESTS",
    classification: "READ",
    allowedRoles: ["employee", "manager"],
    description: "Retrieve personal leave history and request statuses (pending, approved, rejected)",
  },
  "LEAVE:GET_REQUEST_DETAILS": {
    domain: "LEAVE",
    action: "GET_REQUEST_DETAILS",
    classification: "READ",
    allowedRoles: ["employee", "manager"],
    description: "Inspect specific leave request status, details, and manager review/rejection notes",
  },
  "LEAVE:CHECK_ELIGIBILITY": {
    domain: "LEAVE",
    action: "CHECK_ELIGIBILITY",
    classification: "READ",
    allowedRoles: ["employee", "manager"],
    description: "Informational inquiry on whether leave can be taken on specific dates without staging an application",
  },
  "LEAVE:APPLY": {
    domain: "LEAVE",
    action: "APPLY",
    classification: "WRITE_STAGED",
    allowedRoles: ["employee", "manager"],
    description: "Stage a formal leave application request requiring explicit user confirmation",
  },

  // ── NOTIFICATION DOMAIN (Phase 10) ──────────────────────────────────────
  "NOTIFICATION:GET_MY_NOTIFICATIONS": {
    domain: "NOTIFICATION",
    action: "GET_MY_NOTIFICATIONS",
    classification: "READ",
    allowedRoles: ["employee", "manager"],
    description: "Retrieve recent system, invitation, and reminder notifications for authenticated employee",
  },
  "NOTIFICATION:GET_UNREAD": {
    domain: "NOTIFICATION",
    action: "GET_UNREAD",
    classification: "READ",
    allowedRoles: ["employee", "manager"],
    description: "Retrieve unread notifications and unread count for authenticated employee",
  },
  "NOTIFICATION:GET_NOTIFICATION_DETAILS": {
    domain: "NOTIFICATION",
    action: "GET_NOTIFICATION_DETAILS",
    classification: "READ",
    allowedRoles: ["employee", "manager"],
    description: "Inspect specific notification details scoped to authenticated employee",
  },

  // ── PROFILE DOMAIN (Phase 10) ───────────────────────────────────────────
  "PROFILE:GET_MY_PROFILE": {
    domain: "PROFILE",
    action: "GET_MY_PROFILE",
    classification: "READ",
    allowedRoles: ["employee", "manager"],
    description: "Retrieve authenticated employee profile information (name, role, branch, contact, designation)",
  },

  // ── NAVIGATION DOMAIN (Phase 10 & 12) ──────────────────────────────────
  "NAVIGATION:OPEN_EMPLOYEE_PAGE": {
    domain: "NAVIGATION",
    action: "OPEN_EMPLOYEE_PAGE",
    classification: "READ",
    allowedRoles: ["employee", "manager"],
    description: "Navigate to an allowlisted employee application destination",
  },
  "NAVIGATION:OPEN_MGR_PAGE": {
    domain: "NAVIGATION",
    action: "OPEN_MGR_PAGE",
    classification: "READ",
    allowedRoles: ["manager"],
    description: "Navigate to an allowlisted manager administration application destination",
  },

  // ── MANAGER BOOKINGS & ROOM INTELLIGENCE (Phase 12) ─────────────────────
  "BOOKING:GET_ALL": {
    domain: "BOOKING",
    action: "GET_ALL",
    classification: "READ",
    allowedRoles: ["manager"],
    description: "Retrieve all enterprise bookings (defaults to today, or date-scoped) across all employees",
  },
  "BOOKING:SEARCH_MANAGER": {
    domain: "BOOKING",
    action: "SEARCH_MANAGER",
    classification: "READ",
    allowedRoles: ["manager"],
    description: "Search and filter enterprise bookings by date, date range, branch, room, employee name, and status",
  },
  "BOOKING:GET_DETAILS_MGR": {
    domain: "BOOKING",
    action: "GET_DETAILS_MGR",
    classification: "READ",
    allowedRoles: ["manager"],
    description: "Retrieve comprehensive details for any enterprise booking by ID or indirect criteria",
  },
  "ROOM:GET_AVAILABILITY_MGR": {
    domain: "ROOM",
    action: "GET_AVAILABILITY_MGR",
    classification: "READ",
    allowedRoles: ["manager"],
    description: "Inspect enterprise room availability and occupancy status for a specific date and time slot",
  },
  "ROOM:GET_UTILIZATION_MGR": {
    domain: "ROOM",
    action: "GET_UTILIZATION_MGR",
    classification: "READ",
    allowedRoles: ["manager"],
    description: "Inspect room reservation and confirmed physical check-in counts within a date range",
  },

  // ── MANAGER ATTENDANCE INTELLIGENCE (Phase 13) ──────────────────────────
  "ATTENDANCE:GET_ALL_MANAGER": {
    domain: "ATTENDANCE",
    action: "GET_ALL_MANAGER",
    classification: "READ",
    allowedRoles: ["manager"],
    description: "Retrieve enterprise/team attendance records across all employees for a specific date (defaults to today)",
  },
  "ATTENDANCE:SEARCH_MANAGER": {
    domain: "ATTENDANCE",
    action: "SEARCH_MANAGER",
    classification: "READ",
    allowedRoles: ["manager"],
    description: "Search and filter enterprise attendance records by employee name, date, date range, month, status, or branch",
  },
  "ATTENDANCE:GET_EMPLOYEE_DETAILS_MANAGER": {
    domain: "ATTENDANCE",
    action: "GET_EMPLOYEE_DETAILS_MANAGER",
    classification: "READ",
    allowedRoles: ["manager"],
    description: "Retrieve comprehensive attendance details and work hours for a specific employee on a target date",
  },
  "ATTENDANCE:GET_DAILY_SUMMARY_MANAGER": {
    domain: "ATTENDANCE",
    action: "GET_DAILY_SUMMARY_MANAGER",
    classification: "READ",
    allowedRoles: ["manager"],
    description: "Retrieve daily team attendance summary breakdown (checked-in, checked-out, currently active, late, half-day, on-leave, marked absent, no attendance record)",
  },
  "ATTENDANCE:GET_MONTHLY_SUMMARY_MANAGER": {
    domain: "ATTENDANCE",
    action: "GET_MONTHLY_SUMMARY_MANAGER",
    classification: "READ",
    allowedRoles: ["manager"],
    description: "Retrieve monthly team or employee attendance summary and working-hour statistics",
  },
  "ATTENDANCE:GET_NOT_CHECKED_IN_MANAGER": {
    domain: "ATTENDANCE",
    action: "GET_NOT_CHECKED_IN_MANAGER",
    classification: "READ",
    allowedRoles: ["manager"],
    description: "Identify active employees in the roster who have not checked in for today or a specific date",
  },

  // ── MANAGER LEAVE INTELLIGENCE (Phase 14) ────────────────────────────────
  "LEAVE:GET_ALL_MANAGER": {
    domain: "LEAVE",
    action: "GET_ALL_MANAGER",
    classification: "READ",
    allowedRoles: ["manager"],
    description: "Retrieve enterprise leave requests across employees without forced status filtering",
  },
  "LEAVE:SEARCH_MANAGER": {
    domain: "LEAVE",
    action: "SEARCH_MANAGER",
    classification: "READ",
    allowedRoles: ["manager"],
    description: "Search and filter enterprise leave requests by employee, status, leave type, date range, or branch",
  },
  "LEAVE:GET_REQUEST_DETAILS_MGR": {
    domain: "LEAVE",
    action: "GET_REQUEST_DETAILS_MGR",
    classification: "READ",
    allowedRoles: ["manager"],
    description: "Retrieve full structured details of any enterprise leave request by ID or indirect criteria",
  },
  "LEAVE:GET_BALANCES_MGR": {
    domain: "LEAVE",
    action: "GET_BALANCES_MGR",
    classification: "READ",
    allowedRoles: ["manager"],
    description: "Inspect employee or roster leave quota balances and remaining days using authoritative calculations",
  },
  "LEAVE:GET_ACTIVE_TODAY": {
    domain: "LEAVE",
    action: "GET_ACTIVE_TODAY",
    classification: "READ",
    allowedRoles: ["manager"],
    description: "Identify employees on approved leave for today or a specific target date",
  },

  // ── MANAGER DOMAIN (Phase 7 Architectural Representation Only) ───────────
  "MANAGER:GET_TEAM_ATTENDANCE": {
    domain: "MANAGER",
    action: "GET_TEAM_ATTENDANCE",
    classification: "READ",
    allowedRoles: ["manager"],
    description: "View organization or branch live attendance board",
  },
  "MANAGER:APPROVE_LEAVE": {
    domain: "MANAGER",
    action: "APPROVE_LEAVE",
    classification: "WRITE_STAGED",
    allowedRoles: ["manager"],
    description: "Review and approve an employee leave request",
  },
  "MANAGER:GET_ROOM_METRICS": {
    domain: "MANAGER",
    action: "GET_ROOM_METRICS",
    classification: "READ",
    allowedRoles: ["manager"],
    description: "Inspect enterprise room occupancy and utilization metrics",
  },
});

/**
 * Builds the canonical capability key from domain and action.
 */
export const buildCapabilityKey = (domain, action) => {
  const d = String(domain || "").trim().toUpperCase();
  const a = String(action || "").trim().toUpperCase();
  return `${d}:${a}`;
};

/**
 * Resolves a capability definition by domain and action or canonical key.
 *
 * @param {string} domainOrKey - Either 'BOOKING' or 'BOOKING:SEARCH'
 * @param {string} [action] - 'SEARCH' if domainOrKey is 'BOOKING'
 * @returns {Object|null}
 */
export const resolveCapability = (domainOrKey, action) => {
  let key = "";
  if (action !== undefined) {
    key = buildCapabilityKey(domainOrKey, action);
  } else {
    key = String(domainOrKey || "").trim().toUpperCase();
    if (!key.includes(":")) {
      // Try mapping legacy intent
      return mapLegacyIntentToCapability(key);
    }
  }
  return CAPABILITY_REGISTRY[key] || null;
};

/**
 * Maps legacy 5 intents to canonical capability definition.
 * Backward compatibility guarantee for Architecture v2.2.
 */
export const mapLegacyIntentToCapability = (legacyIntent) => {
  const upper = String(legacyIntent || "").trim().toUpperCase();
  switch (upper) {
    case "BOOK_ROOM":
      return CAPABILITY_REGISTRY["BOOKING:BOOK"];
    case "SEARCH_ROOMS":
      return CAPABILITY_REGISTRY["BOOKING:SEARCH"];
    case "MY_BOOKINGS":
      return CAPABILITY_REGISTRY["BOOKING:MY_BOOKINGS"];
    case "CANCEL_BOOKING":
      return CAPABILITY_REGISTRY["BOOKING:CANCEL"];
    case "GENERAL_HELP":
    default:
      return CAPABILITY_REGISTRY["GENERAL:HELP"];
  }
};

/**
 * Maps a domain + action pair to the backward-compatible legacy intent string.
 */
export const mapDomainActionToLegacyIntent = (domain, action) => {
  const cap = resolveCapability(domain, action);
  return cap?.legacyIntent || "GENERAL_HELP";
};

/**
 * Validates whether an authenticated user role is authorized to perform a capability.
 * Server-side authoritative check. Never trusts LLM-provided roles.
 *
 * @param {string} capabilityKey - e.g. "MANAGER:GET_TEAM_ATTENDANCE"
 * @param {string} userRole - Verified role from req.user ("employee" | "manager")
 * @returns {boolean}
 */
export const isCapabilityAuthorized = (capabilityKey, userRole) => {
  const cap = resolveCapability(capabilityKey);
  if (!cap) return false;
  if (!userRole || typeof userRole !== "string") return false;
  return cap.allowedRoles.includes(userRole.toLowerCase().trim());
};

/**
 * Returns all capability keys authorized for a given user role.
 *
 * @param {string} userRole - "employee" | "manager"
 * @returns {string[]}
 */
export const getAuthorizedCapabilities = (userRole) => {
  const normalizedRole = String(userRole || "").toLowerCase().trim();
  return Object.keys(CAPABILITY_REGISTRY).filter((key) =>
    CAPABILITY_REGISTRY[key].allowedRoles.includes(normalizedRole)
  );
};
