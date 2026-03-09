import { Booking } from "../models/booking.model.js";
import {
  cancelNoShowBookings,
  confirmOccupancyByToken,
  createBooking as createBookingService,
  getCheckInDetailsByToken,
} from "../services/booking.service.js";

export const createBooking = async (req, res, next) => {
  try {
    const booking = await createBookingService({
      ownerId: req.user._id,
      roomId: req.body.roomId,
      date: req.body.date,
      startTime: req.body.startTime,
      invitedMembers: req.body.invitedMembers || []
    });
    res.status(201).json(booking);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "This room slot is already booked" });
    }
    return next(error);
  }
};

export const getMyUpcomingBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ ownerId: req.user._id, status: "booked" })
      .populate("roomId")
      .sort({ date: 1, startTime: 1 });
    res.json(bookings);
  } catch (error) {
    next(error);
  }
};

export const getAllBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({})
      .populate("roomId")
      .populate("ownerId", "name email employeeId role")
      .sort({ date: 1, startTime: 1 });
    res.json(bookings);
  } catch (error) {
    next(error);
  }
};

export const getDayBookings = async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: "date is required" });
    const bookings = await Booking.find({ date, status: "booked" })
      .populate("roomId")
      .populate("ownerId", "name email employeeId")
      .sort({ startTime: 1 });
    return res.json(bookings);
  } catch (error) {
    return next(error);
  }
};

export const getBookingHistory = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ ownerId: req.user._id })
      .populate("roomId")
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    next(error);
  }
};

export const cancelBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (String(booking.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ message: "Only booking owner can cancel" });
    }
    booking.status = "cancelled";
    booking.canceledAt = new Date();
    await booking.save();
    return res.json({ message: "Booking cancelled", booking });
  } catch (error) {
    return next(error);
  }
};

export const confirmOccupancy = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (String(booking.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ message: "Only booking owner can confirm occupancy" });
    }
    booking.occupancyConfirmedAt = new Date();
    await booking.save();
    return res.json({ message: "Occupancy confirmed", booking });
  } catch (error) {
    return next(error);
  }
};

export const getCheckInDetails = async (req, res, next) => {
  try {
    const token = String(req.query.token || "");
    if (!token) return res.status(400).json({ message: "token is required" });
    const details = await getCheckInDetailsByToken(token);
    return res.json(details);
  } catch (error) {
    return next(error);
  }
};

export const openCheckInPage = async (req, res, next) => {
  try {
    const token = String(req.query.token || "");
    if (!token) return res.status(400).json({ message: "token is required" });
    const frontendBase = process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:5173";
    const redirectUrl = `${frontendBase.replace(/\/$/, "")}/meeting-check-in?token=${encodeURIComponent(token)}`;
    return res.redirect(302, redirectUrl);
  } catch (error) {
    return next(error);
  }
};

export const confirmOccupancyWithToken = async (req, res, next) => {
  try {
    const token = String(req.query.token || "");
    if (!token) return res.status(400).json({ message: "token is required" });
    const booking = await confirmOccupancyByToken(token);
    return res.json({ message: "Occupancy confirmed", booking });
  } catch (error) {
    return next(error);
  }
};

export const runNoShowSweep = async (req, res, next) => {
  try {
    const cancelled = await cancelNoShowBookings();
    return res.json({ cancelled });
  } catch (error) {
    return next(error);
  }
};
