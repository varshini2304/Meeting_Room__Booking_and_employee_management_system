import { mailer } from "../config/mailer.js";

export const sendEmail = async ({ to, subject, html }) => {
  if (!to || !process.env.SMTP_FROM) return;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("SMTP is not fully configured. Skipping email send.");
    return;
  }
  try {
    await mailer.sendMail({ from: process.env.SMTP_FROM, to, subject, html });
  } catch (error) {
    console.error("Email send failed:", error.message);
  }
};

export const sendBookingConfirmationEmail = async ({ to, roomName, date, startTime, endTime }) =>
  sendEmail({
    to,
    subject: "Toyota Meeting Room Booking Confirmation",
    html: `<p>Your booking is confirmed.</p><p><b>Room:</b> ${roomName}<br/><b>Date:</b> ${date}<br/><b>Time:</b> ${startTime} - ${endTime}</p>`
  });

export const sendOwnerMeetingEmail = async ({
  to,
  ownerName,
  ownerEmail,
  ownerEmployeeId,
  roomName,
  location,
  date,
  startTime,
  endTime,
  participants,
  meetingLink,
}) =>
  sendEmail({
    to,
    subject: "Toyota Meeting Booking Details and Check-In Link",
    html: `
      <p>Your meeting is booked successfully.</p>
      <p><b>Employee:</b> ${ownerName || "-"} (${ownerEmployeeId || "-"})</p>
      <p><b>Email:</b> ${ownerEmail || "-"}</p>
      <p><b>Room:</b> ${roomName}</p>
      <p><b>Location:</b> ${location}</p>
      <p><b>Date:</b> ${date}</p>
      <p><b>Time:</b> ${startTime} - ${endTime}</p>
      <p><b>Participants:</b> ${participants?.join(", ") || "None"}</p>
      <p><a href="${meetingLink}">Open Meeting Details and Check In</a></p>
      <p>Please check in within 10 minutes from the meeting start time.</p>
    `,
  });

export const sendParticipantRoomDetailsEmail = async ({
  to,
  roomName,
  location,
  date,
  startTime,
  endTime,
  organizerName,
}) =>
  sendEmail({
    to,
    subject: "Toyota Meeting Room Details",
    html: `
      <p>You are invited to a meeting.</p>
      <p><b>Organizer:</b> ${organizerName || "-"}</p>
      <p><b>Room:</b> ${roomName}</p>
      <p><b>Location:</b> ${location}</p>
      <p><b>Date:</b> ${date}</p>
      <p><b>Time:</b> ${startTime} - ${endTime}</p>
    `,
  });

