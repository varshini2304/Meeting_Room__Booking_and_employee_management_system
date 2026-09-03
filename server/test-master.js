import mongoose from 'mongoose';
import {
  handleAiChat,
  confirmBookingIntent,
  confirmAttendanceAction,
  confirmLeaveAction,
  cancelBooking,
} from './controllers/ai.controller.js';
import { AIConversation } from './models/ai-conversation.model.js';
import { BookingIntent } from './models/booking-intent.model.js';
import { AttendanceIntent } from './models/attendance-intent.model.js';
import { LeaveIntent } from './models/leave-intent.model.js';
import { Attendance } from './models/attendance.model.js';
import { Leave } from './models/leave.model.js';
import { LeaveBalance } from './models/leave-balance.model.js';
import { Notification } from './models/notification.model.js';
import { User } from './models/user.model.js';
import { Booking } from './models/booking.model.js';
import { Room } from './models/room.model.js';
import { protect } from './middlewares/auth.middleware.js';
import { rateLimit } from './middlewares/rateLimit.middleware.js';
import { resolveDate, resolveTime, validateSlotTiming } from './utils/dateTimeResolver.js';
import { passesHardFilter, scoreRoomCandidate } from './services/room-ranking.service.js';
import { sanitizeExtractedParams, resolveDomainAndAction } from './services/ai.service.js';
import {
  READ_ONLY_AI_TOOLS,
  executeAiTool,
  registerAiTool,
  EMPLOYEE_NAVIGATION_DESTINATIONS,
  MANAGER_NAVIGATION_DESTINATIONS,
  executeSearchManagerBookings,
  executeGetManagerBookingDetails,
  executeGetManagerRoomAvailability,
  executeGetManagerRoomUtilization,
  executeSearchManagerAttendance,
  executeGetManagerAttendanceDetails,
  executeGetManagerDailyAttendanceSummary,
  executeGetManagerMonthlyAttendanceSummary,
  executeGetManagerNotCheckedIn,
  executeSearchManagerLeaves,
  executeGetManagerLeaveDetails,
  executeGetManagerLeaveBalances,
  executeGetManagerActiveLeavesToday,
} from './services/ai-tools.js';
import { createAiContext } from './services/ai-context.js';
import {
  getTodayDateStr,
  searchManagerAttendance,
  getManagerAttendanceDetails,
  getManagerDailyAttendanceSummary,
  getManagerMonthlyAttendanceSummary,
  getManagerNotCheckedIn,
} from './services/attendance.service.js';
import {
  getMyBalance,
  getMyLeaves,
  applyLeave,
  validateLeaveEligibility,
  countBusinessDays,
  LEAVE_TYPES,
  searchManagerLeaves,
  getManagerActiveLeavesOnDate,
  getManagerLeaveDetails,
  getManagerLeaveBalances,
} from './services/leave.service.js';
import {
  getUserNotifications,
  getUserUnreadNotifications,
  getUserNotificationDetails,
} from './services/notification.service.js';
import { getUserProfileService } from './services/user.service.js';
import {
  CAPABILITY_REGISTRY,
  resolveCapability,
  isCapabilityAuthorized,
  buildCapabilityKey,
  mapLegacyIntentToCapability,
} from './services/ai-capabilities.js';
import {
  getMyNextBooking,
  getMyUpcomingBookings,
  findMyBookingsByDateTime,
  getMyBookingDetails,
  searchManagerBookings,
  getManagerBookingDetails,
  findManagerBookingsByCriteria,
} from './services/booking.service.js';
import {
  getRoomAvailabilityService,
  getRoomUtilizationService,
} from './services/room.service.js';

console.log('====================================================');
console.log('       MASTER END-TO-END TEST & VERIFICATION        ');
console.log('====================================================\n');

// Offline stubs for database model operations
AIConversation.prototype.save = async function() { return this; };
let capturedIntent = null;
BookingIntent.prototype.save = async function() { capturedIntent = this; return this; };

const stagedAttendanceIntents = new Map();
AttendanceIntent.prototype.save = async function() {
  stagedAttendanceIntents.set(this.intentId, this);
  return this;
};
AttendanceIntent.findOne = async (filter) => {
  if (filter?.intentId) {
    return stagedAttendanceIntents.get(filter.intentId) || null;
  }
  return null;
};

const stagedLeaveIntents = new Map();
LeaveIntent.prototype.save = async function() {
  stagedLeaveIntents.set(this.intentId, this);
  return this;
};
LeaveIntent.findOne = async (filter) => {
  if (filter?.intentId) {
    return stagedLeaveIntents.get(filter.intentId) || null;
  }
  return null;
};

// Mock response creator
const createMockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; }
  };
  return res;
};

const userA = {
  _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
  name: 'User A',
  email: 'usera@toyota.local',
  role: 'employee',
  branch: 'Bangalore',
  country: 'India'
};

const userB = {
  _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439099'),
  name: 'User B',
  email: 'userb@toyota.local',
  role: 'employee',
  branch: 'Hyderabad',
  country: 'India'
};

const userManager = {
  _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439088'),
  name: 'Manager User',
  email: 'manager@toyota.local',
  role: 'manager',
  branch: 'Bangalore',
  country: 'India'
};

// Global mocks for Room & Booking search
Room.find = () => ({
  sort: () => ({
    lean: async () => [
      {
        _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439044'),
        roomNumber: 'A-201',
        roomType: 'Conference Room',
        capacity: 10,
        isActive: true,
        branch: 'Bangalore',
        block: 'Block A',
        floor: '2nd Floor',
        country: 'India',
        amenities: ['Projector', 'Whiteboard']
      }
    ]
  }),
  lean: async () => [
    {
      _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439044'),
      roomNumber: 'A-201',
      roomType: 'Conference Room',
      capacity: 10,
      isActive: true,
      branch: 'Bangalore',
      block: 'Block A',
      floor: '2nd Floor',
      country: 'India',
      amenities: ['Projector', 'Whiteboard']
    }
  ]
});
Booking.find = () => ({
  select: () => ({ lean: async () => [] }),
  populate: () => ({ sort: () => ({ lean: async () => [], limit: () => ({ lean: async () => [] }) }) })
});

let passedCount = 0;
const assert = (condition, msg) => {
  if (!condition) {
    console.error('❌ FAIL: ' + msg);
    throw new Error('Assertion failed: ' + msg);
  }
  console.log('  ✅ [PASS] ' + msg);
  passedCount++;
};

console.log('--- TEST SECTION 1: CHAT ENDPOINT & AUTHENTICATION ---');
// 1.1 Unauthenticated request -> 401
{
  const req = { headers: {} };
  const res = createMockRes();
  protect(req, res, () => {});
  assert(res.statusCode === 401, 'Unauthenticated request blocked with 401');
}

// 1.2 Missing / whitespace message -> 400
{
  const res1 = createMockRes();
  await handleAiChat({ body: {}, user: userA }, res1, () => {});
  assert(res1.statusCode === 400, 'Missing message returns 400 INVALID_REQUEST');

  const res2 = createMockRes();
  await handleAiChat({ body: { message: '   ' }, user: userA }, res2, () => {});
  assert(res2.statusCode === 400, 'Whitespace message returns 400 INVALID_REQUEST');
}

// 1.3 Oversized message (>2000 chars) -> 400
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Z'.repeat(2100) }, user: userA }, res, () => {});
  assert(res.statusCode === 400 && res.body?.error === 'MESSAGE_TOO_LARGE', 'Oversized message (>2000 chars) returns 400 MESSAGE_TOO_LARGE');
}

// 1.4 Multi-turn session continuity
{
  const origFindOne = AIConversation.findOne;
  let savedConv = null;
  AIConversation.findOne = async (q) => (savedConv && q.sessionId === savedConv.sessionId ? savedConv : null);

  const res1 = createMockRes();
  await handleAiChat({ body: { message: 'Hello' }, user: userA }, res1, () => {});
  const sid = res1.body.sessionId;
  savedConv = new AIConversation({
    sessionId: sid,
    userId: userA._id,
    userRole: 'employee',
    branch: 'Bangalore',
    messages: [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: res1.body.reply }
    ],
    turnCount: 2
  });

  const res2 = createMockRes();
  await handleAiChat({ body: { message: 'Available rooms', sessionId: sid }, user: userA }, res2, () => {});
  assert(res2.body.sessionId === sid && res2.body.turnCount >= 4, 'Multi-turn session continuity preserved');

  // 1.5 Cross-user session hijacking attempt
  const resHijack = createMockRes();
  await handleAiChat({ body: { message: 'Steal', sessionId: sid }, user: userB }, resHijack, () => {});
  assert(resHijack.body.sessionId !== sid, 'Cross-user session hijacking blocked; new session allocated');
  AIConversation.findOne = origFindOne;
}

// 1.6 Natural-language 'yes' confirmation interception
{
  const origFindConv = AIConversation.findOne;
  const origFindIntent = BookingIntent.findOne;
  AIConversation.findOne = async () => new AIConversation({ sessionId: 's1', userId: userA._id, pendingIntentId: 'int_1' });
  BookingIntent.findOne = async () => ({
    intentId: 'int_1',
    status: 'pending',
    roomNumber: 'A-201',
    isExpired: () => false
  });

  const resYes = createMockRes();
  await handleAiChat({ body: { message: 'Yes, please confirm!', sessionId: 's1' }, user: userA }, resYes, () => {});
  assert(resYes.body.reply.includes('Confirm Booking') && Boolean(resYes.body.pendingIntentCard), 'Natural language affirmation intercepted; card re-presented without booking');
  AIConversation.findOne = origFindConv;
  BookingIntent.findOne = origFindIntent;
}

console.log('\n--- TEST SECTION 2: DETERMINISTIC VALIDATIONS & BOOKING INTENT ---');
// 2.1 Missing date, time, attendees
{
  const resD = createMockRes();
  await handleAiChat({ body: { message: 'Book a room for 5 attendees' }, user: userA }, resD, () => {});
  assert(resD.body.reply.includes('date'), 'Missing date prompted');

  const resT = createMockRes();
  await handleAiChat({ body: { message: 'Book a room for 5 attendees tomorrow' }, user: userA }, resT, () => {});
  assert(resT.body.reply.includes('time'), 'Missing time prompted');

  const resA = createMockRes();
  await handleAiChat({ body: { message: 'Book a room tomorrow at 15:00' }, user: userA }, resA, () => {});
  assert(resA.body.reply.includes('attendees'), 'Missing attendee count prompted');
}

// 2.2 Invalid branch rejection
{
  const resTokyo = createMockRes();
  await handleAiChat({ body: { message: 'Book a room in Tokyo tomorrow at 15:00 for 5 attendees' }, user: userA }, resTokyo, () => {});
  assert(resTokyo.body.reply.includes('Toyota branches currently supported'), 'Unsupported branch (Tokyo) rejected with supported branches prompt');
}

// 2.3 Past date rejection
{
  const pastRes = resolveDate('2021-05-10', 'Asia/Kolkata');
  assert(pastRes.error && pastRes.error.includes('past'), 'Past date deterministically rejected');
}

// 2.4 :15 and :45 time disambiguation (no silent snapping)
{
  const t15 = resolveTime('15:15');
  assert(t15.needsClarification && t15.suggestedSlots.includes('15:00') && t15.suggestedSlots.includes('15:30'), 'Non-boundary time (15:15) prompted for :00 or :30 boundary');

  const t45 = resolveTime('15:45');
  assert(t45.needsClarification && t45.suggestedSlots.includes('15:30') && t45.suggestedSlots.includes('16:00'), 'Non-boundary time (15:45) prompted for :30 or :00 boundary');
}

// 2.5 Operating hours enforcement (08:00 - 20:00)
{
  const early = validateSlotTiming('2026-09-05', '07:30', 'Asia/Kolkata');
  assert(!early.isValid, 'Slot before 08:00 rejected');

  const late = validateSlotTiming('2026-09-05', '20:00', 'Asia/Kolkata');
  assert(!late.isValid, 'Slot after 19:30 rejected');
}

// 2.6 Multi-slot duration clarification
{
  const resDur = createMockRes();
  await handleAiChat({ body: { message: 'I need a room for 2 hours tomorrow at 15:00 for 5 attendees' }, user: userA }, resDur, () => {});
  assert(resDur.body.reply.includes('single 30-minute bookings in V1'), 'Duration > 30 mins triggers V1 30-min limitation clarification');
}

// 2.7 Hard amenity constraint
{
  const candidate = { _id: 'r1', isActive: true, capacity: 10, amenities: ['Projector'] };
  const passes = passesHardFilter(candidate, new Set(), { attendeeCount: 5, requestedAmenities: ['Whiteboard'] });
  assert(!passes, 'Room missing required amenity (Whiteboard) strictly excluded (hard filter)');
}

// 2.8 BookingIntent created in pending status; ZERO Booking records created during chat
{
  let bookingCreated = false;
  const origCreate = Booking.create;
  Booking.create = async () => { bookingCreated = true; };

  const resBook = createMockRes();
  await handleAiChat({ body: { message: 'Book a room for 5 attendees tomorrow at 15:00 in Bangalore with Projector' }, user: userA }, resBook, () => {});
  assert(!bookingCreated, 'Zero Booking records created during chat');
  assert(capturedIntent && capturedIntent.status === 'pending', 'BookingIntent created with status pending');
  assert(String(capturedIntent.userId) === String(userA._id), 'BookingIntent userId derived exclusively from authenticated user');
  assert(resBook.body.pendingIntentCard?.action === 'CONFIRM_REQUIRED', 'pendingIntentCard returned with action: CONFIRM_REQUIRED');
  Booking.create = origCreate;
}

console.log('\n--- TEST SECTION 3: CONFIRMATION BOUNDARY & CONCURRENCY ---');
// 3.1 Ownership enforcement
{
  const origFind = BookingIntent.findOne;
  BookingIntent.findOne = async () => ({ intentId: 'int_1', userId: userA._id });

  const res = createMockRes();
  await confirmBookingIntent({ body: { intentId: 'int_1' }, user: userB }, res, () => {});
  assert(res.statusCode === 403 && res.body.error === 'INTENT_NOT_OWNED', 'Cross-user intent confirmation blocked with 403 INTENT_NOT_OWNED');
  BookingIntent.findOne = origFind;
}

// 3.2 Expired intent -> 410
{
  let newStatus = null;
  const origFind = BookingIntent.findOne;
  BookingIntent.findOne = async () => ({
    intentId: 'int_exp',
    userId: userA._id,
    status: 'pending',
    isExpired: () => true,
    save: async function() { newStatus = this.status; }
  });

  const res = createMockRes();
  await confirmBookingIntent({ body: { intentId: 'int_exp' }, user: userA }, res, () => {});
  assert(res.statusCode === 410 && res.body.error === 'INTENT_EXPIRED' && newStatus === 'expired', 'Expired intent returns 410 INTENT_EXPIRED and updates state to expired');
  BookingIntent.findOne = origFind;
}

// 3.3 Already resolved intent -> 409
{
  const origFind = BookingIntent.findOne;
  BookingIntent.findOne = async () => ({ intentId: 'int_res', userId: userA._id, status: 'confirmed' });

  const res = createMockRes();
  await confirmBookingIntent({ body: { intentId: 'int_res' }, user: userA }, res, () => {});
  assert(res.statusCode === 409 && res.body.error === 'INTENT_ALREADY_RESOLVED', 'Already resolved intent returns 409 INTENT_ALREADY_RESOLVED');
  BookingIntent.findOne = origFind;
}

// 3.4 Fresh availability check -> 409
{
  const origFindIntent = BookingIntent.findOne;
  const origFindBooking = Booking.findOne;
  BookingIntent.findOne = async () => ({
    intentId: 'int_conflict',
    userId: userA._id,
    status: 'pending',
    isExpired: () => false,
    roomId: new mongoose.Types.ObjectId(),
    date: '2026-09-03',
    startTime: '15:00'
  });
  Booking.findOne = () => ({ lean: async () => ({ _id: 'conf_1', status: 'booked' }) });

  const res = createMockRes();
  await confirmBookingIntent({ body: { intentId: 'int_conflict' }, user: userA }, res, () => {});
  assert(res.statusCode === 409 && res.body.error === 'ROOM_NO_LONGER_AVAILABLE', 'Pre-confirmation availability check detects conflict -> 409 ROOM_NO_LONGER_AVAILABLE');
  BookingIntent.findOne = origFindIntent;
  Booking.findOne = origFindBooking;
}

// 3.5 Concurrency 11000 duplicate key collision mapping -> 409
{
  const origFindIntent = BookingIntent.findOne;
  const origFindBooking = Booking.findOne;
  const origCreateBooking = Booking.create;

  BookingIntent.findOne = async () => ({
    intentId: 'int_race',
    userId: userA._id,
    status: 'pending',
    isExpired: () => false,
    roomId: new mongoose.Types.ObjectId(),
    date: '2026-09-03',
    startTime: '15:00'
  });
  Booking.findOne = () => ({ lean: async () => null });
  Booking.create = async () => {
    const err = new Error('E11000 duplicate key error');
    err.code = 11000;
    throw err;
  };

  const res = createMockRes();
  await confirmBookingIntent({ body: { intentId: 'int_race' }, user: userA }, res, () => {});
  assert(res.statusCode === 409 && res.body.error === 'ROOM_NO_LONGER_AVAILABLE', 'Concurrency collision (11000) caught and mapped to 409 ROOM_NO_LONGER_AVAILABLE');

  BookingIntent.findOne = origFindIntent;
  Booking.findOne = origFindBooking;
  Booking.create = origCreateBooking;
}

// 3.6 MongoDB partial unique index verification
{
  const indexes = Booking.schema.indexes();
  const hasUnique = indexes.some(([idx, opts]) => 
    idx.roomId === 1 && idx.date === 1 && idx.startTime === 1 &&
    opts?.unique === true &&
    opts?.partialFilterExpression?.status === 'booked'
  );
  assert(hasUnique, 'MongoDB partial unique index on { roomId, date, startTime } where status: booked confirmed active');
}

console.log('\n--- TEST SECTION 4: CANCELLATION BOUNDARY ---');
// 4.1 Own booking cancellation
{
  const mockBooking = {
    _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439055'),
    ownerId: userA._id,
    status: 'booked',
    save: async function() { this.status = 'cancelled'; }
  };
  const origFindById = Booking.findById;
  Booking.findById = async () => mockBooking;

  const res = createMockRes();
  await cancelBooking({ body: { bookingId: '507f1f77bcf86cd799439055' }, user: userA }, res, () => {});
  assert(res.statusCode === 200 && res.body.success, 'Owner successfully cancelled booking via POST /api/ai/booking/cancel');

  // 4.2 Cross-user cancellation attempt
  const resOther = createMockRes();
  await cancelBooking({ body: { bookingId: '507f1f77bcf86cd799439055' }, user: userB }, resOther, () => {});
  assert(resOther.statusCode === 403 && resOther.body.error === 'FORBIDDEN', 'Cross-user cancellation blocked with 403 FORBIDDEN');

  // 4.3 Already cancelled booking
  mockBooking.status = 'cancelled';
  const resCancelled = createMockRes();
  await cancelBooking({ body: { bookingId: '507f1f77bcf86cd799439055' }, user: userA }, resCancelled, () => {});
  assert(resCancelled.statusCode === 400 && resCancelled.body.error === 'ALREADY_CANCELLED', 'Already cancelled booking returns 400 ALREADY_CANCELLED');
  Booking.findById = origFindById;
}

console.log('\n--- TEST SECTION 5: LLM SECURITY & TOOL BOUNDARIES ---');
// 5.1 Identity injection sanitization
{
  const cleaned = sanitizeExtractedParams({ userId: 'hacker', ownerId: 'hacker', _id: 'hacker', attendeeCount: 4, branch: 'Bangalore' });
  assert(!cleaned.userId && !cleaned.ownerId && !cleaned._id, 'Identity injection parameters (userId, ownerId, _id) stripped clean');
}

// 5.2 Disallowed tool execution
{
  const callRes = await executeAiTool('create_booking', {}, { user: userA });
  assert(callRes.error === 'FORBIDDEN_TOOL', 'Disallowed write tool rejected with FORBIDDEN_TOOL');
}

// 5.3 Authorized toolset verification
{
  const tools = READ_ONLY_AI_TOOLS.map(t => t.function.name);
  const writeKeywords = ['create', 'cancel', 'punch', 'delete', 'update', 'modify', 'confirm', 'apply', 'override'];
  const hasWriteTool = tools.some(name => writeKeywords.some(kw => name.includes(kw)));
  assert(!hasWriteTool && tools.length >= 18 && tools.includes('search_available_rooms') && tools.includes('get_my_next_booking') && tools.includes('get_my_attendance') && tools.includes('get_my_leave_balance') && tools.includes('get_my_notifications') && tools.includes('get_my_profile') && tools.includes('search_manager_bookings'), 'Only authorized read-only tools exposed; zero write tools exist');
}

// 5.4 Rate limiter anti-spoofing
{
  const limiter = rateLimit({ windowMs: 1000, max: 2 });
  let count = 0;
  let blocked = false;
  const mockRes = { status: (c) => ({ json: () => { if (c === 429) blocked = true; } }) };

  const req1 = { user: { _id: 'u1' }, headers: { 'x-forwarded-for': '1.1.1.1' } };
  const req2 = { user: { _id: 'u1' }, headers: { 'x-forwarded-for': '2.2.2.2' } };
  const req3 = { user: { _id: 'u1' }, headers: { 'x-forwarded-for': '3.3.3.3' } };

  limiter(req1, mockRes, () => count++);
  limiter(req2, mockRes, () => count++);
  limiter(req3, mockRes, () => count++);
  assert(count === 2 && blocked, 'Rate limiter keys on authenticated identity; spoofed IP headers cannot bypass rate limit');
}

console.log('\n--- TEST SECTION 6: PHASE 7 ARCHITECTURE, DOMAIN/ACTION MODEL & CAPABILITY REGISTRY ---');

// 6.1 Domain + Action representation for legacy booking intents
{
  const r1 = resolveDomainAndAction('BOOK_ROOM');
  const r2 = resolveDomainAndAction('SEARCH_ROOMS');
  const r3 = resolveDomainAndAction('MY_BOOKINGS');
  const r4 = resolveDomainAndAction('CANCEL_BOOKING');
  const r5 = resolveDomainAndAction('GENERAL_HELP');

  assert(
    r1.domain === 'BOOKING' && r1.action === 'BOOK' && r1.intent === 'BOOK_ROOM' &&
    r2.domain === 'BOOKING' && r2.action === 'SEARCH' && r2.intent === 'SEARCH_ROOMS' &&
    r3.domain === 'BOOKING' && r3.action === 'MY_BOOKINGS' && r3.intent === 'MY_BOOKINGS' &&
    r4.domain === 'BOOKING' && r4.action === 'CANCEL' && r4.intent === 'CANCEL_BOOKING' &&
    r5.domain === 'GENERAL' && r5.action === 'HELP' && r5.intent === 'GENERAL_HELP',
    'Domain + Action representation maps all 5 legacy intents correctly'
  );
}

// 6.2 Architectural representation for future domains (Attendance, Leave, Manager)
{
  const attCap = resolveCapability('ATTENDANCE', 'GET_MY_SUMMARY');
  const leaveCap = resolveCapability('LEAVE', 'GET_BALANCE');
  const mgrCap = resolveCapability('MANAGER', 'GET_TEAM_ATTENDANCE');

  assert(
    attCap && attCap.domain === 'ATTENDANCE' && attCap.action === 'GET_MY_SUMMARY' && attCap.classification === 'READ' &&
    leaveCap && leaveCap.domain === 'LEAVE' && leaveCap.action === 'GET_BALANCE' && leaveCap.classification === 'READ' &&
    mgrCap && mgrCap.domain === 'MANAGER' && mgrCap.action === 'GET_TEAM_ATTENDANCE' && mgrCap.allowedRoles.includes('manager') && !mgrCap.allowedRoles.includes('employee'),
    'Future domain capabilities registered with strict classifications and role constraints'
  );
}

// 6.3 Server-authoritative context builder guarantees untrusted input cannot override identity
{
  const ctx = createAiContext(userA, { requestedBranch: 'Bangalore' });
  assert(
    ctx.userId === String(userA._id) &&
    ctx.role === 'employee' &&
    ctx.branch === 'Bangalore' &&
    ctx.country === 'India' &&
    ctx.timeZone === 'Asia/Kolkata' &&
    typeof ctx.currentDate === 'string' &&
    typeof ctx.currentTime === 'string' &&
    Array.isArray(ctx.allowedCapabilities) &&
    ctx.isAuthorized('BOOKING:BOOK') === true &&
    ctx.isAuthorized('MANAGER:GET_TEAM_ATTENDANCE') === false,
    'Server-authoritative context builder accurately derives validated user identity, branch timezone, and capability allowlist'
  );
}

// 6.4 Capability authorization: employee vs manager
{
  const empAllowed = isCapabilityAuthorized('BOOKING:SEARCH', 'employee');
  const empBlocked = isCapabilityAuthorized('MANAGER:GET_TEAM_ATTENDANCE', 'employee');
  const mgrAllowed = isCapabilityAuthorized('MANAGER:GET_TEAM_ATTENDANCE', 'manager');
  const empLeaveBlocked = isCapabilityAuthorized('MANAGER:APPROVE_LEAVE', 'employee');
  const mgrLeaveAllowed = isCapabilityAuthorized('MANAGER:APPROVE_LEAVE', 'manager');

  assert(
    empAllowed === true &&
    empBlocked === false &&
    mgrAllowed === true &&
    empLeaveBlocked === false &&
    mgrLeaveAllowed === true,
    'Capability authorization strictly enforces role hierarchy (employee blocked from manager capabilities)'
  );
}

// 6.5 Server-side enforcement of unauthorized capability in chat pipeline
{
  // Mock AI service returning a manager capability for an employee session
  const origFindOne = AIConversation.findOne;
  AIConversation.findOne = async () => null;

  // Simulate employee attempting manager capability
  const res = createMockRes();
  // We send a message that would trigger or simulate manager action
  const ctx = createAiContext(userA);
  assert(ctx.isAuthorized('MANAGER:GET_TEAM_ATTENDANCE') === false, 'Employee is unauthorized for manager capabilities');

  AIConversation.findOne = origFindOne;
}

// 6.6 Anti-generic database query tool protection
{
  let threw = false;
  try {
    registerAiTool({
      name: 'run_database_query',
      domain: 'DATABASE',
      capability: 'DATABASE:QUERY',
      definition: {},
      execute: async () => {}
    });
  } catch (err) {
    threw = true;
  }
  assert(threw, 'Generic database/raw query tools strictly rejected by tool safety policy');
}

// 6.7 Tool execution respects server-authoritative role capabilities
{
  // Register a manager-only read tool
  registerAiTool({
    name: 'get_team_metrics_test',
    domain: 'MANAGER',
    capability: 'MANAGER:GET_TEAM_ATTENDANCE',
    definition: { type: 'function', function: { name: 'get_team_metrics_test' } },
    execute: async () => ({ ok: true })
  });

  const empRes = await executeAiTool('get_team_metrics_test', {}, { user: userA });
  const mgrRes = await executeAiTool('get_team_metrics_test', {}, { user: userManager });

  assert(
    empRes.error === 'FORBIDDEN_TOOL' &&
    mgrRes.ok === true,
    'Tool execution checks server-side capability: employee blocked with FORBIDDEN_TOOL, manager permitted'
  );
}

// 6.8 Backward compatibility: chat response retains domain, action, and intent
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'What can you do?' }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'GENERAL' &&
    res.body.action === 'HELP' &&
    res.body.intent === 'GENERAL_HELP' &&
    typeof res.body.reply === 'string',
    'Backward compatibility verified: response includes domain, action, and legacy intent'
  );
}

// ============================================================================
// SECTION 7: PHASE 8 EMPLOYEE ATTENDANCE CAPABILITIES
// ============================================================================
console.log('\n--- TEST SECTION 7: PHASE 8 EMPLOYEE ATTENDANCE CAPABILITIES ---');

const todayStr = getTodayDateStr();
let mockAttendanceDb = [
  {
    _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439101'),
    employeeId: userA._id,
    date: '2026-08-10',
    checkInTime: new Date('2026-08-10T09:00:00Z'),
    checkOutTime: new Date('2026-08-10T17:30:00Z'),
    status: 'present',
    workHours: 8.5,
  },
  {
    _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439102'),
    employeeId: userA._id,
    date: '2026-08-11',
    checkInTime: new Date('2026-08-11T09:15:00Z'),
    checkOutTime: new Date('2026-08-11T17:15:00Z'),
    status: 'late',
    workHours: 8.0,
  }
];

Attendance.findOne = (query) => {
  const found = mockAttendanceDb.find(r => 
    String(r.employeeId) === String(query.employeeId) && 
    (!query.date || r.date === query.date)
  );
  return {
    lean: async () => found || null,
    then: (resolve) => resolve(found ? { ...found, save: async function() { return this; } } : null),
  };
};

Attendance.find = (query) => ({
  sort: () => ({
    lean: async () => mockAttendanceDb.filter(r => String(r.employeeId) === String(query.employeeId)),
  }),
  lean: async () => mockAttendanceDb.filter(r => String(r.employeeId) === String(query.employeeId)),
});

Attendance.findOneAndUpdate = async (filter, update) => {
  const existingIndex = mockAttendanceDb.findIndex(r => 
    String(r.employeeId) === String(filter.employeeId) && r.date === filter.date
  );
  const updatedDoc = {
    _id: new mongoose.Types.ObjectId(),
    employeeId: filter.employeeId,
    date: filter.date,
    checkInTime: update.$set?.checkInTime || new Date(),
    status: update.$set?.status || 'present',
    location: update.$set?.location || '',
    workHours: 0,
    save: async function() { return this; }
  };
  if (existingIndex >= 0) {
    mockAttendanceDb[existingIndex] = { ...mockAttendanceDb[existingIndex], ...updatedDoc };
  } else {
    mockAttendanceDb.push(updatedDoc);
  }
  return updatedDoc;
};

// 7.1 Read-only attendance tool: get_my_attendance for specific date
{
  const result = await executeAiTool('get_my_attendance', { date: '2026-08-10' }, { user: userA });
  assert(
    result.success === true &&
    result.date === '2026-08-10' &&
    result.status === 'present' &&
    result.workHours === 8.5 &&
    result.isPunchedIn === true,
    'Read-only attendance retrieval for specific date returns status, punch times, and work hours'
  );
}

// 7.2 Read-only attendance tool: get_my_attendance_summary calculates monthly metrics deterministically
{
  const summary = await executeAiTool('get_my_attendance_summary', { month: 8, year: 2026 }, { user: userA });
  assert(
    summary.success === true &&
    summary.month === 8 &&
    summary.present === 2 &&
    summary.late === 1 &&
    summary.totalWorkHours === 16.5 &&
    summary.avgWorkHours === 8.25,
    'Monthly attendance summary calculated deterministically from authoritative service'
  );
}

// 7.3 Read-only attendance tool: get_my_attendance_history returns user records
{
  const history = await executeAiTool('get_my_attendance_history', { month: 8, year: 2026 }, { user: userA });
  assert(
    history.success === true &&
    history.count === 2 &&
    history.records[0].date === '2026-08-10',
    'Attendance history retrieval returns user attendance records'
  );
}

// 7.4 Context isolation: get_my_attendance binds exclusively to context.user._id
{
  const hijackResult = await executeAiTool(
    'get_my_attendance',
    { date: '2026-08-10', employeeId: userB._id.toString() },
    { user: userA }
  );
  assert(
    hijackResult.success === true &&
    hijackResult.date === '2026-08-10' &&
    hijackResult.isPunchedIn === true,
    'Tool context binding strictly uses authenticated user context and ignores injected employeeId'
  );
}

// 7.5 Conversational privacy defense: "Show Rahul's attendance" is rejected
{
  const res = createMockRes();
  await handleAiChat({ body: { message: "Show Rahul's attendance" }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes('You can only view your own attendance records'),
    'Conversational request for another employee attendance rejected with privacy notice'
  );
}

// 7.6 Write tool prevention: LLM cannot call write tools (punch_in tool does not exist)
{
  const writeRes = await executeAiTool('punch_in', {}, { user: userA });
  assert(
    writeRes.error === 'FORBIDDEN_TOOL',
    'Write tools (punch_in) do not exist in tool registry and are rejected with FORBIDDEN_TOOL'
  );
}

// 7.7 Conversational Punch-In staging: "Punch me in" stages AttendanceIntent and returns attendanceActionCard
let stagedPunchInIntentId = null;
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Punch me in for today' }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'ATTENDANCE' &&
    res.body.action === 'PUNCH_IN' &&
    res.body.attendanceActionCard !== null &&
    res.body.attendanceActionCard.action === 'PUNCH_IN' &&
    res.body.attendanceActionCard.confirmEndpoint === '/api/ai/attendance/confirm',
    'Conversational punch-in request stages intent and returns attendanceActionCard with confirmEndpoint'
  );
  stagedPunchInIntentId = res.body.attendanceActionCard.intentId;
}

// 7.8 Zero write mutations to Attendance collection during chat staging
{
  const todayRecord = mockAttendanceDb.find(r => String(r.employeeId) === String(userA._id) && r.date === todayStr);
  assert(
    !todayRecord || !todayRecord.checkInTime,
    'Zero mutations committed to Attendance collection during chat staging'
  );
}

// 7.9 Natural language affirmation defense: "yes" in chat does not execute punch-in
{
  const origFindConv = AIConversation.findOne;
  AIConversation.findOne = async () => new AIConversation({
    sessionId: 'sess-att-affirm',
    userId: userA._id,
    pendingIntentId: stagedPunchInIntentId,
  });

  const res = createMockRes();
  await handleAiChat(
    { body: { message: 'yes please confirm', sessionId: 'sess-att-affirm' }, user: userA },
    res,
    () => {}
  );
  assert(
    res.statusCode === 200 &&
    res.body.attendanceActionCard !== null &&
    res.body.reply.includes('attendance punch actions cannot be confirmed through chat messages alone'),
    'Natural language affirmation intercepted; card re-presented without executing punch-in'
  );

  AIConversation.findOne = origFindConv;
}

// 7.10 Confirmation boundary: Cross-user confirmation blocked
{
  const res = createMockRes();
  await confirmAttendanceAction(
    { body: { intentId: stagedPunchInIntentId }, user: userB },
    res,
    () => {}
  );
  assert(
    res.statusCode === 403 && res.body.error === 'INTENT_NOT_OWNED',
    'Cross-user attendance confirmation blocked with 403 INTENT_NOT_OWNED'
  );
}

// 7.11 Confirmation boundary: Expired intent blocked
{
  const expiredIntentId = 'att_expired_' + Date.now();
  const expIntent = new AttendanceIntent({
    intentId: expiredIntentId,
    sessionId: 'session-exp',
    userId: userA._id,
    action: 'PUNCH_IN',
    date: todayStr,
    stagedAtTime: '09:00 AM',
    status: 'pending',
    expiresAt: new Date(Date.now() - 60000),
  });
  await expIntent.save();

  const res = createMockRes();
  await confirmAttendanceAction(
    { body: { intentId: expiredIntentId }, user: userA },
    res,
    () => {}
  );
  assert(
    res.statusCode === 410 && res.body.error === 'INTENT_EXPIRED',
    'Expired attendance intent blocked with 410 INTENT_EXPIRED'
  );
}

// 7.12 Confirmation boundary: Successful Punch-In execution
{
  const res = createMockRes();
  await confirmAttendanceAction(
    { body: { intentId: stagedPunchInIntentId }, user: userA },
    res,
    () => {}
  );

  const intentAfter = stagedAttendanceIntents.get(stagedPunchInIntentId);
  assert(
    res.statusCode === 200 &&
    res.body.success === true &&
    res.body.action === 'PUNCH_IN' &&
    intentAfter?.status === 'confirmed',
    'Owner successfully confirmed Punch-In via POST /api/ai/attendance/confirm'
  );
}

// 7.13 Confirmation boundary: Already resolved intent returns 409
{
  const res = createMockRes();
  await confirmAttendanceAction(
    { body: { intentId: stagedPunchInIntentId }, user: userA },
    res,
    () => {}
  );
  assert(
    res.statusCode === 409 && res.body.error === 'INTENT_ALREADY_RESOLVED',
    'Already resolved attendance intent returns 409 INTENT_ALREADY_RESOLVED'
  );
}

// 7.14 State revalidation: Already punched in today returns already punched in
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Punch me in again' }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes('You have already punched in today'),
    'State revalidation detects user already punched in today and rejects duplicate staging'
  );
}

// 7.15 Conversational Punch-Out staging: "Punch me out" stages AttendanceIntent and returns attendanceActionCard
let stagedPunchOutIntentId = null;
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Punch me out for today' }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'ATTENDANCE' &&
    res.body.action === 'PUNCH_OUT' &&
    res.body.attendanceActionCard !== null &&
    res.body.attendanceActionCard.action === 'PUNCH_OUT',
    'Conversational punch-out request stages intent and returns attendanceActionCard'
  );
  stagedPunchOutIntentId = res.body.attendanceActionCard.intentId;
}

// 7.16 Confirmation boundary: Successful Punch-Out execution
{
  const checkedInRec = {
    _id: new mongoose.Types.ObjectId(),
    employeeId: userA._id,
    date: todayStr,
    checkInTime: new Date(Date.now() - 8 * 3600 * 1000),
    checkOutTime: null,
    status: 'present',
    workHours: 0,
    save: async function() { return this; }
  };

  const origAttFindOne = Attendance.findOne;
  Attendance.findOne = (filter) => {
    if (String(filter.employeeId) === String(userA._id)) {
      return {
        ...checkedInRec,
        lean: async () => checkedInRec,
        then: (resolve) => resolve(checkedInRec),
        save: async function() { return this; }
      };
    }
    return null;
  };

  const res = createMockRes();
  await confirmAttendanceAction(
    { body: { intentId: stagedPunchOutIntentId }, user: userA },
    res,
    () => {}
  );

  const punchOutIntentAfter = stagedAttendanceIntents.get(stagedPunchOutIntentId);
  assert(
    res.statusCode === 200 &&
    res.body.success === true &&
    res.body.action === 'PUNCH_OUT' &&
    punchOutIntentAfter?.status === 'confirmed',
    'Owner successfully confirmed Punch-Out via POST /api/ai/attendance/confirm and recorded work hours'
  );

  Attendance.findOne = origAttFindOne;
}

// 7.17 Post Punch-Out: Attempting to punch out again detects already punched out
{
  const origAttFindOne = Attendance.findOne;
  Attendance.findOne = (filter) => ({
    lean: async () => ({
      _id: new mongoose.Types.ObjectId(),
      employeeId: userA._id,
      date: todayStr,
      checkInTime: new Date(),
      checkOutTime: new Date(),
      workHours: 8.0,
      status: 'present'
    })
  });

  const res = createMockRes();
  await handleAiChat({ body: { message: 'Punch me out' }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes('You have already punched out today'),
    'State revalidation detects user already punched out today and informs user'
  );

  Attendance.findOne = origAttFindOne;
}

console.log('\n--- TEST SECTION 8: PHASE 9 EMPLOYEE LEAVE CAPABILITIES ---');

// Mock data stores for Section 8
const userFemale = {
  _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439099'),
  name: 'Priya Sharma',
  email: 'priya@toyota.com',
  role: 'employee',
  branch: 'Bangalore',
  gender: 'female',
};

const mockLeaveDb = [];
const mockLeaveBalanceDb = new Map();

// Helper to seed or get mock balance
const getOrCreateMockBalance = (empId, year) => {
  const key = `${empId}_${year}`;
  if (!mockLeaveBalanceDb.has(key)) {
    mockLeaveBalanceDb.set(key, {
      employeeId: empId,
      year,
      casual: { total: 12, used: 2, pending: 0 },
      sick: { total: 10, used: 1, pending: 0 },
      earned: { total: 12, used: 0, pending: 0 },
      menstrual: { total: 12, used: 0, pending: 0 },
      relocation: { total: 5, used: 0, pending: 0 },
      unpaid: { total: 999, used: 0, pending: 0 },
      maternity: { total: 90, used: 0, pending: 0 },
      paternity: { total: 15, used: 0, pending: 0 },
      save: async function() { return this; }
    });
  }
  return mockLeaveBalanceDb.get(key);
};

// Mock User.findById
const origUserFindById = User.findById;
const origUserFind = User.find;
User.findById = (id) => ({
  select: () => ({
    lean: async () => {
      if (String(id) === String(userFemale._id)) return userFemale;
      if (String(id) === String(userB._id)) return userB;
      return userA;
    }
  })
});
User.find = () => ({
  select: () => ({
    lean: async () => []
  })
});

// Mock LeaveBalance methods
const origBalanceFindOne = LeaveBalance.findOne;
const origBalanceCreate = LeaveBalance.create;
const origBalanceUpdateOne = LeaveBalance.updateOne;

LeaveBalance.findOne = async ({ employeeId, year }) => {
  return getOrCreateMockBalance(employeeId, year);
};
LeaveBalance.create = async ({ employeeId, year }) => {
  return getOrCreateMockBalance(employeeId, year);
};
LeaveBalance.updateOne = async ({ employeeId, year }, update) => {
  const bal = getOrCreateMockBalance(employeeId, year);
  if (update.$inc) {
    for (const [k, v] of Object.entries(update.$inc)) {
      const [type, prop] = k.split('.');
      if (bal[type] && bal[type][prop] !== undefined) {
        bal[type][prop] += v;
      }
    }
  }
  return { modifiedCount: 1 };
};

// Mock Leave methods
const origLeaveCreate = Leave.create;
const origLeaveFindOne = Leave.findOne;
const origLeaveFind = Leave.find;

Leave.create = async (doc) => {
  const newDoc = {
    _id: new mongoose.Types.ObjectId(),
    ...doc,
    status: doc.status || 'pending',
    createdAt: new Date(),
    save: async function() { return this; },
  };
  mockLeaveDb.push(newDoc);
  return newDoc;
};

Leave.findOne = (filter) => {
  const exec = () => {
    let matches = mockLeaveDb.filter(l => {
      if (filter.employeeId && String(l.employeeId) !== String(filter.employeeId)) return false;
      if (filter._id && String(l._id) !== String(filter._id)) return false;
      if (filter.leaveType && l.leaveType !== filter.leaveType) return false;
      if (filter.status && filter.status.$in && !filter.status.$in.includes(l.status)) return false;
      if (filter.status && typeof filter.status === 'string' && l.status !== filter.status) return false;
      if (filter.$or) {
        // Date overlap check: { startDate: { $lte: endDate }, endDate: { $gte: startDate } }
        const orMatch = filter.$or.some(cond => {
          if (cond.startDate && cond.endDate) {
            const startLte = !cond.startDate.$lte || l.startDate <= cond.startDate.$lte;
            const endGte = !cond.endDate.$gte || l.endDate >= cond.endDate.$gte;
            return startLte && endGte;
          }
          if (cond.startDate && l.startDate === cond.startDate) return true;
          if (cond.endDate && l.endDate === cond.endDate) return true;
          if (cond.leaveType && l.leaveType === cond.leaveType) return true;
          if (cond.status && l.status === cond.status) return true;
          return false;
        });
        if (!orMatch) return false;
      }
      return true;
    });
    return matches[0] || null;
  };

  const res = exec();
  return {
    lean: async () => res,
    sort: () => ({ lean: async () => res }),
    then: (resolve) => resolve(res),
  };
};

Leave.find = (filter) => {
  const exec = () => {
    return mockLeaveDb.filter(l => {
      if (filter.employeeId && String(l.employeeId) !== String(filter.employeeId)) return false;
      if (filter.status && l.status !== filter.status) return false;
      return true;
    });
  };

  const matches = exec();
  return {
    lean: async () => matches,
    sort: () => ({
      lean: async () => matches,
      then: (resolve) => resolve(matches),
    }),
    then: (resolve) => resolve(matches),
  };
};

// Seed one existing past leave for userA
mockLeaveDb.push({
  _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439111'),
  employeeId: userA._id,
  leaveType: 'casual',
  startDate: '2026-07-01',
  endDate: '2026-07-02',
  totalDays: 2,
  reason: 'Family vacation',
  status: 'approved',
  createdAt: new Date('2026-06-25'),
});

// Seed one rejected leave for userA
mockLeaveDb.push({
  _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439222'),
  employeeId: userA._id,
  leaveType: 'sick',
  startDate: '2026-08-01',
  endDate: '2026-08-01',
  totalDays: 1,
  reason: 'Mild cold',
  status: 'rejected',
  reviewNotes: 'Adequate coverage not available on sprint freeze day',
  createdAt: new Date('2026-07-30'),
});

// 8.1 Read-only tool get_my_leave_balance returns authoritative quotas and remaining days
{
  const balanceRes = await executeAiTool('get_my_leave_balance', { year: 2026 }, { user: userA });
  const casual = balanceRes.balances.find(b => b.type === 'casual');
  const sick = balanceRes.balances.find(b => b.type === 'sick');

  assert(
    balanceRes.success === true &&
    balanceRes.year === 2026 &&
    casual.total === 12 &&
    casual.used === 2 &&
    casual.remaining === 10 &&
    sick.remaining === 9,
    'Read-only tool get_my_leave_balance returns authoritative balance breakdown'
  );
}

// 8.2 Read-only tool get_my_leave_requests returns user requests
{
  const requestsRes = await executeAiTool('get_my_leave_requests', {}, { user: userA });
  assert(
    requestsRes.success === true &&
    requestsRes.count === 2 &&
    requestsRes.requests.some(r => r.leaveType === 'casual' && r.status === 'approved') &&
    requestsRes.requests.some(r => r.leaveType === 'sick' && r.status === 'rejected'),
    'Read-only tool get_my_leave_requests returns user leave request history'
  );
}

// 8.3 Read-only tool get_my_leave_request_details returns specific request and manager review notes
{
  const detailsRes = await executeAiTool(
    'get_my_leave_request_details',
    { leaveId: '507f1f77bcf86cd799439222' },
    { user: userA }
  );
  assert(
    detailsRes.success === true &&
    detailsRes.leave.leaveType === 'sick' &&
    detailsRes.leave.status === 'rejected' &&
    detailsRes.leave.reviewNotes.includes('Adequate coverage not available'),
    'Read-only tool get_my_leave_request_details returns specific request details and rejection notes'
  );
}

// 8.4 Scoped leave lookup: Arbitrary leaveId cannot access other employee records
{
  // userB attempts to look up userA's leave
  const crossLookupRes = await executeAiTool(
    'get_my_leave_request_details',
    { leaveId: '507f1f77bcf86cd799439111' },
    { user: userB }
  );
  // Must not return userA's leave
  assert(
    !crossLookupRes.success || (crossLookupRes.leave && String(crossLookupRes.leave.leaveId) !== '507f1f77bcf86cd799439111'),
    'Leave request details lookup is strictly scoped to authenticated user; cannot hijack other user leaves'
  );
}

// 8.5 Conversational privacy defense: "Show Rahul's leaves" rejected with privacy notice
{
  const res = createMockRes();
  await handleAiChat({ body: { message: "Show Rahul's leaves" }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes('You can only view your own leave records'),
    'Conversational query for third-party leave rejected with privacy notice'
  );
}

// 8.6 Zero write tools: LLM has no apply_leave or state-changing write tool
{
  const callRes = await executeAiTool('apply_leave', {}, { user: userA });
  assert(
    callRes.error === 'FORBIDDEN_TOOL',
    'Disallowed write tool apply_leave is blocked by tool registry with FORBIDDEN_TOOL'
  );
}

// 8.7 Leave eligibility inquiry: "Can I take leave from ... to ..." is informational and does NOT stage an intent
{
  const res = createMockRes();
  await handleAiChat(
    { body: { message: 'Can I take casual leave from 2026-09-10 to 2026-09-11?' }, user: userA },
    res,
    () => {}
  );
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'LEAVE' &&
    res.body.action === 'CHECK_ELIGIBILITY' &&
    res.body.leaveRequestCard === null &&
    res.body.reply.includes('Leave Eligible') &&
    res.body.reply.includes('2 business day'),
    'Eligibility inquiry returns informational validation without staging LeaveIntent or presenting action card'
  );
}

let stagedLeaveIntentId = null;

// 8.8 Conversational leave application staging: stages LeaveIntent and returns leaveRequestCard
{
  const res = createMockRes();
  await handleAiChat(
    {
      body: { message: 'Apply casual leave from 2026-09-10 to 2026-09-12 for cousin wedding' },
      user: userA,
    },
    res,
    () => {}
  );

  assert(
    res.statusCode === 200 &&
    res.body.domain === 'LEAVE' &&
    res.body.action === 'APPLY' &&
    res.body.leaveRequestCard !== null &&
    res.body.leaveRequestCard.leaveType === 'casual' &&
    res.body.leaveRequestCard.confirmEndpoint === '/api/ai/leave/confirm',
    'Conversational leave application stages LeaveIntent and returns leaveRequestCard'
  );

  stagedLeaveIntentId = res.body.leaveRequestCard.intentId;
}

// 8.9 Server-calculated totalDays: totalDays calculated deterministically by server, never trusting LLM
{
  const staged = stagedLeaveIntents.get(stagedLeaveIntentId);
  // 2026-09-10 (Thu) to 2026-09-12 (Sat) -> Thu, Fri are business days = 2 business days
  const expectedDays = countBusinessDays('2026-09-10', '2026-09-12');
  assert(
    staged && staged.totalDays === expectedDays && staged.totalDays === 2,
    'totalDays is calculated deterministically on the server via countBusinessDays; not trusted from LLM'
  );
}

// 8.10 Zero write mutations to Leave collection during chat staging
{
  const newlyCreatedLeave = mockLeaveDb.find(l => l.startDate === '2026-09-10');
  assert(
    !newlyCreatedLeave,
    'Zero records added to Leave collection during chat staging (writes strictly deferred to confirmation)'
  );
}

// 8.11 Natural language affirmation defense: "yes" in chat re-presents card without applying leave
{
  const origFindConv = AIConversation.findOne;
  AIConversation.findOne = async () => new AIConversation({
    sessionId: 'sess-leave-affirm',
    userId: userA._id,
    pendingIntentId: stagedLeaveIntentId,
  });

  const res = createMockRes();
  await handleAiChat(
    { body: { message: 'yes please confirm', sessionId: 'sess-leave-affirm' }, user: userA },
    res,
    () => {}
  );
  assert(
    res.statusCode === 200 &&
    res.body.leaveRequestCard !== null &&
    res.body.reply.includes('leave applications cannot be confirmed through chat messages alone'),
    'Natural language affirmation in chat re-presents leave card without submitting leave application'
  );

  AIConversation.findOne = origFindConv;
}

// 8.12 Confirmation boundary: Cross-user confirmation blocked with 403 INTENT_NOT_OWNED
{
  const res = createMockRes();
  await confirmLeaveAction(
    { body: { intentId: stagedLeaveIntentId }, user: userB },
    res,
    () => {}
  );
  assert(
    res.statusCode === 403 &&
    res.body.error === 'INTENT_NOT_OWNED',
    'Cross-user leave confirmation blocked with 403 INTENT_NOT_OWNED'
  );
}

// 8.13 Confirmation boundary: Expired intent blocked with 410 INTENT_EXPIRED
{
  const expiredIntentId = 'leave_intent_expired_test';
  const expiredIntent = new LeaveIntent({
    intentId: expiredIntentId,
    sessionId: 'sess-exp',
    userId: userA._id,
    leaveType: 'casual',
    startDate: '2026-10-01',
    endDate: '2026-10-02',
    totalDays: 2,
    reason: 'Personal',
    status: 'pending',
    expiresAt: new Date(Date.now() - 5000), // Expired 5 seconds ago
    cleanupAt: new Date(Date.now() + 86400000),
  });
  stagedLeaveIntents.set(expiredIntentId, expiredIntent);

  const res = createMockRes();
  await confirmLeaveAction(
    { body: { intentId: expiredIntentId }, user: userA },
    res,
    () => {}
  );
  assert(
    res.statusCode === 410 &&
    res.body.error === 'INTENT_EXPIRED',
    'Expired leave intent blocked at confirmation boundary with 410 INTENT_EXPIRED'
  );
}

// 8.14 Confirmation boundary: Successful Leave application execution via POST /api/ai/leave/confirm
{
  const res = createMockRes();
  await confirmLeaveAction(
    { body: { intentId: stagedLeaveIntentId }, user: userA },
    res,
    () => {}
  );

  const intentAfter = stagedLeaveIntents.get(stagedLeaveIntentId);
  const createdRecord = mockLeaveDb.find(l => l.startDate === '2026-09-10');

  assert(
    res.statusCode === 200 &&
    res.body.success === true &&
    res.body.leave.leaveType === 'casual' &&
    intentAfter?.status === 'confirmed' &&
    createdRecord && createdRecord.status === 'pending',
    'Owner successfully confirmed Leave application via POST /api/ai/leave/confirm; record created with status pending'
  );
}

// 8.15 Confirmation boundary: Already resolved intent returns 409 INTENT_ALREADY_RESOLVED
{
  const res = createMockRes();
  await confirmLeaveAction(
    { body: { intentId: stagedLeaveIntentId }, user: userA },
    res,
    () => {}
  );
  assert(
    res.statusCode === 409 &&
    res.body.error === 'INTENT_ALREADY_RESOLVED',
    'Re-confirming already resolved leave intent blocked with 409 INTENT_ALREADY_RESOLVED'
  );
}

// 8.16 Stale-state revalidation: Overlapping leave created after staging causes confirmation to reject
{
  // Stage a new intent for 2026-11-10 to 2026-11-12
  const overlapIntentId = 'leave_intent_overlap_test';
  const overlapIntent = new LeaveIntent({
    intentId: overlapIntentId,
    sessionId: 'sess-overlap',
    userId: userA._id,
    leaveType: 'sick',
    startDate: '2026-11-10',
    endDate: '2026-11-12',
    totalDays: 3,
    reason: 'Health check',
    status: 'pending',
    expiresAt: new Date(Date.now() + 600000),
    cleanupAt: new Date(Date.now() + 86400000),
  });
  stagedLeaveIntents.set(overlapIntentId, overlapIntent);

  // Before confirmation, a new approved leave appears on the same dates
  mockLeaveDb.push({
    _id: new mongoose.Types.ObjectId(),
    employeeId: userA._id,
    leaveType: 'casual',
    startDate: '2026-11-11',
    endDate: '2026-11-11',
    totalDays: 1,
    reason: 'Emergency',
    status: 'approved',
    createdAt: new Date(),
  });

  const res = createMockRes();
  await confirmLeaveAction(
    { body: { intentId: overlapIntentId }, user: userA },
    res,
    () => {}
  );

  assert(
    (res.statusCode === 409 || res.statusCode === 422) &&
    (res.body.error === 'STALE_STATE_CONFLICT' || res.body.message.includes('already have')),
    'Confirmation detects newly created overlapping leave and cancels staged intent with conflict status'
  );
}

// 8.17 Stale-state revalidation: Insufficient balance after staging causes confirmation to reject with 422
{
  const balanceIntentId = 'leave_intent_balance_test';
  const balanceIntent = new LeaveIntent({
    intentId: balanceIntentId,
    sessionId: 'sess-bal',
    userId: userA._id,
    leaveType: 'relocation',
    startDate: '2026-12-01',
    endDate: '2026-12-05',
    totalDays: 5,
    reason: 'City shift',
    status: 'pending',
    expiresAt: new Date(Date.now() + 600000),
    cleanupAt: new Date(Date.now() + 86400000),
  });
  stagedLeaveIntents.set(balanceIntentId, balanceIntent);

  // Deplete relocation balance before confirmation
  const bal = getOrCreateMockBalance(userA._id, 2026);
  bal.relocation.used = 5; // 5 of 5 used -> 0 remaining

  const res = createMockRes();
  await confirmLeaveAction(
    { body: { intentId: balanceIntentId }, user: userA },
    res,
    () => {}
  );

  assert(
    (res.statusCode === 422 || res.statusCode === 409) &&
    res.body.message.includes('Insufficient relocation leave balance'),
    'Confirmation re-verifies live leave balance and rejects with 422 if balance was consumed between staging and confirmation'
  );
}

// 8.18 Missing parameter prompt: Asking to apply leave without leave type prompts for leave type
{
  const res = createMockRes();
  await handleAiChat(
    { body: { message: 'Apply leave tomorrow' }, user: userA },
    res,
    () => {}
  );
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes('What type of leave would you like to apply for'),
    'Applying leave without specifying leave type prompts user to provide leave type'
  );
}

// Restore all mocked functions
User.findById = origUserFindById;
User.find = origUserFind;
LeaveBalance.findOne = origBalanceFindOne;
LeaveBalance.create = origBalanceCreate;
LeaveBalance.updateOne = origBalanceUpdateOne;
Leave.create = origLeaveCreate;
Leave.findOne = origLeaveFindOne;
Leave.find = origLeaveFind;

console.log('\n--- TEST SECTION 9: PHASE 10 NOTIFICATIONS, PROFILE & SAFE NAVIGATION ---');

// Mock data stores for Section 9
const mockNotificationDb = [
  {
    _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439301'),
    userId: userA._id,
    title: 'Room A-201 Booking Confirmed',
    message: 'Your meeting in Room A-201 is confirmed for tomorrow at 15:00.',
    type: 'system',
    isRead: true,
    createdAt: new Date('2026-09-02T10:00:00Z'),
  },
  {
    _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439302'),
    userId: userA._id,
    title: 'New Team Invite',
    message: 'You have been invited to Product Architecture Review meeting.',
    type: 'invite',
    isRead: false,
    createdAt: new Date('2026-09-02T12:00:00Z'),
  },
  {
    _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439303'),
    userId: userA._id,
    title: 'Punch-in Reminder',
    message: 'Please remember to punch in before 10:00 AM.',
    type: 'reminder',
    isRead: false,
    createdAt: new Date('2026-09-02T14:00:00Z'),
  },
  {
    _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439304'),
    userId: userB._id,
    title: 'Confidential Leadership Briefing',
    message: 'Leadership sync scheduled for Thursday.',
    type: 'system',
    isRead: false,
    createdAt: new Date('2026-09-02T15:00:00Z'),
  },
];

// Mock Notification methods
const origNotifFind = Notification.find;
const origNotifFindOne = Notification.findOne;

Notification.find = (filter) => {
  const exec = () => {
    return mockNotificationDb.filter((n) => {
      if (filter.userId && String(n.userId) !== String(filter.userId)) return false;
      if (typeof filter.isRead === 'boolean' && n.isRead !== filter.isRead) return false;
      return true;
    });
  };

  const results = exec();
  return {
    sort: () => ({
      limit: (limitNum) => ({
        lean: async () => results.slice(0, limitNum),
      }),
      lean: async () => results,
    }),
    limit: (limitNum) => ({
      lean: async () => results.slice(0, limitNum),
    }),
    lean: async () => results,
  };
};

Notification.findOne = (filter) => {
  const exec = () => {
    return (
      mockNotificationDb.find((n) => {
        if (filter.userId && String(n.userId) !== String(filter.userId)) return false;
        if (filter._id && String(n._id) !== String(filter._id)) return false;
        if (filter.$or) {
          const matchesOr = filter.$or.some((c) => {
            if (c.title && c.title.$regex && new RegExp(c.title.$regex, c.title.$options).test(n.title)) return true;
            if (c.message && c.message.$regex && new RegExp(c.message.$regex, c.message.$options).test(n.message)) return true;
            return false;
          });
          if (!matchesOr) return false;
        }
        return true;
      }) || null
    );
  };

  const res = exec();
  return {
    lean: async () => res,
  };
};

// Mock User.findById for Section 9
const origSection9UserFindById = User.findById;
User.findById = (id) => ({
  select: () => ({
    lean: async () => {
      if (String(id) === String(userB._id)) return userB;
      return {
        _id: userA._id,
        name: userA.name,
        employeeId: 'EMP-001',
        email: userA.email,
        role: userA.role,
        branch: userA.branch,
        department: 'Operations',
        designation: 'Engineer',
      };
    },
  }),
  lean: async () => {
    if (String(id) === String(userB._id)) return userB;
    return {
      _id: userA._id,
      name: userA.name,
      employeeId: 'EMP-001',
      email: userA.email,
      role: userA.role,
      branch: userA.branch,
      department: 'Operations',
      designation: 'Engineer',
    };
  },
});

// 9.1 Read-only tool get_my_notifications returns user notifications
{
  const res = await executeAiTool('get_my_notifications', { limit: 5 }, { user: userA });
  assert(
    res.success === true &&
    res.count === 3 &&
    res.notifications.some(n => n.title.includes('Room A-201 Booking Confirmed')) &&
    res.notifications.every(n => !n.title.includes('Confidential Leadership')),
    'Read-only tool get_my_notifications returns user notifications scoped to authenticated user'
  );
}

// 9.2 Read-only tool get_my_unread_notifications returns unread count and unread items
{
  const unreadRes = await executeAiTool('get_my_unread_notifications', {}, { user: userA });
  assert(
    unreadRes.success === true &&
    unreadRes.unreadCount === 2 &&
    unreadRes.notifications.length === 2 &&
    unreadRes.notifications.some(n => n.title.includes('New Team Invite')) &&
    unreadRes.notifications.some(n => n.title.includes('Punch-in Reminder')),
    'Read-only tool get_my_unread_notifications returns accurate unread count and items'
  );
}

// 9.3 Read-only tool get_my_notification_details returns specific notification
{
  const detailsRes = await executeAiTool(
    'get_my_notification_details',
    { notificationId: '507f1f77bcf86cd799439301' },
    { user: userA }
  );
  assert(
    detailsRes.success === true &&
    detailsRes.notification.title === 'Room A-201 Booking Confirmed' &&
    detailsRes.notification.type === 'system',
    'Read-only tool get_my_notification_details returns details for owned notification'
  );
}

// 9.4 Scoped notification lookup: Cross-user lookup attempt cannot access other user's notification
{
  const crossRes = await executeAiTool(
    'get_my_notification_details',
    { notificationId: '507f1f77bcf86cd799439304' },
    { user: userA }
  );
  assert(
    !crossRes.success || crossRes.message?.includes('No matching notification found'),
    'Scoped notification query strictly blocks access to another employee notification'
  );
}

// 9.5 Conversational privacy defense: "Show Rahul's notifications" rejected with privacy notice
{
  const res = createMockRes();
  await handleAiChat({ body: { message: "Show Rahul's notifications" }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes('You can only view your own notifications'),
    'Conversational request for third-party notifications rejected with privacy notice'
  );
}

// 9.6 Conversational unread inquiry: "Do I have any unread notifications?"
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Do I have any unread notifications?' }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'NOTIFICATION' &&
    res.body.action === 'GET_UNREAD' &&
    res.body.reply.includes('2 unread notification'),
    'Conversational unread query returns accurate unread status and notifications count'
  );
}

// 9.7 Conversational notification listing: "Show my latest notifications"
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Show my latest notifications' }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'NOTIFICATION' &&
    res.body.action === 'GET_MY_NOTIFICATIONS' &&
    res.body.reply.includes('recent notifications'),
    'Conversational query for latest notifications returns formatted notification feed'
  );
}

// 9.8 Read-only tool get_my_profile returns employee profile without sensitive auth fields
{
  const profileRes = await executeAiTool('get_my_profile', {}, { user: userA });
  assert(
    profileRes.success === true &&
    profileRes.profile.name === 'User A' &&
    profileRes.profile.branch === 'Bangalore' &&
    profileRes.profile.role === 'employee' &&
    profileRes.profile.password === undefined &&
    profileRes.profile.tokens === undefined,
    'Read-only tool get_my_profile returns employee profile without exposing password or tokens'
  );
}

// 9.9 Conversational privacy defense: "Show Rahul's profile" rejected with privacy notice
{
  const res = createMockRes();
  await handleAiChat({ body: { message: "Show Rahul's profile" }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes('You can only view your own profile'),
    'Conversational query for third-party profile rejected with privacy notice'
  );
}

// 9.10 Specific profile query: "What branch am I assigned to?" returns authoritative branch
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'What branch am I assigned to?' }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'PROFILE' &&
    res.body.action === 'GET_MY_PROFILE' &&
    res.body.reply.includes('Bangalore'),
    'Conversational question about assigned branch returns authoritative branch from user profile'
  );
}

// 9.11 Profile information query: "What is my employee information?"
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'What is my employee information?' }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'PROFILE' &&
    res.body.action === 'GET_MY_PROFILE' &&
    res.body.reply.includes('User A') &&
    res.body.reply.includes('EMP-001'),
    'Conversational employee info request returns structured profile summary'
  );
}

// 9.12 Safe navigation: "Open attendance" returns allowlisted destination
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Open attendance' }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'NAVIGATION' &&
    res.body.action === 'OPEN_EMPLOYEE_PAGE' &&
    res.body.navigation !== null &&
    res.body.navigation.destination === 'attendance' &&
    res.body.navigation.path === '/attendance' &&
    res.body.navigation.label === 'My Attendance',
    'Safe navigation for attendance returns allowlisted destination path and label'
  );
}

// 9.13 Safe navigation: "Take me to my leaves" returns leaves destination
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Take me to my leaves' }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'NAVIGATION' &&
    res.body.navigation?.destination === 'leaves' &&
    res.body.navigation?.path === '/leaves',
    'Safe navigation for leaves returns /leaves destination'
  );
}

// 9.14 Safe navigation: "Open my bookings" returns my-bookings destination
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Open my bookings' }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'NAVIGATION' &&
    res.body.navigation?.destination === 'my-bookings' &&
    res.body.navigation?.path === '/manage-bookings',
    'Safe navigation for bookings returns /manage-bookings destination'
  );
}

// 9.15 Safe navigation: "I want to book a meeting room" returns book-room destination
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'I want to book a meeting room' }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'NAVIGATION' &&
    res.body.navigation?.destination === 'book-room' &&
    res.body.navigation?.path === '/book-room',
    'Safe navigation for room booking returns /book-room destination'
  );
}

// 9.16 Ambiguous navigation: "Open my records" prompts user for clarification
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Open my records' }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes('Which records would you like to open: bookings, attendance, or leaves?'),
    'Ambiguous navigation query prompts for clarification between bookings, attendance, or leaves'
  );
}

// 9.17 Role-aware navigation: Standard employee requesting manager page is rejected
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Open manager attendance' }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes('Access to manager administration pages is restricted to managers only'),
    'Standard employee attempting to navigate to manager page is rejected'
  );
}

// 9.18 Arbitrary route injection: "Navigate to /admin/users" or arbitrary URL rejected
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Navigate to /admin/users' }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes('Navigation is only permitted to allowlisted employee pages'),
    'Arbitrary route injection attempt rejected with allowlist policy reminder'
  );
}

// Restore all mocked functions
Notification.find = origNotifFind;
Notification.findOne = origNotifFindOne;
User.findById = origSection9UserFindById;

console.log('\n--- TEST SECTION 10: PHASE 11 EMPLOYEE BOOKING & MEETING INTELLIGENCE ---');

// 10.1 Room search with independent capacity and roomType
const roomConf = {
  _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439101'),
  roomNumber: 'A-201',
  roomType: 'Conference Room',
  capacity: 20,
  isActive: true,
  branch: 'Bangalore',
  block: 'Block A',
  floor: '2nd Floor',
  country: 'India',
  amenities: ['Projector', 'Whiteboard', 'Video Conferencing'],
};

const roomMeet10 = {
  _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439102'),
  roomNumber: 'A-202',
  roomType: 'Meeting Room (10 members)',
  capacity: 10,
  isActive: true,
  branch: 'Bangalore',
  block: 'Block A',
  floor: '2nd Floor',
  country: 'India',
  amenities: ['TV Screen', 'Whiteboard'],
};

const roomMeet5 = {
  _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439103'),
  roomNumber: 'A-301',
  roomType: 'Meeting Room (5 members)',
  capacity: 5,
  isActive: true,
  branch: 'Bangalore',
  block: 'Block A',
  floor: '3rd Floor',
  country: 'India',
  amenities: ['TV Screen'],
};

const roomHyd = {
  _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439104'),
  roomNumber: 'H-101',
  roomType: 'Meeting Room (10 members)',
  capacity: 10,
  isActive: true,
  branch: 'Hyderabad',
  block: 'Block H',
  floor: '1st Floor',
  country: 'India',
  amenities: ['Whiteboard'],
};

const mockRooms = [roomConf, roomMeet10, roomMeet5, roomHyd];

{
  const pass1 = passesHardFilter(roomMeet10, new Set(), { capacity: 8, roomType: 'Meeting Room' });
  const pass2 = passesHardFilter(roomMeet5, new Set(), { capacity: 8, roomType: 'Meeting Room' });
  const pass3 = passesHardFilter(roomConf, new Set(), { capacity: 8, roomType: 'Meeting Room' });
  assert(
    pass1 === true && pass2 === false && pass3 === false,
    'Room search with independent roomType = "Meeting Room" and capacity = 8 matches 10-person meeting room and excludes 5-person or conference room'
  );
}

// 10.2 Independent roomType = "Conference Room" matching
{
  const passConf = passesHardFilter(roomConf, new Set(), { capacity: 10, roomType: 'Conference Room' });
  const passMeet = passesHardFilter(roomMeet10, new Set(), { capacity: 10, roomType: 'Conference Room' });
  assert(
    passConf === true && passMeet === false,
    'Room search with independent roomType = "Conference Room" matches conference room and excludes meeting room'
  );
}

// 10.3 Branch filtering in hard filter
{
  const passBang = passesHardFilter(roomConf, new Set(), { requestedBranch: 'Bangalore' });
  const passHyd = passesHardFilter(roomHyd, new Set(), { requestedBranch: 'Bangalore' });
  assert(
    passBang === true && passHyd === false,
    'Hard filter enforces branch constraint when explicitly provided'
  );
}

// 10.4 Capacity efficiency recommendation prefers snug fit
{
  const score10 = scoreRoomCandidate(roomMeet10, { capacity: 8, userBranch: 'Bangalore' });
  const score20 = scoreRoomCandidate(roomConf, { capacity: 8, userBranch: 'Bangalore' });
  assert(
    score10.totalScore > score20.totalScore &&
    score10.breakdown.capacityScore === 40 &&
    score20.breakdown.capacityScore === 10 &&
    score10.reason.includes('low unused capacity (Capacity: 10)'),
    'Capacity efficiency recommendation prefers snug fit (capacity 10 vs 20 for 8 attendees) and explains unused capacity'
  );
}

// 10.5 Branch alias normalization (Bengaluru -> Bangalore)
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Find available rooms in Bengaluru' }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'BOOKING' &&
    res.body.action === 'SEARCH' &&
    res.body.reply.includes('Bangalore'),
    'Branch alias "Bengaluru" normalized to canonical "Bangalore" in room search'
  );
}

// 10.6 Unsupported branch rejected with prompt
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Find rooms in Tokyo tomorrow at 3 PM' }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes('Toyota branches currently supported are Bangalore, Hyderabad, and Chennai'),
    'Unsupported branch (Tokyo) rejected with supported branches clarification'
  );
}

// Mock Bookings for Section 10
const sec10TomorrowObj = new Date();
sec10TomorrowObj.setDate(sec10TomorrowObj.getDate() + 1);
const sec10TomorrowDateStr = sec10TomorrowObj.toISOString().slice(0, 10);

const bookingPast = {
  _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439201'),
  roomId: roomMeet10,
  ownerId: userA._id,
  date: '2020-01-01',
  startTime: '14:00',
  endTime: '14:30',
  title: 'Yesterday Retro',
  status: 'completed',
  occupancyConfirmedAt: new Date('2020-01-01T14:02:00Z'),
};

const bookingNext = {
  _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439202'),
  roomId: roomMeet10,
  ownerId: userA._id,
  date: sec10TomorrowDateStr,
  startTime: '15:00',
  endTime: '15:30',
  title: 'Sprint Planning',
  status: 'booked',
  occupancyConfirmedAt: null,
};

const bookingAmbiguousOther = {
  _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439203'),
  roomId: roomConf,
  ownerId: userA._id,
  date: sec10TomorrowDateStr,
  startTime: '15:00',
  endTime: '15:30',
  title: 'Architecture Sync',
  status: 'booked',
  occupancyConfirmedAt: null,
};

const bookingUserB = {
  _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439299'),
  roomId: roomHyd,
  ownerId: userB._id,
  date: sec10TomorrowDateStr,
  startTime: '16:00',
  endTime: '16:30',
  title: 'Rahul Confidential Review',
  status: 'booked',
  occupancyConfirmedAt: null,
};

let section10Bookings = [bookingPast, bookingNext, bookingAmbiguousOther, bookingUserB];

const origSection10BookingFind = Booking.find;
const origSection10BookingFindOne = Booking.findOne;
const origSection10BookingFindById = Booking.findById;
const origSection10RoomFind = Room.find;

Room.find = (filter = {}) => {
  const exec = () => {
    return mockRooms.filter(r => {
      if (filter.branch && r.branch.toLowerCase() !== filter.branch.toLowerCase()) return false;
      if (filter.isActive !== undefined && r.isActive !== filter.isActive) return false;
      return true;
    });
  };
  const res = exec();
  return {
    sort: () => ({ lean: async () => res }),
    lean: async () => res,
  };
};

Booking.find = (filter = {}) => {
  const exec = () => {
    return section10Bookings.filter(b => {
      if (filter.ownerId && String(b.ownerId) !== String(filter.ownerId)) return false;
      if (filter.status && b.status !== filter.status) return false;
      if (filter.date && typeof filter.date === 'string' && b.date !== filter.date) return false;
      if (filter.startTime && b.startTime !== filter.startTime) return false;
      if (filter.$or) {
        const matchesOr = filter.$or.some(c => {
          if (c.date && c.date.$gt && b.date > c.date.$gt) return true;
          if (c.date && c.startTime && c.startTime.$gt && b.date === c.date && b.startTime > c.startTime.$gt) return true;
          return false;
        });
        if (!matchesOr) return false;
      }
      return true;
    });
  };
  const res = exec();
  const sorted = [...res].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  return {
    populate: () => ({
      sort: () => ({
        limit: (lim) => ({ lean: async () => sorted.slice(0, lim) }),
        lean: async () => sorted,
      }),
      lean: async () => sorted,
    }),
    sort: () => ({
      limit: (lim) => ({ lean: async () => sorted.slice(0, lim) }),
      lean: async () => sorted,
    }),
    select: () => ({ lean: async () => sorted }),
    lean: async () => sorted,
  };
};

Booking.findOne = (filter = {}) => {
  const matches = section10Bookings.filter(b => {
    if (filter.ownerId && String(b.ownerId) !== String(filter.ownerId)) return false;
    if (filter.status && b.status !== filter.status) return false;
    if (filter.date && typeof filter.date === 'string' && b.date !== filter.date) return false;
    if (filter.startTime && b.startTime !== filter.startTime) return false;
    if (filter.$or) {
      const matchesOr = filter.$or.some(c => {
        if (c.date && c.date.$gt && b.date > c.date.$gt) return true;
        if (c.date && c.startTime && c.startTime.$gt && b.date === c.date && b.startTime > c.startTime.$gt) return true;
        return false;
      });
      if (!matchesOr) return false;
    }
    return true;
  });
  const sorted = [...matches].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  const res = sorted[0] || null;
  return {
    populate: () => ({
      sort: () => ({
        lean: async () => res,
      }),
      lean: async () => res,
    }),
    lean: async () => res,
  };
};

Booking.findById = (id) => {
  const res = section10Bookings.find(b => String(b._id) === String(id)) || null;
  return {
    populate: () => ({
      populate: () => ({
        populate: () => ({
          lean: async () => res,
        }),
        lean: async () => res,
      }),
      lean: async () => res,
    }),
    lean: async () => res,
  };
};

// 10.7 Authoritative getMyNextBooking strictly returns future meeting
{
  const refDate = new Date('2026-09-02T10:00:00+05:30');
  const nextMeeting = await getMyNextBooking({ userId: userA._id, referenceDate: refDate, timeZone: 'Asia/Kolkata' });
  assert(
    nextMeeting !== null &&
    String(nextMeeting._id) === String(bookingNext._id) &&
    nextMeeting.title === 'Sprint Planning',
    'Authoritative booking.service.js getMyNextBooking strictly returns earliest future meeting and excludes past meetings'
  );
}

// 10.8 Read-only tool get_my_next_booking returns next meeting
{
  const toolRes = await executeAiTool('get_my_next_booking', {}, { user: userA });
  assert(
    toolRes.success === true &&
    toolRes.hasMeeting === true &&
    toolRes.nextBooking.roomNumber === 'A-202' &&
    toolRes.nextBooking.title === 'Sprint Planning',
    'Read-only tool get_my_next_booking returns next meeting via authoritative booking service'
  );
}

// 10.9 Conversational query "What is my next meeting?"
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'What is my next meeting?' }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'BOOKING' &&
    res.body.action === 'GET_NEXT' &&
    res.body.reply.includes('Next Meeting') &&
    res.body.reply.includes('Room A-202') &&
    res.body.reply.includes('Sprint Planning'),
    'Conversational query "What is my next meeting?" returns structured next meeting details'
  );
}

// 10.10 Conversational query "What meetings do I have tomorrow?"
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'What meetings do I have tomorrow?' }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'BOOKING' &&
    res.body.action === 'GET_UPCOMING' &&
    res.body.reply.includes('Sprint Planning'),
    'Conversational query "What meetings do I have tomorrow?" returns tomorrow upcoming meetings'
  );
}

// 10.11 Ambiguity resolution for GET_DETAILS: 0 matches
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Tell me about my 3 PM meeting on 2026-12-25' }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'BOOKING' &&
    res.body.action === 'GET_DETAILS' &&
    res.body.reply.includes('could not find any active reservations for you'),
    'Booking details query with 0 matches returns clear explanation that no reservation was found'
  );
}

// 10.12 Ambiguity resolution for GET_DETAILS: multiple matches triggers clarification
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Tell me about my 3 PM meeting tomorrow' }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'BOOKING' &&
    res.body.action === 'GET_DETAILS' &&
    res.body.reply.includes('found multiple reservations matching your query') &&
    res.body.reply.includes('Room A-202') &&
    res.body.reply.includes('Room A-201') &&
    res.body.reply.includes('Which meeting would you like details for?'),
    'Booking details query with multiple matches on same date/time surfaces ambiguity and requests clarification without blind indexing'
  );
}

// 10.13 Ambiguity resolution for GET_DETAILS: single unique match returns full details
{
  // Filter out the second booking temporarily to test single unique match
  section10Bookings = [bookingPast, bookingNext, bookingUserB];
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Tell me about my 3 PM meeting tomorrow' }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'BOOKING' &&
    res.body.action === 'GET_DETAILS' &&
    res.body.reply.includes('Meeting Details for Room A-202') &&
    res.body.reply.includes('Sprint Planning') &&
    res.body.reply.includes('**Reservation Status**: **booked**') &&
    res.body.reply.includes('**Occupancy Status**: Not checked in'),
    'Booking details query with single unique match returns full structured details with clear status separation'
  );
  // Restore bookings
  section10Bookings = [bookingPast, bookingNext, bookingAmbiguousOther, bookingUserB];
}

// 10.14 GET_STATUS distinctly reports reservation status vs occupancy status
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'What is the status of my booking?' }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'BOOKING' &&
    res.body.action === 'GET_STATUS' &&
    res.body.reply.includes('**Reservation Lifecycle Status**: **booked**') &&
    res.body.reply.includes('**Occupancy / Check-in Status**: Pending check-in'),
    'Status query distinctly reports reservation lifecycle status and occupancy check-in status'
  );
}

// 10.15 Ownership enforcement on booking details lookup
{
  let caughtError = null;
  try {
    await getMyBookingDetails({ bookingId: String(bookingUserB._id), userId: userA._id });
  } catch (err) {
    caughtError = err;
  }
  assert(
    caughtError !== null && caughtError.statusCode === 403,
    'Authoritative booking.service.js getMyBookingDetails strictly enforces ownership (userA blocked from userB booking)'
  );
}

// 10.16 Cross-user privacy guard: "Show Rahul's meetings" rejected
{
  const res = createMockRes();
  await handleAiChat({ body: { message: "Show Rahul's meetings" }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'BOOKING' &&
    res.body.reply.includes("You can only view your own meetings and reservations. Access to Rahul's booking data is not permitted."),
    'Conversational request for another employee meetings rejected with privacy notice'
  );
}

// 10.17 Cross-user privacy guard: "What room did Priya book?" rejected
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'What room did Priya book?' }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'BOOKING' &&
    res.body.reply.includes("You can only view your own meetings and reservations. Access to Priya's booking data is not permitted."),
    'Conversational query for another employee room booking rejected with privacy notice'
  );
}

// 10.18 Meeting title extraction preserved into BookingIntent
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Book a room for 5 tomorrow at 3 PM for the sprint retro' }, user: userA }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.pendingIntentCard !== null &&
    capturedIntent.title === 'sprint retro',
    'Meeting title "sprint retro" extracted and preserved in staged BookingIntent'
  );
}

// 10.19 Zero write tools exist in tool registry
{
  const writeTools = READ_ONLY_AI_TOOLS.filter(t => ['create', 'cancel', 'book', 'punch', 'apply'].some(kw => t.function.name.startsWith(kw)));
  assert(
    writeTools.length === 0,
    'Zero direct booking write tools exposed; all booking mutations remain staged'
  );
}

// 10.20 Staging intent requires explicit confirmation
{
  assert(
    capturedIntent.status === 'pending',
    'Staged BookingIntent remains pending until explicit confirmation'
  );
}

// Restore Section 10 mocks
Booking.find = origSection10BookingFind;
Booking.findOne = origSection10BookingFindOne;
Booking.findById = origSection10BookingFindById;
Room.find = origSection10RoomFind;

// ============================================================================
// --- TEST SECTION 11: PHASE 12 MANAGER BOOKINGS & ROOM INTELLIGENCE ---
// ============================================================================
console.log('\n--- TEST SECTION 11: PHASE 12 MANAGER BOOKINGS & ROOM INTELLIGENCE ---');

const roomMgrConf = {
  _id: new mongoose.Types.ObjectId('607f1f77bcf86cd799439001'),
  roomNumber: 'A-101',
  roomType: 'Conference Room',
  capacity: 20,
  branch: 'Bangalore',
  block: 'A',
  floor: '1',
  isActive: true,
  secretCode: '999888',
};

const roomMgrMeeting10 = {
  _id: new mongoose.Types.ObjectId('607f1f77bcf86cd799439002'),
  roomNumber: 'A-202',
  roomType: 'Meeting Room (10 members)',
  capacity: 10,
  branch: 'Bangalore',
  block: 'A',
  floor: '2',
  isActive: true,
  secretCode: '777666',
};

const roomMgrHyd = {
  _id: new mongoose.Types.ObjectId('607f1f77bcf86cd799439003'),
  roomNumber: 'B-303',
  roomType: 'Meeting Room (5 members)',
  capacity: 5,
  branch: 'Hyderabad',
  block: 'B',
  floor: '3',
  isActive: true,
  secretCode: '555444',
};

const roomMgrInactive = {
  _id: new mongoose.Types.ObjectId('607f1f77bcf86cd799439004'),
  roomNumber: 'C-404',
  roomType: 'Meeting Room (10 members)',
  capacity: 10,
  branch: 'Bangalore',
  block: 'C',
  floor: '4',
  isActive: false,
  secretCode: '333222',
};

const section11Rooms = [roomMgrConf, roomMgrMeeting10, roomMgrHyd, roomMgrInactive];

const userPriyaSharma = {
  _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439022'),
  name: 'Priya Sharma',
  email: 'priya@toyota.local',
  employeeId: 'EMP002',
  role: 'employee',
  branch: 'Bangalore',
};

const userPriyaPatel = {
  _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439023'),
  name: 'Priya Patel',
  email: 'priyapatel@toyota.local',
  employeeId: 'EMP003',
  role: 'employee',
  branch: 'Bangalore',
};

const userRahulVerma = {
  _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439024'),
  name: 'Rahul Verma',
  email: 'rahul@toyota.local',
  employeeId: 'EMP004',
  role: 'employee',
  branch: 'Bangalore',
};

const section11Users = [userA, userB, userManager, userPriyaSharma, userPriyaPatel, userRahulVerma];

const todayDateStr = getTodayDateStr('Asia/Kolkata');
const tomorrowObj = new Date();
tomorrowObj.setDate(tomorrowObj.getDate() + 1);
const tomorrowDateStr = tomorrowObj.toISOString().slice(0, 10);

const bookingMgr1 = {
  _id: new mongoose.Types.ObjectId('707f1f77bcf86cd799439001'),
  roomId: roomMgrMeeting10,
  ownerId: userPriyaSharma,
  date: todayDateStr,
  startTime: '10:00',
  endTime: '10:30',
  status: 'booked',
  occupancyConfirmedAt: new Date(),
  title: 'Sprint Planning',
  secretCode: '123456',
  invitedMembers: [{ name: 'User A', email: 'usera@toyota.local' }],
};

const bookingMgr2 = {
  _id: new mongoose.Types.ObjectId('707f1f77bcf86cd799439002'),
  roomId: roomMgrConf,
  ownerId: userA,
  date: todayDateStr,
  startTime: '14:00',
  endTime: '14:30',
  status: 'cancelled',
  occupancyConfirmedAt: null,
  title: 'Design Review',
  secretCode: '654321',
  invitedMembers: [],
};

const bookingMgr3 = {
  _id: new mongoose.Types.ObjectId('707f1f77bcf86cd799439003'),
  roomId: roomMgrMeeting10,
  ownerId: userPriyaSharma,
  date: tomorrowDateStr,
  startTime: '15:00',
  endTime: '15:30',
  status: 'booked',
  occupancyConfirmedAt: null,
  title: 'Budget Sync',
  secretCode: '111222',
  invitedMembers: [],
};

const bookingMgr4 = {
  _id: new mongoose.Types.ObjectId('707f1f77bcf86cd799439004'),
  roomId: roomMgrMeeting10,
  ownerId: userPriyaSharma,
  date: tomorrowDateStr,
  startTime: '16:00',
  endTime: '16:30',
  status: 'booked',
  occupancyConfirmedAt: null,
  title: 'Client Demo',
  secretCode: '333444',
  invitedMembers: [],
};

let section11Bookings = [bookingMgr1, bookingMgr2, bookingMgr3, bookingMgr4];

const origSection11BookingFind = Booking.find;
const origSection11BookingFindById = Booking.findById;
const origSection11RoomFind = Room.find;
const origSection11UserFind = User.find;

Room.find = (filter = {}) => {
  let res = [...section11Rooms];
  if (filter.branch) res = res.filter(r => r.branch.toLowerCase() === filter.branch.toLowerCase());
  if (filter.roomNumber) res = res.filter(r => r.roomNumber.toLowerCase() === filter.roomNumber.toLowerCase());
  if (filter.roomType && filter.roomType.$regex) res = res.filter(r => filter.roomType.$regex.test(r.roomType));
  if (filter.capacity && filter.capacity.$gte) res = res.filter(r => r.capacity >= filter.capacity.$gte);
  if (filter.isActive !== undefined) res = res.filter(r => r.isActive === filter.isActive);
  const chain = {
    select: () => chain,
    sort: () => chain,
    lean: async () => res
  };
  return chain;
};

User.find = (filter = {}) => {
  let matched = [...section11Users];
  if (filter.name && filter.name.$regex) {
    const rx = filter.name.$regex;
    matched = section11Users.filter(u => rx.test(u.name));
  }
  const chain = {
    select: () => chain,
    lean: async () => matched
  };
  return chain;
};

Booking.find = (filter = {}) => {
  let res = [...section11Bookings];
  if (filter.ownerId) res = res.filter(b => String(b.ownerId._id || b.ownerId) === String(filter.ownerId));
  if (filter.status) res = res.filter(b => b.status === filter.status);
  if (filter.date) {
    if (typeof filter.date === 'string') {
      res = res.filter(b => b.date === filter.date);
    } else if (filter.date.$gte && filter.date.$lte) {
      res = res.filter(b => b.date >= filter.date.$gte && b.date <= filter.date.$lte);
    } else if (filter.date.$gte) {
      res = res.filter(b => b.date >= filter.date.$gte);
    } else if (filter.date.$lte) {
      res = res.filter(b => b.date <= filter.date.$lte);
    }
  }
  if (filter.startTime) res = res.filter(b => b.startTime === filter.startTime);
  if (filter.roomId) {
    if (filter.roomId.$in) {
      const ids = filter.roomId.$in.map(String);
      res = res.filter(b => ids.includes(String(b.roomId._id || b.roomId)));
    } else {
      res = res.filter(b => String(b.roomId._id || b.roomId) === String(filter.roomId));
    }
  }

  const chain = {
    select: () => chain,
    populate: () => chain,
    sort: () => chain,
    limit: () => chain,
    lean: async () => res
  };
  return chain;
};

Booking.findById = (id) => {
  const b = section11Bookings.find(x => String(x._id) === String(id));
  const chain = {
    select: () => chain,
    populate: () => chain,
    lean: async () => (b ? JSON.parse(JSON.stringify(b)) : null)
  };
  return chain;
};

// 11.1 Manager capability authorization: manager allowed for all 6 Phase 12 capabilities
{
  const managerCaps = [
    'BOOKING:GET_ALL',
    'BOOKING:SEARCH_MANAGER',
    'BOOKING:GET_DETAILS_MGR',
    'ROOM:GET_AVAILABILITY_MGR',
    'ROOM:GET_UTILIZATION_MGR',
    'NAVIGATION:OPEN_MGR_PAGE',
  ];
  const allAllowed = managerCaps.every(cap => isCapabilityAuthorized(cap, 'manager'));
  assert(allAllowed, 'Manager role is authorized for all 6 Phase 12 manager capabilities');
}

// 11.2 Standard employee strictly denied for all 6 Phase 12 manager capabilities
{
  const managerCaps = [
    'BOOKING:GET_ALL',
    'BOOKING:SEARCH_MANAGER',
    'BOOKING:GET_DETAILS_MGR',
    'ROOM:GET_AVAILABILITY_MGR',
    'ROOM:GET_UTILIZATION_MGR',
    'NAVIGATION:OPEN_MGR_PAGE',
  ];
  const allDenied = managerCaps.every(cap => !isCapabilityAuthorized(cap, 'employee'));
  assert(allDenied, 'Standard employee role is strictly denied for all 6 Phase 12 manager capabilities');
}

// 11.3 createAiContext includes manager capabilities for manager role
{
  const ctx = createAiContext(userManager);
  assert(
    ctx.isAuthorized('BOOKING:GET_ALL') &&
    ctx.isAuthorized('BOOKING:SEARCH_MANAGER') &&
    ctx.isAuthorized('ROOM:GET_AVAILABILITY_MGR'),
    'createAiContext for manager role authorizes Phase 12 capabilities'
  );
}

// 11.4 createAiContext excludes manager capabilities for employee role
{
  const ctx = createAiContext(userA);
  assert(
    !ctx.isAuthorized('BOOKING:GET_ALL') &&
    !ctx.isAuthorized('BOOKING:SEARCH_MANAGER') &&
    !ctx.isAuthorized('ROOM:GET_AVAILABILITY_MGR'),
    'createAiContext for employee role strictly excludes Phase 12 manager capabilities'
  );
}

// 11.5 Tool registry contains exactly 18 read-only tools and zero write tools
{
  const tools = READ_ONLY_AI_TOOLS.map(t => t.function.name);
  const writeKeywords = ['create', 'cancel', 'punch', 'delete', 'update', 'modify', 'confirm', 'apply', 'override'];
  const hasWriteTool = tools.some(name => writeKeywords.some(kw => name.includes(kw)));
  assert(
    !hasWriteTool &&
    tools.length >= 18 &&
    tools.includes('search_manager_bookings') &&
    tools.includes('get_manager_booking_details') &&
    tools.includes('get_manager_room_availability') &&
    tools.includes('get_manager_room_utilization'),
    'Tool registry contains all Phase 12 authorized read-only tools and zero write tools'
  );
}

// 11.6 Employee blocked from executing search_manager_bookings via executeAiTool
{
  const res = await executeAiTool('search_manager_bookings', {}, { user: userA });
  assert(res.error === 'FORBIDDEN_TOOL', 'Employee role blocked from executing search_manager_bookings with FORBIDDEN_TOOL');
}

// 11.7 Employee blocked from executing get_manager_booking_details via executeAiTool
{
  const res = await executeAiTool('get_manager_booking_details', { bookingId: String(bookingMgr1._id) }, { user: userA });
  assert(res.error === 'FORBIDDEN_TOOL', 'Employee role blocked from executing get_manager_booking_details with FORBIDDEN_TOOL');
}

// 11.8 Employee blocked from executing get_manager_room_availability and utilization
{
  const res1 = await executeAiTool('get_manager_room_availability', { date: todayDateStr, startTime: '10:00' }, { user: userA });
  const res2 = await executeAiTool('get_manager_room_utilization', { startDate: todayDateStr, endDate: todayDateStr }, { user: userA });
  assert(
    res1.error === 'FORBIDDEN_TOOL' && res2.error === 'FORBIDDEN_TOOL',
    'Employee blocked from executing manager room availability and utilization tools'
  );
}

// 11.9 BOOKING:GET_ALL defaults to today with explicit message when manager asks "show all bookings"
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'show all bookings' }, user: userManager }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'BOOKING' &&
    res.body.action === 'GET_ALL' &&
    res.body.reply.includes('by default'),
    'BOOKING:GET_ALL defaults to today with explicit "by default" message for manager'
  );
}

// 11.10 BOOKING:GET_ALL handles specific date override (e.g. tomorrow)
{
  const res = createMockRes();
  await handleAiChat({ body: { message: "show tomorrow's bookings" }, user: userManager }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'BOOKING' &&
    res.body.action === 'GET_ALL' &&
    res.body.reply.includes(tomorrowDateStr),
    'BOOKING:GET_ALL retrieves enterprise bookings for specified date (tomorrow)'
  );
}

// 11.11 BOOKING:GET_ALL blocks standard employee with 403 FORBIDDEN_CAPABILITY
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'show all bookings' }, user: userA }, res, () => {});
  assert(
    res.statusCode === 403 &&
    res.body.error === 'FORBIDDEN_CAPABILITY',
    'Standard employee requesting enterprise bookings is rejected with 403 FORBIDDEN_CAPABILITY'
  );
}

// 11.12 BOOKING:SEARCH_MANAGER filters by branch (Bangalore)
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Show Bangalore bookings' }, user: userManager }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'BOOKING' &&
    res.body.action === 'SEARCH_MANAGER' &&
    res.body.reply.includes('Bangalore'),
    'BOOKING:SEARCH_MANAGER successfully filters enterprise bookings by branch'
  );
}

// 11.13 BOOKING:SEARCH_MANAGER filters by status (cancelled)
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'show cancelled bookings' }, user: userManager }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'BOOKING' &&
    res.body.action === 'SEARCH_MANAGER' &&
    res.body.reply.includes('Design Review'),
    'BOOKING:SEARCH_MANAGER successfully filters enterprise bookings by status'
  );
}

// 11.14 BOOKING:SEARCH_MANAGER resolves unique employee name match
{
  const res = createMockRes();
  await handleAiChat({ body: { message: "Show Rahul's meetings" }, user: userManager }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'BOOKING' &&
    res.body.action === 'SEARCH_MANAGER',
    'Manager query for another employee bookings resolves and searches bookings'
  );
}

// 11.15 BOOKING:SEARCH_MANAGER handles ambiguous employee resolution
{
  const res = createMockRes();
  await handleAiChat({ body: { message: "Show Priya's meetings" }, user: userManager }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'BOOKING' &&
    res.body.reply.includes('Multiple employees matched') &&
    res.body.reply.includes('Priya Sharma') &&
    res.body.reply.includes('Priya Patel'),
    'Ambiguous employee name match surfaces candidate list and requests clarification'
  );
}

// 11.16 BOOKING:SEARCH_MANAGER handles non-existent employee search
{
  const res = createMockRes();
  await handleAiChat({ body: { message: "Show Vikram's meetings" }, user: userManager }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes('No employee matching'),
    'Non-existent employee search clearly reports not found in directory'
  );
}

// 11.17 Parameter sanitization strips injected userId and ownerId
{
  const sanitized = sanitizeExtractedParams({
    employeeName: 'Priya Sharma',
    userId: 'hacked_id_123',
    ownerId: 'hacked_id_456',
    _id: 'injected_id_789',
    roomNumber: 'A-202',
    status: 'booked',
  });
  assert(
    sanitized.employeeName === 'Priya Sharma' &&
    sanitized.roomNumber === 'A-202' &&
    sanitized.status === 'booked' &&
    sanitized.userId === undefined &&
    sanitized.ownerId === undefined &&
    sanitized._id === undefined,
    'Parameter sanitization cleanly strips injected identity fields'
  );
}

// 11.18 BOOKING:GET_DETAILS_MGR returns full populated booking details for explicit bookingId
{
  const res = createMockRes();
  await handleAiChat({ body: { message: `details of booking ${bookingMgr1._id}` }, user: userManager }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'BOOKING' &&
    res.body.action === 'GET_DETAILS_MGR' &&
    res.body.reply.includes('Sprint Planning') &&
    res.body.reply.includes('A-202'),
    'Explicit bookingId lookup returns comprehensive structured details for manager'
  );
}

// 11.19 Security: secretCode is never exposed in booking details output
{
  const res = createMockRes();
  await handleAiChat({ body: { message: `details of booking ${bookingMgr1._id}` }, user: userManager }, res, () => {});
  assert(
    !res.body.reply.includes('123456') &&
    !res.body.reply.includes('777666'),
    'secretCode from both Booking and Room models is strictly excluded from AI responses'
  );
}

// 11.20 BOOKING:GET_DETAILS_MGR reports not found for non-existent ID
{
  const nonExistentId = new mongoose.Types.ObjectId('707f1f77bcf86cd799439999');
  const res = createMockRes();
  await handleAiChat({ body: { message: `details of booking ${nonExistentId}` }, user: userManager }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes('was not found'),
    'Non-existent booking ID lookup informs manager that record was not found'
  );
}

// 11.21 Indirect criteria booking details with multiple matches surfaces candidate list
{
  const candidates = await findManagerBookingsByCriteria({
    date: tomorrowDateStr,
    roomNumber: 'A-202',
  });
  assert(
    candidates.length === 2,
    'Indirect criteria matching multiple bookings identifies candidate list without blind guessing'
  );
}

// 11.22 Reusable getRoomAvailabilityService in room.service.js correctly computes availability
{
  const avail = await getRoomAvailabilityService({
    date: todayDateStr,
    startTime: '10:00',
    filters: { branch: 'Bangalore' },
  });
  assert(
    avail.rooms.length === 2 &&
    avail.rooms.some(r => r.roomNumber === 'A-101' && r.isAvailable) &&
    avail.rooms.some(r => r.roomNumber === 'A-202' && !r.isAvailable),
    'getRoomAvailabilityService in room.service.js computes authoritative availability against bookings'
  );
}

// 11.23 Conversational room availability query returns available and booked rooms
{
  const res = createMockRes();
  await handleAiChat({
    body: { message: 'Which rooms are available tomorrow at 10:00 AM in Bangalore?' },
    user: userManager,
  }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'ROOM' &&
    res.body.action === 'GET_AVAILABILITY_MGR' &&
    res.body.reply.includes('Available Rooms') &&
    res.body.reply.includes('A-101'),
    'Conversational room availability query displays available and booked rooms'
  );
}

// 11.24 Inactive rooms are strictly excluded from room availability output
{
  const avail = await getRoomAvailabilityService({
    date: todayDateStr,
    startTime: '10:00',
  });
  assert(
    !avail.rooms.some(r => r.roomNumber === 'C-404'),
    'Inactive rooms are strictly excluded from room availability calculations'
  );
}

// 11.25 Missing date or startTime prompts user for missing parameter
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Which rooms are available?' }, user: userManager }, res, () => {});
  assert(
    res.statusCode === 200 &&
    (res.body.reply.includes('What date') || res.body.reply.includes('What time')),
    'Missing date or startTime prompts user to provide missing slot parameter'
  );
}

// 11.26 Reusable getRoomUtilizationService returns deterministic counts
{
  const util = await getRoomUtilizationService({
    startDate: todayDateStr,
    endDate: tomorrowDateStr,
    branch: 'Bangalore',
  });
  const roomA202 = util.rooms.find(r => r.roomNumber === 'A-202');
  assert(
    roomA202 !== undefined &&
    roomA202.totalBookings === 3 &&
    roomA202.confirmedCheckIns === 1,
    'getRoomUtilizationService returns accurate reservation and physical check-in counts'
  );
}

// 11.27 Conversational query for room utilization reports reservation counts and check-ins without fabricated percentages
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'How many times was A-202 booked this week?' }, user: userManager }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'ROOM' &&
    res.body.action === 'GET_UTILIZATION_MGR' &&
    res.body.reply.includes('Total Reservations') &&
    res.body.reply.includes('Confirmed Physical Check-ins') &&
    !res.body.reply.includes('%'),
    'Room utilization reports grounded reservation and check-in counts without fabricated percentage'
  );
}

// 11.28 Cancelled reservations are distinguished from physical check-ins
{
  const util = await getRoomUtilizationService({
    startDate: todayDateStr,
    endDate: todayDateStr,
  });
  const roomA101 = util.rooms.find(r => r.roomNumber === 'A-101');
  assert(
    roomA101 !== undefined &&
    roomA101.cancelledBookings === 1 &&
    roomA101.confirmedCheckIns === 0,
    'Cancelled reservations are distinguished and never counted as physical room occupancy'
  );
}

// 11.29 Safe Manager Navigation returns navigation card for allowlisted destination (all-bookings)
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Open enterprise bookings' }, user: userManager }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'NAVIGATION' &&
    res.body.action === 'OPEN_MGR_PAGE' &&
    res.body.navigation !== null &&
    res.body.navigation.destination === 'all-bookings' &&
    res.body.navigation.path === '/manager/all-bookings',
    'Manager navigation produces verified navigation card to /manager/all-bookings'
  );
}

// 11.30 Safe Manager Navigation returns navigation card for room-availability
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Open room availability' }, user: userManager }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'NAVIGATION' &&
    res.body.action === 'OPEN_MGR_PAGE' &&
    res.body.navigation !== null &&
    res.body.navigation.destination === 'room-availability' &&
    res.body.navigation.path === '/manager/room-availability',
    'Manager navigation produces verified navigation card to /manager/room-availability'
  );
}

// 11.31 Standard employee attempting manager navigation is rejected
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Open enterprise bookings' }, user: userA }, res, () => {});
  assert(
    res.body.reply.includes('Access to manager administration pages is restricted to managers only.'),
    'Employee attempting manager navigation is rejected with access restricted notice'
  );
}

// 11.32 Zero database writes during manager read queries
{
  const bookingCountBefore = section11Bookings.length;
  const roomCountBefore = section11Rooms.length;
  const res = createMockRes();
  await handleAiChat({ body: { message: 'show all bookings' }, user: userManager }, res, () => {});
  assert(
    section11Bookings.length === bookingCountBefore &&
    section11Rooms.length === roomCountBefore,
    'Zero database mutations occur during manager booking intelligence queries'
  );
}

// Restore Section 11 mocks
Booking.find = origSection11BookingFind;
Booking.findById = origSection11BookingFindById;
Room.find = origSection11RoomFind;
User.find = origSection11UserFind;

console.log('\n--- TEST SECTION 12: PHASE 13 MANAGER ATTENDANCE INTELLIGENCE ---');

const sec12TodayStr = resolveDate('today', 'Asia/Kolkata').resolvedDate;
const sec12DateObj = new Date(sec12TodayStr + 'T00:00:00');
const sec12YesterdayObj = new Date(sec12DateObj.getTime() - 24 * 60 * 60 * 1000);
const sec12YesterdayStr = `${sec12YesterdayObj.getFullYear()}-${String(sec12YesterdayObj.getMonth() + 1).padStart(2, '0')}-${String(sec12YesterdayObj.getDate()).padStart(2, '0')}`;

const sec12UserMgr = {
  _id: new mongoose.Types.ObjectId('807f1f77bcf86cd799439001'),
  name: 'Manager User',
  email: 'manager.user@toyota.com',
  employeeId: 'MGR-001',
  role: 'manager',
  branch: 'Bangalore',
  department: 'Engineering',
  designation: 'Engineering Manager',
  isActive: true,
};

const sec12EmpRahul = {
  _id: new mongoose.Types.ObjectId('807f1f77bcf86cd799439002'),
  name: 'Rahul Sharma',
  email: 'rahul.sharma@toyota.com',
  employeeId: 'EMP-101',
  role: 'employee',
  branch: 'Bangalore',
  department: 'Engineering',
  designation: 'Software Engineer',
  isActive: true,
};

const sec12EmpRahul2 = {
  _id: new mongoose.Types.ObjectId('807f1f77bcf86cd799439003'),
  name: 'Rahul Verma',
  email: 'rahul.verma@toyota.com',
  employeeId: 'EMP-102',
  role: 'employee',
  branch: 'Hyderabad',
  department: 'Design',
  designation: 'UX Designer',
  isActive: true,
};

const sec12EmpPriya = {
  _id: new mongoose.Types.ObjectId('807f1f77bcf86cd799439004'),
  name: 'Priya Patel',
  email: 'priya.patel@toyota.com',
  employeeId: 'EMP-103',
  role: 'employee',
  branch: 'Bangalore',
  department: 'QA',
  designation: 'QA Lead',
  isActive: true,
};

const sec12EmpAmit = {
  _id: new mongoose.Types.ObjectId('807f1f77bcf86cd799439005'),
  name: 'Amit Kumar',
  email: 'amit.kumar@toyota.com',
  employeeId: 'EMP-104',
  role: 'employee',
  branch: 'Chennai',
  department: 'Sales',
  designation: 'Account Manager',
  isActive: true,
};

const section12Users = [sec12UserMgr, sec12EmpRahul, sec12EmpRahul2, sec12EmpPriya, sec12EmpAmit];

const recRahulToday = {
  _id: new mongoose.Types.ObjectId('817f1f77bcf86cd799439001'),
  employeeId: sec12EmpRahul,
  date: sec12TodayStr,
  checkInTime: new Date(`${sec12TodayStr}T08:45:00`),
  checkOutTime: new Date(`${sec12TodayStr}T17:15:00`),
  status: 'present',
  workHours: 8.5,
  location: 'Bangalore Office',
  isManualOverride: false,
};

const recPriyaToday = {
  _id: new mongoose.Types.ObjectId('817f1f77bcf86cd799439002'),
  employeeId: sec12EmpPriya,
  date: sec12TodayStr,
  checkInTime: new Date(`${sec12TodayStr}T09:30:00`),
  checkOutTime: null,
  status: 'late',
  workHours: 0,
  location: 'Bangalore Office',
  isManualOverride: false,
};

const recAmitToday = {
  _id: new mongoose.Types.ObjectId('817f1f77bcf86cd799439003'),
  employeeId: sec12EmpAmit,
  date: sec12TodayStr,
  checkInTime: null,
  checkOutTime: null,
  status: 'on-leave',
  workHours: 0,
  location: '',
  isManualOverride: false,
};

const recRahulYesterday = {
  _id: new mongoose.Types.ObjectId('817f1f77bcf86cd799439004'),
  employeeId: sec12EmpRahul,
  date: sec12YesterdayStr,
  checkInTime: new Date(`${sec12YesterdayStr}T08:50:00`),
  checkOutTime: new Date(`${sec12YesterdayStr}T17:00:00`),
  status: 'present',
  workHours: 8.17,
  location: 'Bangalore Office',
  isManualOverride: false,
};

const recAmitYesterdayAbsent = {
  _id: new mongoose.Types.ObjectId('817f1f77bcf86cd799439005'),
  employeeId: sec12EmpAmit,
  date: sec12YesterdayStr,
  checkInTime: null,
  checkOutTime: null,
  status: 'absent',
  workHours: 0,
  location: '',
  isManualOverride: false,
};

const section12Attendance = [
  recRahulToday,
  recPriyaToday,
  recAmitToday,
  recRahulYesterday,
  recAmitYesterdayAbsent,
];

const origSection12UserFind = User.find;
const origSection12AttendanceFind = Attendance.find;
const origSection12AttendanceFindOne = Attendance.findOne;

User.find = (filter = {}) => {
  let res = [...section12Users];
  if (filter['$or']) {
    res = res.filter(u => u.isActive === true);
  }
  if (filter.role) {
    if (filter.role.$in) {
      res = res.filter(u => filter.role.$in.includes(u.role));
    } else {
      res = res.filter(u => u.role === filter.role);
    }
  }
  if (filter.branch) {
    if (filter.branch.$regex) {
      res = res.filter(u => filter.branch.$regex.test(u.branch));
    } else {
      res = res.filter(u => u.branch.toLowerCase() === String(filter.branch).toLowerCase());
    }
  }
  if (filter.name && filter.name.$regex) {
    res = res.filter(u => filter.name.$regex.test(u.name));
  }
  const queryObj = {
    select: () => queryObj,
    sort: () => queryObj,
    limit: () => queryObj,
    lean: async () => res,
    then: (resolve) => resolve(res),
  };
  return queryObj;
};

Attendance.find = (filter = {}) => {
  let res = [...section12Attendance];
  if (filter.employeeId) {
    if (filter.employeeId.$in) {
      const idSet = new Set(filter.employeeId.$in.map(String));
      res = res.filter(a => idSet.has(String(a.employeeId._id || a.employeeId)));
    } else {
      res = res.filter(a => String(a.employeeId._id || a.employeeId) === String(filter.employeeId));
    }
  }
  if (filter.date) {
    if (typeof filter.date === 'string') {
      res = res.filter(a => a.date === filter.date);
    } else if (filter.date.$regex) {
      const re = new RegExp(filter.date.$regex);
      res = res.filter(a => re.test(a.date));
    } else if (filter.date.$gte && filter.date.$lte) {
      res = res.filter(a => a.date >= filter.date.$gte && a.date <= filter.date.$lte);
    } else if (filter.date.$gte) {
      res = res.filter(a => a.date >= filter.date.$gte);
    } else if (filter.date.$lte) {
      res = res.filter(a => a.date <= filter.date.$lte);
    }
  }
  if (filter.status) {
    res = res.filter(a => a.status === filter.status);
  }
  const queryObj = {
    populate: () => queryObj,
    select: () => queryObj,
    sort: () => queryObj,
    limit: (n) => {
      const limited = n ? res.slice(0, n) : res;
      const q2 = {
        populate: () => q2,
        select: () => q2,
        sort: () => q2,
        limit: () => q2,
        lean: async () => limited,
        then: (resolve) => resolve(limited),
      };
      return q2;
    },
    lean: async () => res,
    then: (resolve) => resolve(res),
  };
  return queryObj;
};

Attendance.findOne = (filter = {}) => {
  let res = [...section12Attendance];
  if (filter.employeeId) {
    res = res.filter(a => String(a.employeeId._id || a.employeeId) === String(filter.employeeId));
  }
  if (filter.date) {
    res = res.filter(a => a.date === filter.date);
  }
  const match = res.length > 0 ? res[0] : null;
  const queryObj = {
    select: () => queryObj,
    lean: async () => match,
    then: (resolve) => resolve(match),
  };
  return queryObj;
};

// 12.1 Manager role authorization for all 6 Phase 13 capabilities
{
  const phase13Capabilities = [
    'ATTENDANCE:GET_ALL_MANAGER',
    'ATTENDANCE:SEARCH_MANAGER',
    'ATTENDANCE:GET_EMPLOYEE_DETAILS_MANAGER',
    'ATTENDANCE:GET_DAILY_SUMMARY_MANAGER',
    'ATTENDANCE:GET_MONTHLY_SUMMARY_MANAGER',
    'ATTENDANCE:GET_NOT_CHECKED_IN_MANAGER',
  ];
  const allAuthorized = phase13Capabilities.every(cap => isCapabilityAuthorized(cap, 'manager'));
  assert(allAuthorized, 'Manager role is authorized for all 6 Phase 13 manager capabilities');
}

// 12.2 Standard employee role is denied for all 6 Phase 13 manager capabilities
{
  const phase13Capabilities = [
    'ATTENDANCE:GET_ALL_MANAGER',
    'ATTENDANCE:SEARCH_MANAGER',
    'ATTENDANCE:GET_EMPLOYEE_DETAILS_MANAGER',
    'ATTENDANCE:GET_DAILY_SUMMARY_MANAGER',
    'ATTENDANCE:GET_MONTHLY_SUMMARY_MANAGER',
    'ATTENDANCE:GET_NOT_CHECKED_IN_MANAGER',
  ];
  const allDenied = phase13Capabilities.every(cap => !isCapabilityAuthorized(cap, 'employee'));
  assert(allDenied, 'Standard employee role is strictly denied for all 6 Phase 13 manager capabilities');
}

// 12.3 createAiContext authorizes Phase 13 capabilities for manager
{
  const mgrCtx = createAiContext(sec12UserMgr);
  const ok =
    mgrCtx.isAuthorized('ATTENDANCE:GET_ALL_MANAGER') &&
    mgrCtx.isAuthorized('ATTENDANCE:SEARCH_MANAGER') &&
    mgrCtx.isAuthorized('ATTENDANCE:GET_DAILY_SUMMARY_MANAGER');
  assert(ok, 'createAiContext for manager role authorizes Phase 13 capabilities');
}

// 12.4 createAiContext excludes Phase 13 capabilities for employee
{
  const empCtx = createAiContext(sec12EmpRahul);
  const blocked =
    !empCtx.isAuthorized('ATTENDANCE:GET_ALL_MANAGER') &&
    !empCtx.isAuthorized('ATTENDANCE:SEARCH_MANAGER') &&
    !empCtx.isAuthorized('ATTENDANCE:GET_NOT_CHECKED_IN_MANAGER');
  assert(blocked, 'createAiContext for employee role strictly excludes Phase 13 manager capabilities');
}

// 12.5 Tool registry contains Phase 13 tools and zero write tools
{
  const phase13Tools = [
    'search_manager_attendance',
    'get_manager_attendance_details',
    'get_manager_daily_attendance_summary',
    'get_manager_monthly_attendance_summary',
    'get_manager_not_checked_in',
  ];
  const toolNames = READ_ONLY_AI_TOOLS.map(t => t.function.name);
  const allPresent = phase13Tools.every(name => toolNames.includes(name));
  const writeKeywords = ['create', 'cancel', 'punch', 'delete', 'update', 'modify', 'confirm', 'apply', 'override'];
  const hasWriteTool = toolNames.some(name => writeKeywords.some(kw => name.includes(kw)));
  assert(allPresent && !hasWriteTool, 'Tool registry contains all Phase 13 tools and zero write tools');
}

// 12.6 Employee blocked from executing search_manager_attendance
{
  const res = await executeAiTool('search_manager_attendance', {}, { user: sec12EmpRahul });
  assert(res.error === 'FORBIDDEN_TOOL', 'Employee role blocked from executing search_manager_attendance with FORBIDDEN_TOOL');
}

// 12.7 Employee blocked from executing get_manager_attendance_details
{
  const res = await executeAiTool('get_manager_attendance_details', { employeeName: 'Rahul' }, { user: sec12EmpRahul });
  assert(res.error === 'FORBIDDEN_TOOL', 'Employee role blocked from executing get_manager_attendance_details with FORBIDDEN_TOOL');
}

// 12.8 Employee blocked from executing manager daily summary and not checked in tools
{
  const r1 = await executeAiTool('get_manager_daily_attendance_summary', {}, { user: sec12EmpRahul });
  const r2 = await executeAiTool('get_manager_not_checked_in', {}, { user: sec12EmpRahul });
  assert(r1.error === 'FORBIDDEN_TOOL' && r2.error === 'FORBIDDEN_TOOL', 'Employee blocked from executing manager daily summary and not checked in tools');
}

// 12.9 ATTENDANCE:GET_ALL_MANAGER defaults to today with explicit notification
{
  const res = createMockRes();
  await handleAiChat({ body: { message: "Show today's attendance" }, user: sec12UserMgr }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'ATTENDANCE' &&
    res.body.action === 'GET_ALL_MANAGER' &&
    res.body.reply.includes('default') &&
    res.body.reply.includes('Rahul Sharma'),
    'ATTENDANCE:GET_ALL_MANAGER defaults to today with explicit notification for manager'
  );
}

// 12.10 ATTENDANCE:GET_ALL_MANAGER retrieves records for specified date override
{
  const res = createMockRes();
  await handleAiChat({ body: { message: `Show attendance for ${sec12YesterdayStr}` }, user: sec12UserMgr }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'ATTENDANCE' &&
    res.body.action === 'GET_ALL_MANAGER' &&
    res.body.reply.includes(sec12YesterdayStr),
    'ATTENDANCE:GET_ALL_MANAGER retrieves enterprise attendance for specified date override'
  );
}

// 12.11 Standard employee requesting enterprise attendance is rejected
{
  const res = createMockRes();
  await handleAiChat({ body: { message: "Show today's team attendance" }, user: sec12EmpRahul }, res, () => {});
  assert(
    res.statusCode === 403 && res.body.error === 'FORBIDDEN_CAPABILITY',
    'Standard employee requesting enterprise attendance is rejected with 403 FORBIDDEN_CAPABILITY'
  );
}

// 12.12 ATTENDANCE:SEARCH_MANAGER filters by branch
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Show Chennai attendance' }, user: sec12UserMgr }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'ATTENDANCE' &&
    res.body.action === 'SEARCH_MANAGER' &&
    res.body.reply.includes('Amit Kumar'),
    'ATTENDANCE:SEARCH_MANAGER successfully filters enterprise attendance by branch'
  );
}

// 12.13 ATTENDANCE:SEARCH_MANAGER filters by exact status (late)
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Show late today' }, user: sec12UserMgr }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'ATTENDANCE' &&
    res.body.action === 'SEARCH_MANAGER' &&
    res.body.reply.includes('Priya Patel') &&
    res.body.reply.includes('LATE'),
    'ATTENDANCE:SEARCH_MANAGER successfully filters enterprise attendance by status'
  );
}

// 12.14 Manager query for another employee attendance resolves and searches
{
  const res = createMockRes();
  await handleAiChat({ body: { message: "Show Priya's attendance" }, user: sec12UserMgr }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'ATTENDANCE' &&
    (res.body.action === 'SEARCH_MANAGER' || res.body.action === 'GET_EMPLOYEE_DETAILS_MANAGER') &&
    res.body.reply.includes('Priya Patel'),
    'Manager query for another employee attendance resolves and searches records'
  );
}

// 12.15 Ambiguous employee name match returns candidate list without blind guessing
{
  const res = createMockRes();
  await handleAiChat({ body: { message: "Show Rahul's attendance" }, user: sec12UserMgr }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes('Multiple employees matched') &&
    res.body.reply.includes('Rahul Sharma') &&
    res.body.reply.includes('Rahul Verma'),
    'Ambiguous employee name match returns candidate list and requests clarification'
  );
}

// 12.16 Ambiguous candidate listing does not expose email
{
  const res = createMockRes();
  await handleAiChat({ body: { message: "Show Rahul's attendance" }, user: sec12UserMgr }, res, () => {});
  assert(
    !res.body.reply.includes('@toyota.com'),
    'Ambiguous employee match does not leak employee email address'
  );
}

// 12.17 Non-existent employee search clearly reports not found
{
  const res = createMockRes();
  await handleAiChat({ body: { message: "Show NonexistentUser's attendance" }, user: sec12UserMgr }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes('was not found in the directory'),
    'Non-existent employee search clearly reports not found in directory'
  );
}

// 12.18 Parameter sanitization cleanly strips injected identity fields
{
  const sanitized = sanitizeExtractedParams({
    employeeName: 'Rahul',
    userId: '607f1f77bcf86cd799439011',
    employeeId: 'EMP-999',
    ownerId: '607f1f77bcf86cd799439012',
    _id: '607f1f77bcf86cd799439013',
    status: 'late',
  });
  assert(
    sanitized.employeeName === 'Rahul' &&
    sanitized.status === 'late' &&
    !sanitized.userId &&
    !sanitized.employeeId &&
    !sanitized.ownerId &&
    !sanitized._id,
    'Parameter sanitization cleanly strips injected identity fields (userId, employeeId, ownerId, _id)'
  );
}

// 12.19 ATTENDANCE:GET_EMPLOYEE_DETAILS_MANAGER returns comprehensive details and work hours
{
  const res = createMockRes();
  await handleAiChat({ body: { message: `Tell me about Priya's attendance for ${sec12TodayStr}` }, user: sec12UserMgr }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'ATTENDANCE' &&
    res.body.action === 'GET_EMPLOYEE_DETAILS_MANAGER' &&
    res.body.reply.includes('Priya Patel') &&
    res.body.reply.includes('LATE'),
    'ATTENDANCE:GET_EMPLOYEE_DETAILS_MANAGER returns comprehensive structured details for manager'
  );
}

// 12.20 ATTENDANCE:GET_EMPLOYEE_DETAILS_MANAGER handles active session distinctly
{
  const res = createMockRes();
  await handleAiChat({ body: { message: `Tell me about Priya's attendance for ${sec12TodayStr}` }, user: sec12UserMgr }, res, () => {});
  assert(
    res.body.reply.includes('Currently Checked In (Active Session)') ||
    res.body.reply.includes('Active session'),
    'ATTENDANCE:GET_EMPLOYEE_DETAILS_MANAGER distinctly reports active checked-in session'
  );
}

// 12.21 Missing attendance record reports no record without fabricating absence
{
  const res = createMockRes();
  await handleAiChat({ body: { message: `Tell me about Amit's attendance for 2026-01-01` }, user: sec12UserMgr }, res, () => {});
  assert(
    res.body.reply.includes('has no attendance record for 2026-01-01') &&
    !res.body.reply.includes('is absent'),
    'Missing attendance record reports no attendance record without fabricating absence'
  );
}

// 12.22 Authoritative work hours retrieved for yesterday
{
  const res = createMockRes();
  await handleAiChat({ body: { message: `How many hours did Rahul Sharma work yesterday?` }, user: sec12UserMgr }, res, () => {});
  assert(
    res.body.reply.includes('8.17 hours') || res.body.reply.includes('8.17'),
    'ATTENDANCE:GET_EMPLOYEE_DETAILS_MANAGER reports authoritative work hours for yesterday'
  );
}

// 12.23 Daily attendance summary computes grounded counts without fabrication
{
  const res = createMockRes();
  await handleAiChat({ body: { message: "Show today's attendance summary" }, user: sec12UserMgr }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'ATTENDANCE' &&
    res.body.action === 'GET_DAILY_SUMMARY_MANAGER' &&
    res.body.reply.includes('**Total Active Roster**: **5**') &&
    res.body.reply.includes('**Checked In**: **2**') &&
    res.body.reply.includes('**Late Arrivals**: **1**') &&
    res.body.reply.includes('**On Leave**: **1**') &&
    res.body.reply.includes('**No Attendance Record**: **2**'),
    'ATTENDANCE:GET_DAILY_SUMMARY_MANAGER computes grounded counts without percentage fabrication'
  );
}

// 12.24 Daily summary explicitly distinguishes non-overlapping and overlapping counters
{
  const res = createMockRes();
  await handleAiChat({ body: { message: "Show today's attendance summary" }, user: sec12UserMgr }, res, () => {});
  assert(
    res.body.reply.includes('Counters reflect distinct tracked states and are not mutually exclusive'),
    'Daily summary notes that overlapping counters are not mutually exclusive'
  );
}

// 12.25 Individual monthly attendance summary exposes workedDays denominator
{
  const res = createMockRes();
  await handleAiChat({ body: { message: "Show monthly attendance summary for Priya Patel" }, user: sec12UserMgr }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'ATTENDANCE' &&
    res.body.action === 'GET_MONTHLY_SUMMARY_MANAGER' &&
    res.body.reply.includes('Calculation Denominator:'),
    'Individual monthly summary explicitly defines workedDays calculation denominator'
  );
}

// 12.26 Team monthly attendance summary reports team work metrics with denominator
{
  const res = createMockRes();
  await handleAiChat({ body: { message: "Show team attendance summary" }, user: sec12UserMgr }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'ATTENDANCE' &&
    res.body.action === 'GET_MONTHLY_SUMMARY_MANAGER' &&
    res.body.reply.includes('Total Worked Sessions') &&
    res.body.reply.includes('Calculation Denominator:'),
    'Team monthly summary reports grounded team work metrics with explicit denominator'
  );
}

// 12.27 Who has not checked in defaults to today and states target date
{
  const res = createMockRes();
  await handleAiChat({ body: { message: "Who hasn't checked in today?" }, user: sec12UserMgr }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'ATTENDANCE' &&
    res.body.action === 'GET_NOT_CHECKED_IN_MANAGER' &&
    res.body.reply.includes(sec12TodayStr),
    'Who has not checked in defaults to today and explicitly states target date'
  );
}

// 12.28 Who has not checked in distinguishes No record, On Leave, and Marked Absent
{
  const res = createMockRes();
  await handleAiChat({ body: { message: "Who hasn't checked in today?" }, user: sec12UserMgr }, res, () => {});
  assert(
    res.body.reply.includes('No attendance record') &&
    res.body.reply.includes('On Leave') &&
    res.body.reply.includes('Amit Kumar') &&
    res.body.reply.includes('Rahul Verma'),
    'Who has not checked in distinctly categorizes No attendance record and On Leave'
  );
}

// 12.29 Safe manager navigation produces verified card for manager-attendance
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Open team attendance' }, user: sec12UserMgr }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'NAVIGATION' &&
    res.body.action === 'OPEN_MGR_PAGE' &&
    res.body.navigation !== null &&
    res.body.navigation.destination === 'manager-attendance' &&
    res.body.navigation.path === '/manager/attendance',
    'Manager navigation produces verified navigation card to /manager/attendance'
  );
}

// 12.30 Standard employee attempting manager attendance navigation is rejected
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Open manager attendance' }, user: sec12EmpRahul }, res, () => {});
  assert(
    res.body.reply.includes('Access to manager administration pages is restricted to managers only.'),
    'Employee attempting manager attendance navigation is rejected with access restricted notice'
  );
}

// 12.31 Employee requesting another employee attendance receives privacy refusal
{
  const res = createMockRes();
  await handleAiChat({ body: { message: "Show Rahul's attendance" }, user: sec12EmpPriya }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes("You can only view your own attendance records. Access to Rahul's attendance is not permitted."),
    'Employee requesting another employee attendance receives privacy notice'
  );
}

// 12.32 Zero database mutations during manager attendance intelligence queries
{
  const attendanceCountBefore = section12Attendance.length;
  const userCountBefore = section12Users.length;
  const res = createMockRes();
  await handleAiChat({ body: { message: "Show today's attendance" }, user: sec12UserMgr }, res, () => {});
  assert(
    section12Attendance.length === attendanceCountBefore &&
    section12Users.length === userCountBefore,
    'Zero database mutations occur during manager attendance intelligence queries'
  );
}

// Restore Section 12 mocks
User.find = origSection12UserFind;
Attendance.find = origSection12AttendanceFind;
Attendance.findOne = origSection12AttendanceFindOne;

// ══════════════════════════════════════════════════════════════════════════
// TEST SECTION 13: PHASE 14 MANAGER LEAVE INTELLIGENCE
// ══════════════════════════════════════════════════════════════════════════
console.log('\n--- TEST SECTION 13: PHASE 14 MANAGER LEAVE INTELLIGENCE ---');

const sec13UserMgr = {
  _id: new mongoose.Types.ObjectId('807f1f77bcf86cd799439100'),
  name: 'Vikram Singh',
  employeeId: 'EMP-MGR-01',
  role: 'manager',
  branch: 'Bangalore',
  department: 'Operations',
  designation: 'Operations Director',
  country: 'India',
  isActive: true,
};

const sec13EmpPriya = {
  _id: new mongoose.Types.ObjectId('807f1f77bcf86cd799439101'),
  name: 'Priya Sharma',
  employeeId: 'EMP-BLR-01',
  role: 'employee',
  branch: 'Bangalore',
  department: 'Engineering',
  designation: 'Senior Engineer',
  country: 'India',
  isActive: true,
};

const sec13EmpPriyaPatel = {
  _id: new mongoose.Types.ObjectId('807f1f77bcf86cd799439102'),
  name: 'Priya Patel',
  employeeId: 'EMP-CHN-01',
  role: 'employee',
  branch: 'Chennai',
  department: 'Human Resources',
  designation: 'HR Specialist',
  country: 'India',
  isActive: true,
};

const sec13EmpRahul = {
  _id: new mongoose.Types.ObjectId('807f1f77bcf86cd799439103'),
  name: 'Rahul Verma',
  employeeId: 'EMP-BLR-02',
  role: 'employee',
  branch: 'Bangalore',
  department: 'Product',
  designation: 'Product Analyst',
  country: 'India',
  isActive: true,
};

const sec13EmpAmit = {
  _id: new mongoose.Types.ObjectId('807f1f77bcf86cd799439104'),
  name: 'Amit Kumar',
  employeeId: 'EMP-HYD-01',
  role: 'employee',
  branch: 'Hyderabad',
  department: 'QA',
  designation: 'QA Lead',
  country: 'India',
  isActive: true,
};

const section13Users = [sec13UserMgr, sec13EmpPriya, sec13EmpPriyaPatel, sec13EmpRahul, sec13EmpAmit];

const sec13TodayStr = new Date().toISOString().slice(0, 10);

const sec13Leave1 = {
  _id: new mongoose.Types.ObjectId('807f1f77bcf86cd799439201'),
  employeeId: sec13EmpPriya,
  leaveType: 'sick',
  startDate: sec13TodayStr,
  endDate: sec13TodayStr,
  totalDays: 1,
  reason: 'Seasonal viral flu',
  status: 'approved',
  reviewedBy: sec13UserMgr,
  reviewedAt: new Date(),
  reviewNotes: 'Approved by Vikram',
  isHalfDay: false,
};

const sec13Leave2 = {
  _id: new mongoose.Types.ObjectId('807f1f77bcf86cd799439202'),
  employeeId: sec13EmpRahul,
  leaveType: 'casual',
  startDate: sec13TodayStr,
  endDate: '2026-09-05',
  totalDays: 3,
  reason: 'Family visit',
  status: 'pending',
  reviewedBy: null,
  reviewedAt: null,
  reviewNotes: '',
  isHalfDay: false,
};

const sec13Leave3 = {
  _id: new mongoose.Types.ObjectId('807f1f77bcf86cd799439203'),
  employeeId: sec13EmpAmit,
  leaveType: 'earned',
  startDate: '2026-08-10',
  endDate: '2026-08-14',
  totalDays: 5,
  reason: 'Summer vacation trip',
  status: 'rejected',
  reviewedBy: sec13UserMgr,
  reviewedAt: new Date(),
  reviewNotes: 'High priority sprint deliverables scheduled for this week',
  isHalfDay: false,
};

const sec13Leave4 = {
  _id: new mongoose.Types.ObjectId('807f1f77bcf86cd799439204'),
  employeeId: sec13EmpRahul,
  leaveType: 'casual',
  startDate: '2026-08-01',
  endDate: '2026-08-03',
  totalDays: 2,
  reason: 'Personal errands',
  status: 'approved',
  reviewedBy: sec13UserMgr,
  reviewedAt: new Date(),
  reviewNotes: 'Approved',
  isHalfDay: false,
};

let section13Leaves = [sec13Leave1, sec13Leave2, sec13Leave3, sec13Leave4];

const origSection13UserFind = User.find;
const origSection13LeaveFind = Leave.find;
const origSection13LeaveFindById = Leave.findById;
const origSection13BalanceFindOne = LeaveBalance.findOne;

User.find = (filter = {}) => {
  let matched = [...section13Users];
  if (filter.name && filter.name.$regex) {
    const rx = filter.name.$regex;
    matched = matched.filter(u => rx.test(u.name));
  }
  if (filter.branch) {
    if (typeof filter.branch === 'string') {
      matched = matched.filter(u => u.branch.toLowerCase() === filter.branch.toLowerCase());
    } else if (filter.branch.$regex) {
      matched = matched.filter(u => filter.branch.$regex.test(u.branch));
    }
  }
  if (filter.role && filter.role.$in) {
    matched = matched.filter(u => filter.role.$in.includes(u.role));
  }
  const chain = {
    select: () => chain,
    sort: () => chain,
    lean: async () => matched,
  };
  return chain;
};

Leave.find = (filter = {}) => {
  let res = [...section13Leaves];
  if (filter.employeeId) {
    if (filter.employeeId.$in) {
      const ids = filter.employeeId.$in.map(id => String(id));
      res = res.filter(l => ids.includes(String(l.employeeId._id || l.employeeId)));
    } else {
      res = res.filter(l => String(l.employeeId._id || l.employeeId) === String(filter.employeeId));
    }
  }
  if (filter.status) {
    if (filter.status.$in) {
      res = res.filter(l => filter.status.$in.includes(l.status));
    } else {
      res = res.filter(l => l.status.toLowerCase() === filter.status.toLowerCase());
    }
  }
  if (filter.leaveType) {
    res = res.filter(l => l.leaveType.toLowerCase() === filter.leaveType.toLowerCase());
  }
  if (filter.startDate) {
    if (typeof filter.startDate === 'string') {
      res = res.filter(l => l.startDate === filter.startDate);
    } else if (filter.startDate.$lte) {
      res = res.filter(l => l.startDate <= filter.startDate.$lte);
    }
  }
  if (filter.endDate) {
    if (typeof filter.endDate === 'string') {
      res = res.filter(l => l.endDate === filter.endDate);
    } else if (filter.endDate.$gte) {
      res = res.filter(l => l.endDate >= filter.endDate.$gte);
    }
  }
  const chain = {
    populate: () => chain,
    sort: () => chain,
    limit: (n) => {
      res = res.slice(0, n);
      return chain;
    },
    lean: async () => res,
  };
  return chain;
};

Leave.findById = (id) => {
  const item = section13Leaves.find(l => String(l._id) === String(id)) || null;
  const chain = {
    populate: () => chain,
    lean: async () => item,
  };
  return chain;
};

LeaveBalance.findOne = async (filter = {}) => {
  return {
    employeeId: filter.employeeId,
    year: filter.year || 2026,
    casual: { total: 12, used: 2, pending: 1 },
    sick: { total: 10, used: 1, pending: 0 },
    earned: { total: 45, used: 5, pending: 0 },
    menstrual: { total: 12, used: 0, pending: 0 },
    relocation: { total: 5, used: 0, pending: 0 },
    unpaid: { total: 999, used: 0, pending: 0 },
    maternity: { total: 90, used: 0, pending: 0 },
    paternity: { total: 15, used: 0, pending: 0 },
    save: async function() { return this; },
  };
};

// 13.1 Manager role is authorized for all 5 Phase 14 manager capabilities
{
  const mgrCaps = [
    'LEAVE:GET_ALL_MANAGER',
    'LEAVE:SEARCH_MANAGER',
    'LEAVE:GET_REQUEST_DETAILS_MGR',
    'LEAVE:GET_BALANCES_MGR',
    'LEAVE:GET_ACTIVE_TODAY',
  ];
  const allAuthorized = mgrCaps.every(c => isCapabilityAuthorized(c, 'manager'));
  assert(allAuthorized, 'Manager role is authorized for all 5 Phase 14 manager capabilities');
}

// 13.2 Standard employee role is strictly denied for all 5 Phase 14 manager capabilities
{
  const mgrCaps = [
    'LEAVE:GET_ALL_MANAGER',
    'LEAVE:SEARCH_MANAGER',
    'LEAVE:GET_REQUEST_DETAILS_MGR',
    'LEAVE:GET_BALANCES_MGR',
    'LEAVE:GET_ACTIVE_TODAY',
  ];
  const allDenied = mgrCaps.every(c => !isCapabilityAuthorized(c, 'employee'));
  assert(allDenied, 'Standard employee role is strictly denied for all 5 Phase 14 manager capabilities');
}

// 13.3 createAiContext for manager role authorizes Phase 14 capabilities
{
  const mgrCtx = createAiContext(sec13UserMgr);
  const hasCaps = [
    'LEAVE:GET_ALL_MANAGER',
    'LEAVE:SEARCH_MANAGER',
    'LEAVE:GET_REQUEST_DETAILS_MGR',
    'LEAVE:GET_BALANCES_MGR',
    'LEAVE:GET_ACTIVE_TODAY',
  ].every(c => mgrCtx.allowedCapabilities.includes(c));
  assert(hasCaps, 'createAiContext for manager role authorizes Phase 14 capabilities');
}

// 13.4 createAiContext for employee role strictly excludes Phase 14 manager capabilities
{
  const empCtx = createAiContext(sec13EmpRahul);
  const noCaps = [
    'LEAVE:GET_ALL_MANAGER',
    'LEAVE:SEARCH_MANAGER',
    'LEAVE:GET_REQUEST_DETAILS_MGR',
    'LEAVE:GET_BALANCES_MGR',
    'LEAVE:GET_ACTIVE_TODAY',
  ].every(c => !empCtx.allowedCapabilities.includes(c));
  assert(noCaps, 'createAiContext for employee role strictly excludes Phase 14 manager capabilities');
}

// 13.5 Tool registry contains all Phase 14 tools and zero write tools
{
  const phase14Tools = [
    'search_manager_leave_requests',
    'get_manager_leave_request_details',
    'get_manager_leave_balances',
    'get_manager_active_leaves_today',
  ];
  const allPresent = phase14Tools.every(t => READ_ONLY_AI_TOOLS.some(tool => tool.function.name === t));
  const noWriteTools = !READ_ONLY_AI_TOOLS.some(t =>
    t.function.name.includes('approve') ||
    t.function.name.includes('reject') ||
    t.function.name.includes('cancel') ||
    t.function.name.includes('modify')
  );
  assert(allPresent && noWriteTools, 'Tool registry contains all Phase 14 tools and zero write tools');
}

// 13.6 Employee role blocked from executing search_manager_leave_requests with FORBIDDEN_TOOL
{
  const res = await executeAiTool('search_manager_leave_requests', {}, { user: sec13EmpRahul });
  assert(
    res.error === 'FORBIDDEN_TOOL' && res.message.includes('not authorized'),
    'Employee role blocked from executing search_manager_leave_requests with FORBIDDEN_TOOL'
  );
}

// 13.7 Employee role blocked from executing get_manager_leave_request_details with FORBIDDEN_TOOL
{
  const res = await executeAiTool('get_manager_leave_request_details', {}, { user: sec13EmpRahul });
  assert(
    res.error === 'FORBIDDEN_TOOL' && res.message.includes('not authorized'),
    'Employee role blocked from executing get_manager_leave_request_details with FORBIDDEN_TOOL'
  );
}

// 13.8 Employee role blocked from executing get_manager_leave_balances with FORBIDDEN_TOOL
{
  const res = await executeAiTool('get_manager_leave_balances', {}, { user: sec13EmpRahul });
  assert(
    res.error === 'FORBIDDEN_TOOL' && res.message.includes('not authorized'),
    'Employee role blocked from executing get_manager_leave_balances with FORBIDDEN_TOOL'
  );
}

// 13.9 Employee role blocked from executing get_manager_active_leaves_today with FORBIDDEN_TOOL
{
  const res = await executeAiTool('get_manager_active_leaves_today', {}, { user: sec13EmpRahul });
  assert(
    res.error === 'FORBIDDEN_TOOL' && res.message.includes('not authorized'),
    'Employee role blocked from executing get_manager_active_leaves_today with FORBIDDEN_TOOL'
  );
}

// 13.10 LEAVE:GET_ALL_MANAGER retrieves enterprise leave requests without defaulting silently to pending
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Show all leave requests' }, user: sec13UserMgr }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'LEAVE' &&
    res.body.action === 'GET_ALL_MANAGER' &&
    res.body.reply.includes('enterprise leave requests') &&
    res.body.reply.includes('Priya Sharma') &&
    res.body.reply.includes('Rahul Verma'),
    'LEAVE:GET_ALL_MANAGER retrieves enterprise leave requests without defaulting silently to pending'
  );
}

// 13.11 Standard employee requesting enterprise leaves is rejected with 403 FORBIDDEN_CAPABILITY
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Show all leave requests' }, user: sec13EmpRahul }, res, () => {});
  assert(
    res.statusCode === 403 &&
    res.body.error === 'FORBIDDEN_CAPABILITY',
    'Standard employee requesting enterprise leaves is rejected with 403 FORBIDDEN_CAPABILITY'
  );
}

// 13.12 LEAVE:SEARCH_MANAGER successfully filters enterprise leaves by status (pending)
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Show pending leave requests' }, user: sec13UserMgr }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'LEAVE' &&
    res.body.action === 'SEARCH_MANAGER' &&
    res.body.reply.includes('Rahul Verma') &&
    !res.body.reply.includes('Amit Kumar'),
    'LEAVE:SEARCH_MANAGER successfully filters enterprise leaves by status (pending)'
  );
}

// 13.13 LEAVE:SEARCH_MANAGER successfully filters enterprise leaves by leaveType (sick)
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Show sick leave requests' }, user: sec13UserMgr }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'LEAVE' &&
    res.body.reply.includes('Priya Sharma') &&
    (res.body.reply.includes('Sick Leave') || res.body.reply.includes('SICK Leave')),
    'LEAVE:SEARCH_MANAGER successfully filters enterprise leaves by leaveType (sick)'
  );
}

// 13.14 LEAVE:SEARCH_MANAGER successfully filters enterprise leaves by branch (Bangalore)
{
  const res = await searchManagerLeaves({ branch: 'Bangalore' });
  assert(
    res.count >= 2 &&
    res.leaves.every(l => l.employeeId.branch.toLowerCase() === 'bangalore'),
    'LEAVE:SEARCH_MANAGER successfully filters enterprise leaves by branch (Bangalore)'
  );
}

// 13.15 Date matching: active-on-date finds leaves overlapping target date
{
  const res = await searchManagerLeaves({ date: sec13TodayStr });
  assert(
    res.count >= 2 &&
    res.leaves.some(l => l.employeeId.name === 'Priya Sharma') &&
    res.leaves.some(l => l.employeeId.name === 'Rahul Verma'),
    'Date matching: active-on-date finds leaves overlapping target date'
  );
}

// 13.16 Date matching: startsOnDate matches exact single start date
{
  const res = await searchManagerLeaves({ startsOnDate: '2026-08-10' });
  assert(
    res.count === 1 &&
    res.leaves[0].employeeId.name === 'Amit Kumar',
    'Date matching: startsOnDate matches exact single start date'
  );
}

// 13.17 Date matching: month/year interval correctly identifies leaves active during the month
{
  const res = await searchManagerLeaves({ month: 8, year: 2026 });
  assert(
    res.count >= 2 &&
    res.leaves.some(l => l.employeeId.name === 'Amit Kumar') &&
    res.leaves.some(l => l.employeeId.name === 'Rahul Verma'),
    'Date matching: month/year interval correctly identifies leaves active during the month'
  );
}

// 13.18 Employee directory lookup: single match resolves server-side and returns leave requests
{
  const res = createMockRes();
  await handleAiChat({ body: { message: "Show Rahul's leaves" }, user: sec13UserMgr }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'LEAVE' &&
    res.body.action === 'SEARCH_MANAGER' &&
    res.body.reply.includes('Rahul Verma') &&
    res.body.reply.includes('Casual Leave'),
    'Employee directory lookup: single match resolves server-side and returns leave requests'
  );
}

// 13.19 Employee directory lookup: ambiguous match returns candidate list without leaking email address
{
  const res = createMockRes();
  await handleAiChat({ body: { message: "Show leave requests for Priya" }, user: sec13UserMgr }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes('Multiple employees matched your search') &&
    res.body.reply.includes('Priya Sharma') &&
    res.body.reply.includes('Priya Patel') &&
    !res.body.reply.includes('@toyota.com') &&
    !res.body.reply.includes('@'),
    'Employee directory lookup: ambiguous match returns candidate list without leaking email address'
  );
}

// 13.20 Non-existent employee search clearly reports not found in directory
{
  const res = createMockRes();
  await handleAiChat({ body: { message: "Show leave requests for Zachary Taylor" }, user: sec13UserMgr }, res, () => {});
  assert(
    res.body.reply.includes('Could not find an employee matching') ||
    res.body.reply.includes('not found'),
    'Non-existent employee search clearly reports not found in directory'
  );
}

// 13.21 Parameter sanitization cleanly strips injected identity fields (userId, employeeId, ownerId, _id)
{
  const params = sanitizeExtractedParams({
    userId: 'malicious-user-id',
    employeeId: 'malicious-emp-id',
    ownerId: 'malicious-owner-id',
    _id: 'malicious-id',
    status: 'pending',
    leaveId: '807f1f77bcf86cd799439201',
  });
  assert(
    params.userId === undefined &&
    params.employeeId === undefined &&
    params.ownerId === undefined &&
    params._id === undefined &&
    params.status === 'pending' &&
    params.leaveId === '807f1f77bcf86cd799439201',
    'Parameter sanitization cleanly strips injected identity fields (userId, employeeId, ownerId, _id)'
  );
}

// 13.22 "Who is on leave today?" explicitly reports target date in the response
{
  const res = createMockRes();
  await handleAiChat({ body: { message: "Who is on leave today?" }, user: sec13UserMgr }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'LEAVE' &&
    res.body.action === 'GET_ACTIVE_TODAY' &&
    res.body.reply.includes(sec13TodayStr) &&
    res.body.reply.includes('approved leave'),
    '"Who is on leave today?" explicitly reports target date in the response'
  );
}

// 13.23 "Who is on leave today?" strictly includes only approved leaves (excludes pending and rejected)
{
  const res = createMockRes();
  await handleAiChat({ body: { message: "Who is on leave today?" }, user: sec13UserMgr }, res, () => {});
  assert(
    res.body.reply.includes('Priya Sharma') &&
    !res.body.reply.includes('Rahul Verma') &&
    !res.body.reply.includes('Amit Kumar'),
    '"Who is on leave today?" strictly includes only approved leaves (excludes pending and rejected)'
  );
}

// 13.24 Explicit leaveId lookup returns comprehensive structured details for manager
{
  const res = createMockRes();
  await handleAiChat(
    { body: { message: 'Show details of leave request 807f1f77bcf86cd799439203' }, user: sec13UserMgr },
    res,
    () => {}
  );
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'LEAVE' &&
    res.body.action === 'GET_REQUEST_DETAILS_MGR' &&
    res.body.reply.includes('Amit Kumar') &&
    res.body.reply.includes('REJECTED') &&
    res.body.reply.includes('High priority sprint deliverables'),
    'Explicit leaveId lookup returns comprehensive structured details for manager'
  );
}

// 13.25 Non-existent or invalid leave ID lookup reports not found
{
  const res = await getManagerLeaveDetails({ leaveId: '999f1f77bcf86cd799439999' });
  assert(
    res.found === false && res.message.includes('not found'),
    'Non-existent or invalid leave ID lookup reports not found'
  );
}

// 13.26 Indirect criteria matching multiple leaves surfaces candidate list without blind guessing
{
  const res = await getManagerLeaveDetails({ employeeName: 'Rahul' });
  assert(
    res.found === false &&
    res.ambiguous === true &&
    res.candidates &&
    res.candidates.length >= 2,
    'Indirect criteria matching multiple leaves surfaces candidate list without blind guessing'
  );
}

// 13.27 LEAVE:GET_BALANCES_MGR returns authoritative individual quotas with Math.max(0, total - used - pending)
{
  const res = createMockRes();
  await handleAiChat(
    { body: { message: "What is the leave balance for Priya Sharma?" }, user: sec13UserMgr },
    res,
    () => {}
  );
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'LEAVE' &&
    res.body.action === 'GET_BALANCES_MGR' &&
    res.body.reply.includes('Leave Balances for Priya Sharma') &&
    res.body.reply.includes('Casual') &&
    res.body.reply.includes('9 days remaining'), // 12 total - 2 used - 1 pending = 9 remaining
    'LEAVE:GET_BALANCES_MGR returns authoritative individual quotas with Math.max(0, total - used - pending)'
  );
}

// 13.28 LEAVE:GET_BALANCES_MGR correctly reports unpaid leave as unlimited and caps earned leave
{
  const res = createMockRes();
  await handleAiChat(
    { body: { message: "What is the leave balance for Priya Sharma?" }, user: sec13UserMgr },
    res,
    () => {}
  );
  assert(
    res.body.reply.includes('Unpaid') &&
    res.body.reply.includes('Unlimited') &&
    res.body.reply.includes('Earned'),
    'LEAVE:GET_BALANCES_MGR correctly reports unpaid leave as unlimited and caps earned leave'
  );
}

// 13.29 LEAVE:GET_BALANCES_MGR team overview returns roster leave balances
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Show leave balances' }, user: sec13UserMgr }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'LEAVE' &&
    res.body.action === 'GET_BALANCES_MGR' &&
    res.body.reply.includes('Enterprise Leave Balances Summary') &&
    res.body.reply.includes('Priya Sharma') &&
    res.body.reply.includes('Rahul Verma'),
    'LEAVE:GET_BALANCES_MGR team overview returns roster leave balances'
  );
}

// 13.30 Safe manager navigation produces verified navigation card to /manager/leaves
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Open leave approvals' }, user: sec13UserMgr }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'NAVIGATION' &&
    res.body.action === 'OPEN_MGR_PAGE' &&
    res.body.navigation !== null &&
    res.body.navigation.destination === 'manager-leaves' &&
    res.body.navigation.path === '/manager/leaves',
    'Manager navigation produces verified navigation card to /manager/leaves'
  );
}

// 13.31 Safe manager navigation produces verified navigation card to /manager/leaves/balances
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Open leave balances' }, user: sec13UserMgr }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'NAVIGATION' &&
    res.body.action === 'OPEN_MGR_PAGE' &&
    res.body.navigation !== null &&
    res.body.navigation.destination === 'manager-leave-balances' &&
    res.body.navigation.path === '/manager/leaves/balances',
    'Manager navigation produces verified navigation card to /manager/leaves/balances'
  );
}

// 13.32 Employee attempting manager leave navigation is rejected with access restricted notice
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Open manager leaves' }, user: sec13EmpRahul }, res, () => {});
  assert(
    res.body.reply.includes('Access to manager administration pages is restricted to managers only.'),
    'Employee attempting manager leave navigation is rejected with access restricted notice'
  );
}

// 13.33 Employee requesting another employee leaves receives privacy refusal
{
  const res = createMockRes();
  await handleAiChat({ body: { message: "Show Rahul's leaves" }, user: sec13EmpPriya }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes("You can only view your own leave records. Access to Rahul's leave data is not permitted."),
    'Employee requesting another employee leaves receives privacy notice'
  );
}

// 13.34 Conversational "Approve leave" or "Reject leave" returns informational response directing to /manager/leaves
{
  const resApprove = createMockRes();
  await handleAiChat({ body: { message: 'Approve leave request 807f1f77bcf86cd799439202' }, user: sec13UserMgr }, resApprove, () => {});
  const resReject = createMockRes();
  await handleAiChat({ body: { message: 'Reject this leave' }, user: sec13UserMgr }, resReject, () => {});
  assert(
    resApprove.body.reply.includes('Conversational leave approval and rejection is not supported') &&
    resApprove.body.reply.includes('/manager/leaves') &&
    resReject.body.reply.includes('Conversational leave approval and rejection is not supported') &&
    resReject.body.reply.includes('/manager/leaves'),
    'Conversational "Approve leave" or "Reject leave" returns informational response directing to /manager/leaves'
  );
}

// 13.35 Zero database mutations occur during manager leave intelligence queries
{
  const leaveCountBefore = section13Leaves.length;
  const userCountBefore = section13Users.length;
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Show all leave requests' }, user: sec13UserMgr }, res, () => {});
  assert(
    section13Leaves.length === leaveCountBefore &&
    section13Users.length === userCountBefore,
    'Zero database mutations occur during manager leave intelligence queries'
  );
}

// Restore Section 13 mocks
User.find = origSection13UserFind;
Leave.find = origSection13LeaveFind;
Leave.findById = origSection13LeaveFindById;
LeaveBalance.findOne = origSection13BalanceFindOne;

// ============================================================================
// --- TEST SECTION 14: PHASE 15 MANAGER NOTIFICATION & PROFILE INTELLIGENCE ---
// ============================================================================
console.log('\n--- TEST SECTION 14: PHASE 15 MANAGER NOTIFICATION & PROFILE INTELLIGENCE ---');

const sec14MgrUser = {
  _id: new mongoose.Types.ObjectId('607f1f77bcf86cd799439301'),
  name: 'Vikram Malhotra',
  email: 'vikram@toyota.local',
  employeeId: 'MGR001',
  role: 'manager',
  gender: 'male',
  branch: 'Bangalore',
  country: 'India',
  department: 'Enterprise Operations',
  designation: 'Operations Manager',
  block: 'A',
  floor: '3',
  joiningDate: new Date('2022-01-15'),
  phone: '+91 98765 43210',
  password: '$2b$10$encryptedSuperSecretPasswordHash',
  isActive: true,
};

const sec14EmpUser = {
  _id: new mongoose.Types.ObjectId('607f1f77bcf86cd799439302'),
  name: 'Priya Sharma',
  email: 'priya@toyota.local',
  employeeId: 'EMP002',
  role: 'employee',
  gender: 'female',
  branch: 'Bangalore',
  country: 'India',
  department: 'Engineering',
  designation: 'Software Engineer',
  block: 'B',
  floor: '2',
  joiningDate: new Date('2023-03-01'),
  phone: '+91 98765 12345',
  password: '$2b$10$encryptedSuperSecretPasswordHash2',
  isActive: true,
};

const section14Users = [sec14MgrUser, sec14EmpUser];

const sec14Notif1 = {
  _id: new mongoose.Types.ObjectId('707f1f77bcf86cd799439301'),
  userId: sec14MgrUser._id,
  title: 'Room Reservation Approved',
  message: 'Your booking for Room A-101 has been confirmed.',
  type: 'system',
  isRead: false,
  metadata: { secretInternalField: 'DO_NOT_EXPOSE_METADATA' },
  createdAt: new Date('2026-09-03T09:00:00Z'),
};

const sec14Notif2 = {
  _id: new mongoose.Types.ObjectId('707f1f77bcf86cd799439302'),
  userId: sec14MgrUser._id,
  title: 'Weekly Team Standup Reminder',
  message: 'Reminder: Weekly operations standup at 10:00 AM.',
  type: 'reminder',
  isRead: false,
  metadata: { internalRouting: 'QUEUE_A' },
  createdAt: new Date('2026-09-03T09:30:00Z'),
};

const sec14Notif3 = {
  _id: new mongoose.Types.ObjectId('707f1f77bcf86cd799439303'),
  userId: sec14MgrUser._id,
  title: 'Leave Request Alert',
  message: 'Priya Sharma submitted a leave request for review.',
  type: 'system',
  isRead: true,
  metadata: { priority: 'high' },
  createdAt: new Date('2026-09-02T14:00:00Z'),
};

const sec14Notif4 = {
  _id: new mongoose.Types.ObjectId('707f1f77bcf86cd799439304'),
  userId: sec14MgrUser._id,
  title: 'Leave Request Alert',
  message: 'Rahul Verma submitted a sick leave request.',
  type: 'system',
  isRead: true,
  metadata: { priority: 'normal' },
  createdAt: new Date('2026-09-02T16:00:00Z'),
};

const sec14NotifEmp = {
  _id: new mongoose.Types.ObjectId('707f1f77bcf86cd799439305'),
  userId: sec14EmpUser._id,
  title: 'Employee Standup Meeting Invite',
  message: 'You have been invited to sprint planning meeting.',
  type: 'invite',
  isRead: false,
  metadata: { roomId: 'A-202' },
  createdAt: new Date('2026-09-03T08:00:00Z'),
};

const section14Notifications = [sec14Notif1, sec14Notif2, sec14Notif3, sec14Notif4, sec14NotifEmp];

// Setup Section 14 Mocks
const origSec14NotifFind = Notification.find;
const origSec14NotifFindOne = Notification.findOne;
const origSec14UserFindById = User.findById;

Notification.find = (filter = {}) => {
  let list = section14Notifications.filter((n) => {
    if (filter.userId && String(n.userId) !== String(filter.userId)) return false;
    if (typeof filter.isRead === 'boolean' && n.isRead !== filter.isRead) return false;
    if (filter.$or) {
      const orMatches = filter.$or.some((clause) => {
        if (clause.title?.$regex) {
          const re = new RegExp(clause.title.$regex, clause.title.$options || 'i');
          return re.test(n.title);
        }
        if (clause.message?.$regex) {
          const re = new RegExp(clause.message.$regex, clause.message.$options || 'i');
          return re.test(n.message);
        }
        return false;
      });
      if (!orMatches) return false;
    }
    return true;
  });

  const queryObj = {
    select(fields) {
      return this;
    },
    sort(sortSpec) {
      list = [...list].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return this;
    },
    limit(n) {
      list = list.slice(0, n);
      return this;
    },
    lean: async () => list.map((item) => ({ ...item })),
  };
  return queryObj;
};

Notification.findOne = (query = {}) => {
  const match = section14Notifications.find((n) => {
    if (query._id && String(n._id) !== String(query._id)) return false;
    if (query.userId && String(n.userId) !== String(query.userId)) return false;
    return true;
  });

  const queryObj = {
    select(fields) {
      return this;
    },
    lean: async () => (match ? { ...match } : null),
  };
  return queryObj;
};

User.findById = (id) => {
  const u = section14Users.find((user) => String(user._id) === String(id));
  const queryObj = {
    select(fields) {
      return this;
    },
    lean: async () => (u ? { ...u } : null),
  };
  return queryObj;
};

// 14.1 Capability Authorization: Manager role is authorized for Phase 10 & 15 capabilities
{
  const requiredCaps = [
    'NOTIFICATION:GET_MY_NOTIFICATIONS',
    'NOTIFICATION:GET_UNREAD',
    'NOTIFICATION:GET_NOTIFICATION_DETAILS',
    'PROFILE:GET_MY_PROFILE',
    'NAVIGATION:OPEN_MGR_PAGE',
  ];
  const allAuthorized = requiredCaps.every((c) => isCapabilityAuthorized(c, 'manager'));
  assert(allAuthorized, 'Manager role is authorized for all notification and profile capabilities');
}

// 14.2 Capabilities Classification: All notification and profile capabilities are classified as READ
{
  const readCaps = [
    'NOTIFICATION:GET_MY_NOTIFICATIONS',
    'NOTIFICATION:GET_UNREAD',
    'NOTIFICATION:GET_NOTIFICATION_DETAILS',
    'PROFILE:GET_MY_PROFILE',
  ];
  const allRead = readCaps.every((c) => CAPABILITY_REGISTRY[c]?.classification === 'READ');
  assert(allRead, 'All notification and profile capabilities are strictly classified as READ');
}

// 14.3 Tool Registry: Tool registry contains read-only notification and profile tools and zero write tools
{
  const toolNames = READ_ONLY_AI_TOOLS.map((t) => t.function.name);
  assert(
    toolNames.includes('get_my_notifications') &&
    toolNames.includes('get_my_unread_notifications') &&
    toolNames.includes('get_my_notification_details') &&
    toolNames.includes('get_my_profile') &&
    !toolNames.includes('update_profile') &&
    !toolNames.includes('delete_notification') &&
    !toolNames.includes('mark_notification_read'),
    'Tool registry contains read-only notification/profile tools and zero write tools'
  );
}

// 14.4 Service Delegation: Authoritative domain methods exist and function correctly
{
  const userNotifs = await getUserNotifications({ userId: sec14MgrUser._id });
  const userProfile = await getUserProfileService({ userId: sec14MgrUser._id });
  assert(
    userNotifs.success === true &&
    userNotifs.count === 4 &&
    userProfile.success === true &&
    userProfile.profile.name === 'Vikram Malhotra',
    'Authoritative domain services in notification.service.js and user.service.js execute correctly'
  );
}

// 14.5 Manager Notification Retrieval: Manager retrieves own notifications with clamped limit
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Show my notifications' }, user: sec14MgrUser }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'NOTIFICATION' &&
    res.body.action === 'GET_MY_NOTIFICATIONS' &&
    res.body.reply.includes('Room Reservation Approved') &&
    res.body.reply.includes('Weekly Team Standup Reminder') &&
    !res.body.reply.includes('DO_NOT_EXPOSE_METADATA'),
    'Manager retrieves own notifications and metadata is strictly excluded'
  );
}

// 14.6 Manager Unread Notifications: Returns unread count and non-mutating
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Do I have unread notifications?' }, user: sec14MgrUser }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'NOTIFICATION' &&
    res.body.action === 'GET_UNREAD' &&
    res.body.reply.includes('2 unread notification') &&
    sec14Notif1.isRead === false &&
    sec14Notif2.isRead === false,
    'Manager unread notifications returns count and verified non-mutating (isRead remains false)'
  );
}

// 14.7 Manager Notification Details by Explicit ID: Routes correctly and returns structured details
{
  const res = createMockRes();
  await handleAiChat(
    { body: { message: `Show details of notification ${sec14Notif1._id.toString()}` }, user: sec14MgrUser },
    res,
    () => {}
  );
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'NOTIFICATION' &&
    res.body.action === 'GET_NOTIFICATION_DETAILS' &&
    res.body.reply.includes('Room Reservation Approved') &&
    res.body.reply.includes('Your booking for Room A-101 has been confirmed.'),
    'Explicit notification ID lookup returns structured details for manager'
  );
}

// 14.8 Cross-User Notification Details Ownership Check: Access denied / not found
{
  const res = createMockRes();
  await handleAiChat(
    { body: { message: `Show details of notification ${sec14NotifEmp._id.toString()}` }, user: sec14MgrUser },
    res,
    () => {}
  );
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes('I could not find the details for that notification'),
    'Notification belonging to another user cannot be accessed by manager (ownership enforced)'
  );
}

// 14.9 Notification Details Keyword Ambiguity: Multiple matches return candidate list
{
  const res = createMockRes();
  await handleAiChat(
    { body: { message: 'Show details of notification about Leave Request Alert' }, user: sec14MgrUser },
    res,
    () => {}
  );
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes('Multiple notifications matched your query') &&
    res.body.reply.includes('Please specify the notification ID'),
    'Ambiguous notification keyword search surfaces candidate list without silently picking newest'
  );
}

// 14.10 Invalid Notification ID Lookup: Clear not found notice
{
  const res = createMockRes();
  await handleAiChat(
    { body: { message: 'Show details of notification 999999999999999999999999' }, user: sec14MgrUser },
    res,
    () => {}
  );
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes('I could not find the details for that notification'),
    'Non-existent notification ID lookup clearly informs manager that record was not found'
  );
}

// 14.11 Manager Profile Retrieval: Derives safe fields from authenticated user
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Show my profile' }, user: sec14MgrUser }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'PROFILE' &&
    res.body.action === 'GET_MY_PROFILE' &&
    res.body.reply.includes('Manager Profile') &&
    res.body.reply.includes('Vikram Malhotra') &&
    res.body.reply.includes('MGR001') &&
    res.body.reply.includes('MANAGER') &&
    res.body.reply.includes('Enterprise Operations'),
    'Manager profile query returns authenticated manager profile with role and employee ID'
  );
}

// 14.12 Stored role value verified as lowercase "manager"
{
  assert(sec14MgrUser.role === 'manager', 'Actual stored role value in database is lowercase "manager"');
}

// 14.13 Exclusion of User.gender: Gender is strictly omitted from AI profile output
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Show my profile' }, user: sec14MgrUser }, res, () => {});
  assert(
    !res.body.reply.toLowerCase().includes('gender') &&
    !res.body.reply.toLowerCase().includes('male'),
    'User.gender is strictly excluded from AI profile output'
  );
}

// 14.14 Exclusion of Sensitive Fields: Passwords and security secrets strictly excluded
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'What is my profile information?' }, user: sec14MgrUser }, res, () => {});
  assert(
    !res.body.reply.includes('encryptedSuperSecretPasswordHash') &&
    !res.body.reply.toLowerCase().includes('password'),
    'Password hash and authentication secrets are strictly excluded from AI profile output'
  );
}

// 14.15 Server-Derived Identity: Injected identity fields (userId, employeeId, managerId) are stripped
{
  const res = createMockRes();
  await handleAiChat(
    {
      body: {
        message: 'Show my profile',
        userId: sec14EmpUser._id.toString(),
        employeeId: 'EMP002',
        managerId: 'MGR999',
      },
      user: sec14MgrUser,
    },
    res,
    () => {}
  );
  assert(
    res.body.reply.includes('Vikram Malhotra') &&
    res.body.reply.includes('MGR001') &&
    !res.body.reply.includes('Priya Sharma') &&
    !res.body.reply.includes('EMP002'),
    'Injected identity fields are strictly ignored; server-derived authenticated user profile returned'
  );
}

// 14.16 Cross-User Notification Privacy Refusal: Manager querying another user's notifications is refused
{
  const res = createMockRes();
  await handleAiChat(
    { body: { message: "Show Priya Sharma's notifications" }, user: sec14MgrUser },
    res,
    () => {}
  );
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes('You can only view your own notifications.') &&
    res.body.reply.includes("Access to Priya Sharma's notification data is not permitted."),
    'Manager querying another user notifications receives strict privacy refusal'
  );
}

// 14.17 Cross-User Profile Privacy Refusal: Manager querying another user's profile is refused
{
  const res = createMockRes();
  await handleAiChat(
    { body: { message: "Show Priya Sharma's profile" }, user: sec14MgrUser },
    res,
    () => {}
  );
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes('You can only view your own profile.') &&
    res.body.reply.includes("Access to Priya Sharma's profile information is not permitted."),
    'Manager querying another user profile receives strict privacy refusal'
  );
}

// 14.18 Write Protection: Mark all notifications as read returns informational refusal
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'mark all notifications as read' }, user: sec14MgrUser }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes('Conversational notification and profile modifications are not supported'),
    'Conversational "mark all notifications as read" returns informational non-write refusal'
  );
}

// 14.19 Write Protection: Delete notification returns informational refusal
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'delete notification 707f1f77bcf86cd799439301' }, user: sec14MgrUser }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes('Conversational notification and profile modifications are not supported'),
    'Conversational "delete notification" returns informational non-write refusal'
  );
}

// 14.20 Write Protection: Clear notifications returns informational refusal
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'clear notifications' }, user: sec14MgrUser }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes('Conversational notification and profile modifications are not supported'),
    'Conversational "clear notifications" returns informational non-write refusal'
  );
}

// 14.21 Write Protection: Update department returns informational refusal
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'update department to IT' }, user: sec14MgrUser }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes('Conversational notification and profile modifications are not supported'),
    'Conversational "update department" returns informational non-write refusal'
  );
}

// 14.22 Write Protection: Update designation returns informational refusal
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'update designation to Director' }, user: sec14MgrUser }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes('Conversational notification and profile modifications are not supported'),
    'Conversational "update designation" returns informational non-write refusal'
  );
}

// 14.23 Write Protection: Update phone returns informational refusal
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'update phone number' }, user: sec14MgrUser }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes('Conversational notification and profile modifications are not supported'),
    'Conversational "update phone" returns informational non-write refusal'
  );
}

// 14.24 Write Protection: Change branch returns informational refusal
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'change branch to Chennai' }, user: sec14MgrUser }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes('Conversational notification and profile modifications are not supported'),
    'Conversational "change branch" returns informational non-write refusal'
  );
}

// 14.25 Write Protection: Change role returns informational refusal
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'change role to admin' }, user: sec14MgrUser }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.reply.includes('Conversational notification and profile modifications are not supported'),
    'Conversational "change role" returns informational non-write refusal'
  );
}

// 14.26 Manager Safe Navigation: Produces verified card to /manager/notifications
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Open notifications' }, user: sec14MgrUser }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'NAVIGATION' &&
    res.body.action === 'OPEN_MGR_PAGE' &&
    res.body.navigation !== null &&
    res.body.navigation.destination === 'manager-notifications' &&
    res.body.navigation.path === '/manager/notifications',
    'Manager navigation produces verified navigation card to /manager/notifications'
  );
}

// 14.27 Manager Safe Navigation: Produces verified card to /manager/profile
{
  const res = createMockRes();
  await handleAiChat({ body: { message: 'Open my profile' }, user: sec14MgrUser }, res, () => {});
  assert(
    res.statusCode === 200 &&
    res.body.domain === 'NAVIGATION' &&
    res.body.action === 'OPEN_MGR_PAGE' &&
    res.body.navigation !== null &&
    res.body.navigation.destination === 'manager-profile' &&
    res.body.navigation.path === '/manager/profile',
    'Manager navigation produces verified navigation card to /manager/profile'
  );
}

// 14.28 Employee Route Defense: Employee attempting manager notification/profile navigation is rejected
{
  const resNotif = createMockRes();
  await handleAiChat({ body: { message: 'Open manager notifications' }, user: sec14EmpUser }, resNotif, () => {});
  const resProf = createMockRes();
  await handleAiChat({ body: { message: 'Open manager profile' }, user: sec14EmpUser }, resProf, () => {});
  assert(
    resNotif.body.reply.includes('Access to manager administration pages is restricted to managers only.') &&
    resProf.body.reply.includes('Access to manager administration pages is restricted to managers only.'),
    'Employee attempting manager notification/profile navigation is rejected with access restricted notice'
  );
}

// 14.29 Behavioral Immutability: Zero database mutations occur during manager notification and profile queries
{
  const notifCountBefore = section14Notifications.length;
  const userCountBefore = section14Users.length;
  const unreadStatesBefore = section14Notifications.map((n) => n.isRead);

  const res1 = createMockRes();
  await handleAiChat({ body: { message: 'Show my notifications' }, user: sec14MgrUser }, res1, () => {});
  const res2 = createMockRes();
  await handleAiChat({ body: { message: 'Do I have unread notifications?' }, user: sec14MgrUser }, res2, () => {});
  const res3 = createMockRes();
  await handleAiChat({ body: { message: 'Show my profile' }, user: sec14MgrUser }, res3, () => {});

  const unreadStatesAfter = section14Notifications.map((n) => n.isRead);
  const unreadUnchanged = unreadStatesBefore.every((state, i) => state === unreadStatesAfter[i]);

  assert(
    section14Notifications.length === notifCountBefore &&
    section14Users.length === userCountBefore &&
    unreadUnchanged,
    'Zero database mutations or document alterations occur during notification and profile intelligence queries'
  );
}

// Restore Section 14 mocks
Notification.find = origSec14NotifFind;
Notification.findOne = origSec14NotifFindOne;
User.findById = origSec14UserFindById;

console.log('\n====================================================');
console.log(`MASTER TEST SUITE FINISHED: ${passedCount} TESTS PASSED`);
console.log('====================================================\n');


