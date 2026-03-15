import dotenv from "dotenv";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { cancelNoShowBookings, clearEndedMeetingsOccupancy } from "./services/booking.service.js";
import { registerCronJobs } from "./cron/jobs.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

const runCleanupJob = async () => {
  try {
    const cancelled = await cancelNoShowBookings();
    if (cancelled > 0) {
      console.log(`Auto-cancelled ${cancelled} booking(s) due to no-show`);
    }
    const freed = await clearEndedMeetingsOccupancy();
    if (freed > 0) {
      console.log(`Auto-cleared occupancy for ${freed} ended booking(s)`);
    }
  } catch (error) {
    console.error("Booking sweep failed", error.message);
  }
};

const start = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    registerCronJobs();
    
    // Run immediately on startup, then every 60 seconds
    await runCleanupJob();
    setInterval(runCleanupJob, 60 * 1000);
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
};

start();
