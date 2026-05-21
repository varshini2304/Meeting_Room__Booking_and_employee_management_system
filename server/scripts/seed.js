import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { User } from "../models/user.model.js";
import { Room } from "../models/room.model.js";
import { LeaveBalance } from "../models/leave-balance.model.js";

dotenv.config();


const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || "Password@123";

const managers = [
  {
    employeeId: "MGR-001",
    name: "Aarav Sharma",
    email: "manager@toyota.local",
    role: "manager",
    gender: "male",
    department: "Operations",
    designation: "Operations Manager",
    country: "India",
    branch: "Bangalore",
    block: "A",
    floor: "3",
    phone: "+91-9000000001",
  },
];

const employees = [
  {
    employeeId: "EMP-001",
    name: "Priya Iyer",
    email: "priya@toyota.local",
    gender: "female",
    department: "Engineering",
    designation: "Senior Engineer",
    country: "India",
    branch: "Bangalore",
    block: "A",
    floor: "2",
    phone: "+91-9000000010",
  },
  {
    employeeId: "EMP-002",
    name: "Rahul Verma",
    email: "rahul@toyota.local",
    gender: "male",
    department: "Engineering",
    designation: "Engineer",
    country: "India",
    branch: "Bangalore",
    block: "A",
    floor: "2",
    phone: "+91-9000000011",
  },
  {
    employeeId: "EMP-003",
    name: "Sneha Reddy",
    email: "sneha@toyota.local",
    gender: "female",
    department: "Design",
    designation: "Product Designer",
    country: "India",
    branch: "Hyderabad",
    block: "B",
    floor: "1",
    phone: "+91-9000000012",
  },
  {
    employeeId: "EMP-004",
    name: "Karan Mehta",
    email: "karan@toyota.local",
    gender: "male",
    department: "QA",
    designation: "QA Lead",
    country: "India",
    branch: "Chennai",
    block: "C",
    floor: "4",
    phone: "+91-9000000013",
  },
];

const rooms = [
  {
    country: "India", branch: "Bangalore", block: "A", floor: "2", roomNumber: "A-201",
    roomType: "Conference Room", capacity: 20,
    amenities: ["Projector", "Whiteboard", "Video Conferencing"],
  },
  {
    country: "India", branch: "Bangalore", block: "A", floor: "2", roomNumber: "A-202",
    roomType: "Meeting Room (10 members)", capacity: 10,
    amenities: ["TV Screen", "Whiteboard"],
  },
  {
    country: "India", branch: "Bangalore", block: "A", floor: "3", roomNumber: "A-301",
    roomType: "Meeting Room (5 members)", capacity: 5,
    amenities: ["TV Screen"],
  },
  {
    country: "India", branch: "Hyderabad", block: "B", floor: "1", roomNumber: "B-101",
    roomType: "Conference Room", capacity: 16,
    amenities: ["Projector", "Whiteboard"],
  },
  {
    country: "India", branch: "Hyderabad", block: "B", floor: "1", roomNumber: "B-102",
    roomType: "Meeting Room (5 members)", capacity: 5,
    amenities: ["TV Screen"],
  },
  {
    country: "India", branch: "Chennai", block: "C", floor: "4", roomNumber: "C-401",
    roomType: "Meeting Room (10 members)", capacity: 10,
    amenities: ["Projector", "Whiteboard", "Video Conferencing"],
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────
const upsertUser = async (data, reportingManagerId = null) => {
  const existing = await User.findOne({ email: data.email });
  if (existing) {
    console.log(`  ↩  user already exists: ${data.email}`);
    return existing;
  }
  const user = new User({ ...data, password: DEFAULT_PASSWORD, reportingManager: reportingManagerId });
  await user.save();
  console.log(`  +  created user: ${data.email} (${data.role || "employee"})`);
  return user;
};

const upsertRoom = async (data) => {
  const filter = {
    country: data.country, branch: data.branch, block: data.block,
    floor: data.floor, roomNumber: data.roomNumber,
  };
  const existing = await Room.findOne(filter);
  if (existing) {
    console.log(`  ↩  room already exists: ${data.roomNumber} (${data.branch})`);
    return existing;
  }
  const room = await Room.create(data);
  console.log(`  +  created room: ${data.roomNumber} (${data.branch}) — code ${room.secretCode}`);
  return room;
};

const upsertLeaveBalance = async (employeeId, year) => {
  const existing = await LeaveBalance.findOne({ employeeId, year });
  if (existing) return existing;
  const balance = await LeaveBalance.create({ employeeId, year });
  return balance;
};

// ── Main ────────────────────────────────────────────────────────────────────
const seed = async () => {
  await connectDB();
  console.log("Connected. Seeding...\n");

  console.log("Managers:");
  const [primaryManager] = await Promise.all(managers.map((m) => upsertUser(m)));

  console.log("\nEmployees:");
  const employeeDocs = [];
  for (const emp of employees) {
    const doc = await upsertUser(emp, primaryManager?._id);
    employeeDocs.push(doc);
  }

  console.log("\nRooms:");
  for (const room of rooms) {
    await upsertRoom(room);
  }

  console.log("\nLeave balances (current year):");
  const year = new Date().getFullYear();
  let created = 0;
  for (const emp of employeeDocs) {
    const before = await LeaveBalance.countDocuments({ employeeId: emp._id, year });
    await upsertLeaveBalance(emp._id, year);
    const after = await LeaveBalance.countDocuments({ employeeId: emp._id, year });
    if (after > before) created += 1;
  }
  console.log(`  ${created} new leave balance record(s) created for ${year}.`);

  console.log("\n✓ Seed complete.");
  console.log("\nLogin credentials (default password applies to all):");
  console.log(`  Manager:  manager@toyota.local`);
  console.log(`  Employee: priya@toyota.local  (or rahul / sneha / karan @toyota.local)`);
  console.log(`  Password: ${DEFAULT_PASSWORD}`);

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch(async (err) => {
  console.error("\n✗ Seed failed:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
