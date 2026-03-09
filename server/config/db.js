import mongoose from "mongoose";
import dns from "node:dns";

export const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is required");
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
  await mongoose.connect(uri);
  console.log("MongoDB connected");
};
