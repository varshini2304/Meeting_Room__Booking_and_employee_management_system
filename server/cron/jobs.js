import cron from "node-cron";
import { markAbsentForToday } from "../services/attendance.service.js";
import { initYearBalances } from "../services/leave.service.js";
import { Attendance } from "../models/attendance.model.js";
import { Leave } from "../models/leave.model.js";
import { User } from "../models/user.model.js";
import { cancelNoShowBookings } from "../services/booking.service.js";
import { createBulkNotifications } from "../services/notification.service.js";

const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };

export const scheduleAbsentSweep = () => {
  cron.schedule("59 23 * * *", async () => {
    try { const c = await markAbsentForToday(); console.log(`[CRON] Absent sweep — ${c} records`); }
    catch (err) { console.error("[CRON] Absent sweep failed:", err.message); }
  });
};

export const scheduleCheckoutReminder = () => {
  cron.schedule("30 18 * * *", async () => {
    try {
      const date = todayStr();
      const forgot = await Attendance.find({ date, checkInTime: { $ne: null }, checkOutTime: null, status: { $ne: "absent" } }).select("employeeId").lean();
      if (!forgot.length) return;
      await createBulkNotifications(forgot.map((r) => ({ userId: r.employeeId, title: "Don't forget to check out!", message: "You checked in today but haven't checked out yet.", type: "system", metadata: { date } })));
      console.log(`[CRON] Checkout reminders sent — ${forgot.length}`);
    } catch (err) { console.error("[CRON] Checkout reminder failed:", err.message); }
  });
};

export const scheduleNoShowSweep = () => {
  cron.schedule("*/15 * * * *", async () => {
    try { const c = await cancelNoShowBookings(); if (c > 0) console.log(`[CRON] No-show — cancelled ${c}`); }
    catch (err) { console.error("[CRON] No-show sweep failed:", err.message); }
  });
};

export const scheduleWeeklySummary = () => {
  cron.schedule("0 9 * * 1", async () => {
    try {
      const managers = await User.find({ role: "manager", isActive: true }).select("_id").lean();
      if (!managers.length) return;
      await createBulkNotifications(managers.map((m) => ({ userId: m._id, title: "Weekly Attendance Summary Ready", message: "Team weekly attendance report is available in the Attendance Board.", type: "system", metadata: {} })));
    } catch (err) { console.error("[CRON] Weekly summary failed:", err.message); }
  });
};

export const schedulePendingLeaveReminder = () => {
  cron.schedule("0 10 * * 1", async () => {
    try {
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 3);
      const stale = await Leave.find({ status: "pending", createdAt: { $lt: cutoff } }).lean();
      if (!stale.length) return;
      const managers = await User.find({ role: "manager", isActive: true }).select("_id").lean();
      if (!managers.length) return;
      await createBulkNotifications(managers.map((m) => ({ userId: m._id, title: `${stale.length} leave request${stale.length > 1 ? "s" : ""} awaiting review`, message: `You have ${stale.length} pending leave request${stale.length > 1 ? "s" : ""} older than 3 days.`, type: "system", metadata: {} })));
    } catch (err) { console.error("[CRON] Pending leave reminder failed:", err.message); }
  });
};

export const scheduleYearlyBalanceInit = () => {
  cron.schedule("0 0 1 1 *", async () => {
    try { const year = new Date().getFullYear(); const c = await initYearBalances(year); console.log(`[CRON] New year balance init — ${c} employees for ${year}`); }
    catch (err) { console.error("[CRON] Yearly balance init failed:", err.message); }
  });
};

export const registerCronJobs = () => {
  scheduleAbsentSweep();
  scheduleCheckoutReminder();
  scheduleNoShowSweep();
  scheduleWeeklySummary();
  schedulePendingLeaveReminder();
  scheduleYearlyBalanceInit();
  console.log("[CRON] All cron jobs registered");
};
