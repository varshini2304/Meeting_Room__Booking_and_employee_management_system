import { mailer } from "../config/mailer.js";

export const sendEmail = async ({ to, subject, html }) => {
  const smtpFrom = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim();
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();

  if (!to) {
    console.warn("[email] skipping send: missing recipient");
    return;
  }
  const missing = [];
  if (!smtpHost) missing.push("SMTP_HOST");
  if (!smtpUser) missing.push("SMTP_USER");
  if (!smtpPass) missing.push("SMTP_PASS");
  if (!smtpFrom) missing.push("SMTP_FROM (or SMTP_USER)");
  if (missing.length > 0) {
    console.warn(`[email] skipping send to ${to}: missing env var(s) ${missing.join(", ")}`);
    return;
  }
  try {
    const info = await mailer.sendMail({ from: smtpFrom, to, subject, html });
    console.log(`[email] sent to ${to} (id=${info.messageId})`);
  } catch (error) {
    console.error(`[email] send to ${to} failed:`, error.message);
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

export const sendRoomDeletedCancellationEmail = async ({
  to,
  ownerName,
  roomName,
  location,
  date,
  startTime,
  endTime,
}) =>
  sendEmail({
    to,
    subject: "Toyota Meeting Room Booking Cancelled — Room Removed",
    html: `
      <p>Hi ${ownerName || "there"},</p>
      <p>We're letting you know that your meeting room booking has been cancelled because the room was removed by a manager.</p>
      <p><b>Room:</b> ${roomName}</p>
      <p><b>Location:</b> ${location}</p>
      <p><b>Date:</b> ${date}</p>
      <p><b>Time:</b> ${startTime} - ${endTime}</p>
      <p>Please book a different room for your meeting. We apologise for the inconvenience.</p>
    `,
  });

export const sendParticipantRoomDetailsEmail = async ({
  to,
  organizerName,
  organizerEmail,
  roomName,
  location,
  date,
  startTime,
  endTime,
}) =>
  sendEmail({
    to,
    subject: "Toyota Meeting Venue Details",
    html: `
      <p>You are invited to a meeting.</p>
      <p><b>Organizer:</b> ${organizerName || "-"} (${organizerEmail || "-"})</p>
      <p><b>Room:</b> ${roomName}</p>
      <p><b>Location:</b> ${location}</p>
      <p><b>Date:</b> ${date}</p>
      <p><b>Time:</b> ${startTime} - ${endTime}</p>
    `,
  });

