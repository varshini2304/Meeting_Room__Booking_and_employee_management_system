import { Notification } from "../models/notification.model.js";

export const createNotification = async (payload) => Notification.create(payload);

export const createBulkNotifications = async (payloads) => {
  if (!payloads.length) return [];
  return Notification.insertMany(payloads);
};

