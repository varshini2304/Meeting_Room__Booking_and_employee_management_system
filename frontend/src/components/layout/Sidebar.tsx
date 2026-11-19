import {
  LayoutDashboard, DoorOpen, ClipboardList, Bell, User, History,
  PlusCircle, Settings, MapPin, LogOut, CalendarCheck, ClipboardCheck, CalendarOff, BarChart3
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const userItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Book Room", url: "/book-room", icon: DoorOpen },
  { title: "Manage Bookings", url: "/manage-bookings", icon: ClipboardList },
  { title: "Booking History", url: "/booking-history", icon: History },
  { title: "My Attendance", url: "/attendance", icon: ClipboardCheck },
  { title: "My Leaves", url: "/leaves", icon: CalendarOff },
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Profile", url: "/profile", icon: User },
];

const managerItems = [
  { title: "Book Room", url: "/manager/book-room", icon: DoorOpen },
  { title: "Manage My Bookings", url: "/manager/my-bookings", icon: ClipboardList },
  { title: "Booking History", url: "/manager/booking-history", icon: History },
  { title: "Attendance Board", url: "/manager/attendance", icon: ClipboardCheck },
  { title: "My Attendance", url: "/manager/my-attendance", icon: ClipboardCheck },
  { title: "Leave Requests", url: "/manager/leaves", icon: CalendarOff },
  { title: "Leave Balances", url: "/manager/leaves/balances", icon: BarChart3 },
  { title: "Create Room", url: "/manager/create-room", icon: PlusCircle },
  { title: "Manage Rooms", url: "/manager/manage-rooms", icon: Settings },
  { title: "All Bookings", url: "/manager/all-bookings", icon: CalendarCheck },
  { title: "Room Availability", url: "/manager/room-availability", icon: MapPin },
];

interface SidebarNavProps {
  variant?: "user" | "manager";
}

export function SidebarNav({ variant = "user" }: SidebarNavProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const items = variant === "manager"
    ? [
        { title: "Dashboard", url: "/manager", icon: LayoutDashboard },
        ...managerItems,
        { title: "Notifications", url: "/manager/notifications", icon: Bell },
        { title: "Profile", url: "/manager/profile", icon: User },
      ]
    : userItems;

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border bg-gradient-to-b from-slate-50 via-white to-slate-50 text-foreground"
    >
      <div className="p-4 pb-6 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-sm">
          <span className="text-xs font-extrabold text-white">M</span>
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <span className="text-lg font-extrabold tracking-wide text-slate-900">ROOMS</span>
            <div className="text-[10px] text-slate-500">Room Booking</div>
          </div>
        )}
      </div>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title + item.url}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <NavLink
                        to={item.url}
                        end
                        className={`group flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
                          isActive
                            ? "bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-sm"
                            : "text-slate-700 hover:bg-slate-100"
                        }`}
                        activeClassName=""
                      >
                        <span
                          className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                            isActive ? "bg-white/20" : "bg-slate-100 group-hover:bg-slate-200"
                          }`}
                        >
                          <item.icon className={`h-4.5 w-4.5 ${isActive ? "text-white" : "text-slate-600"}`} />
                        </span>
                        {!collapsed && <span className="font-medium">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {!collapsed && (
        <div className="mt-auto p-4">
          <button
            className="flex items-center gap-2 text-red-600 hover:text-red-700 font-medium px-3 py-2 rounded-xl hover:bg-red-50 transition-colors"
            onClick={async () => {
              await logout();
              navigate("/login", { replace: true });
            }}
          >
            <span className="h-8 w-8 rounded-lg bg-red-50 flex items-center justify-center">
              <LogOut className="h-4 w-4 text-red-600" />
            </span>
            <span>Logout</span>
          </button>
        </div>
      )}
    </Sidebar>
  );
}
