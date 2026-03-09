import dotenv from "dotenv";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { cancelNoShowBookings } from "./services/booking.service.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    setInterval(async () => {
      try {
        const cancelled = await cancelNoShowBookings();
        if (cancelled > 0) {
          console.log(`Auto-cancelled ${cancelled} booking(s) due to no-show`);
        }
      } catch (error) {
        console.error("No-show cancellation sweep failed", error.message);
      }
    }, 60 * 1000);
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
};

start();

