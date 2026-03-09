import { mailer } from "../config/mailer.js";

export const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.SMTP_FROM || !to) return;
  await mailer.sendMail({ from: process.env.SMTP_FROM, to, subject, html });
};

export const sendBookingConfirmationEmail = async ({ to, roomName, date, startTime, endTime }) =>
  sendEmail({
    to,
    subject: "Toyota Meeting Room Booking Confirmation",
    html: `<p>Your booking is confirmed.</p><p><b>Room:</b> ${roomName}<br/><b>Date:</b> ${date}<br/><b>Time:</b> ${startTime} - ${endTime}</p>`
  });

