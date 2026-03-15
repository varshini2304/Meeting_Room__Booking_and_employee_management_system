export type UserRole = "employee" | "manager";
export type Gender = "female" | "male" | "other" | "unspecified";

export interface User {
  _id: string;
  employeeId: string;
  name: string;
  email: string;
  role: UserRole;
  gender?: Gender;
  country?: string;
  branch?: string;
  block?: string;
  floor?: string;
  department?: string;
  designation?: string;
  phone?: string;
  isActive?: boolean;
}

export interface Room {
  _id: string;
  country: string;
  branch: string;
  block: string;
  floor: string;
  roomNumber: string;
  roomType: string;
  capacity: number;
  imageUrl?: string;
  amenities: string[];
  isActive: boolean;
  isAvailable?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Booking {
  _id: string;
  roomId: Room | string;
  ownerId: User | string;
  date: string;
  startTime: string;
  endTime: string;
  invitedMembers: string[];
  status: "booked" | "cancelled";
  occupancyConfirmedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  _id: string;
  userId: string;
  title: string;
  message: string;
  type: "invite" | "reminder" | "system";
  isRead: boolean;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
