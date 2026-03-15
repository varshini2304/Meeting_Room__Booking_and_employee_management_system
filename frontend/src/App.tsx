import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import BookRoom from "./pages/BookRoom";
import ManageBookings from "./pages/ManageBookings";
import BookingHistory from "./pages/BookingHistory";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import ManagerDashboard from "./pages/ManagerDashboard";
import Attendance from "./pages/Attendance";
import ManagerAttendance from "./pages/ManagerAttendance";
import MyLeaves from "./pages/MyLeaves";
import ManagerLeaves from "./pages/ManagerLeaves";
import CreateRoom from "./pages/CreateRoom";
import ManageRooms from "./pages/ManageRooms";
import AllBookings from "./pages/AllBookings";
import RoomAvailability from "./pages/RoomAvailability";
import NotFound from "./pages/NotFound";
import MeetingCheckIn from "./pages/MeetingCheckIn";
import ConfirmBooking from "./pages/ConfirmBooking";
import BookingSuccess from "./pages/BookingSuccess";
import { useAuth } from "./contexts/AuthContext";

const queryClient = new QueryClient();

const RoleEntry = () => {
  const { isAuthenticated, role, isLoading } = useAuth();
  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={role === "manager" ? "/manager" : "/dashboard"} replace />;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<RoleEntry />} />
    <Route path="/login" element={<Login />} />
    <Route path="/meeting-check-in" element={<MeetingCheckIn />} />

    <Route
      element={
        <ProtectedRoute requireRole="employee">
          <AppLayout variant="user" />
        </ProtectedRoute>
      }
    >
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/book-room" element={<BookRoom />} />
      <Route path="/confirm-booking" element={<ConfirmBooking />} />
      <Route path="/booking-success" element={<BookingSuccess />} />
      <Route path="/manage-bookings" element={<ManageBookings />} />
      <Route path="/booking-history" element={<BookingHistory />} />
      <Route path="/attendance" element={<Attendance />} />
      <Route path="/leaves" element={<MyLeaves />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/profile" element={<Profile />} />
    </Route>

    <Route
      path="/manager"
      element={
        <ProtectedRoute requireRole="manager">
          <AppLayout variant="manager" />
        </ProtectedRoute>
      }
    >
      <Route index element={<ManagerDashboard />} />
      <Route path="book-room" element={<BookRoom />} />
      <Route path="confirm-booking" element={<ConfirmBooking />} />
      <Route path="booking-success" element={<BookingSuccess />} />
      <Route path="my-bookings" element={<ManageBookings />} />
      <Route path="booking-history" element={<BookingHistory />} />
      <Route path="attendance" element={<ManagerAttendance />} />
      <Route path="my-attendance" element={<Attendance />} />
      <Route path="leaves" element={<ManagerLeaves />} />
      <Route path="create-room" element={<CreateRoom />} />
      <Route path="manage-rooms" element={<ManageRooms />} />
      <Route path="all-bookings" element={<AllBookings />} />
      <Route path="room-availability" element={<RoomAvailability />} />
      <Route path="notifications" element={<Notifications />} />
      <Route path="profile" element={<Profile />} />
    </Route>

    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
