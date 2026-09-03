import { Notification } from "../models/notification.model.js";

export const createNotification = async (payload) => Notification.create(payload);

export const createBulkNotifications = async (payloads) => {
  if (!payloads.length) return [];
  return Notification.insertMany(payloads);
};

/**
 * Phase 15: Authoritative retrieval of user notifications.
 * Strictly scopes to authenticated userId, clamps limit, omits metadata.
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.userId
 * @param {number} [params.limit=5]
 * @param {boolean} [params.isRead]
 * @returns {Promise<Object>}
 */
export const getUserNotifications = async ({ userId, limit = 5, isRead } = {}) => {
  if (!userId) {
    return { success: false, error: "UNAUTHORIZED", message: "Authenticated user identity required." };
  }

  const safeLimit = Math.min(Math.max(1, parseInt(limit, 10) || 5), 20);
  const filter = { userId };
  if (typeof isRead === "boolean") {
    filter.isRead = isRead;
  }

  const query = Notification.find(filter);
  const chain = query.select ? query.select("_id title message type isRead createdAt") : query;
  const sorted = chain.sort ? chain.sort({ createdAt: -1 }) : chain;
  const limited = sorted.limit ? sorted.limit(safeLimit) : sorted;
  const list = limited.lean ? await limited.lean() : await limited;

  return {
    success: true,
    count: list.length,
    notifications: list.map((n) => ({
      id: String(n._id),
      title: n.title,
      message: n.message,
      type: n.type,
      isRead: Boolean(n.isRead),
      createdAt: n.createdAt,
    })),
  };
};

/**
 * Phase 15: Authoritative retrieval of unread notifications for a user.
 * Strictly non-mutating (never sets isRead=true).
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.userId
 * @returns {Promise<Object>}
 */
export const getUserUnreadNotifications = async ({ userId } = {}) => {
  if (!userId) {
    return { success: false, error: "UNAUTHORIZED", message: "Authenticated user identity required." };
  }

  const query = Notification.find({ userId, isRead: false });
  const chain = query.select ? query.select("_id title message type isRead createdAt") : query;
  const sorted = chain.sort ? chain.sort({ createdAt: -1 }) : chain;
  const unreadList = sorted.lean ? await sorted.lean() : await sorted;

  return {
    success: true,
    unreadCount: unreadList.length,
    notifications: unreadList.map((n) => ({
      id: String(n._id),
      title: n.title,
      message: n.message,
      type: n.type,
      isRead: false,
      createdAt: n.createdAt,
    })),
  };
};

/**
 * Phase 15: Authoritative retrieval of notification details.
 * Strictly enforces user ownership.
 * When matching by keyword/indirect query, detects ambiguity if multiple records match.
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.userId
 * @param {string} [params.notificationId]
 * @param {string} [params.query]
 * @returns {Promise<Object>}
 */
export const getUserNotificationDetails = async ({ userId, notificationId, query } = {}) => {
  if (!userId) {
    return { success: false, error: "UNAUTHORIZED", message: "Authenticated user identity required." };
  }

  let notif = null;

  // 1. Explicit ID lookup (strictly ownership checked with { _id, userId })
  if (notificationId && typeof notificationId === "string" && notificationId.trim()) {
    const cleanId = notificationId.trim();
    if (!/^[0-9a-fA-F]{24}$/.test(cleanId)) {
      return { success: false, message: `Invalid notification ID format "${cleanId}".` };
    }

    const q = Notification.findOne({ _id: cleanId, userId });
    const chain = q.select ? q.select("_id title message type isRead createdAt") : q;
    notif = chain.lean ? await chain.lean() : await chain;

    if (!notif) {
      return { success: false, message: "No matching notification found or access denied." };
    }

    return {
      success: true,
      notification: {
        id: String(notif._id),
        title: notif.title,
        message: notif.message,
        type: notif.type,
        isRead: Boolean(notif.isRead),
        createdAt: notif.createdAt,
      },
    };
  }

  // 2. Keyword search on clearly defined fields: title and message
  if (query && typeof query === "string" && query.trim()) {
    const qStr = query.trim();
    const q = Notification.find({
      userId,
      $or: [
        { title: { $regex: qStr, $options: "i" } },
        { message: { $regex: qStr, $options: "i" } },
      ],
    });
    const chain = q.select ? q.select("_id title message type isRead createdAt") : q;
    const sorted = chain.sort ? chain.sort({ createdAt: -1 }) : chain;
    const limited = sorted.limit ? sorted.limit(5) : sorted;
    const matches = limited.lean ? await limited.lean() : await limited;

    if (!matches || matches.length === 0) {
      return { success: false, message: "No matching notification found." };
    }

    if (matches.length === 1) {
      const match = matches[0];
      return {
        success: true,
        notification: {
          id: String(match._id),
          title: match.title,
          message: match.message,
          type: match.type,
          isRead: Boolean(match.isRead),
          createdAt: match.createdAt,
        },
      };
    }

    // Multiple matches: return ambiguity response rather than silently picking newest
    return {
      success: false,
      ambiguous: true,
      count: matches.length,
      candidates: matches.map((m) => ({
        id: String(m._id),
        title: m.title,
        type: m.type,
        createdAt: m.createdAt,
      })),
      message: "Multiple notifications matched your query. Please specify the notification ID.",
    };
  }

  return { success: false, message: "Please provide a notification ID or search query." };
};


