import {
  LayoutDashboard, DoorOpen, ClipboardList, Bell, User, History,
  PlusCircle, Settings, MapPin, LogOut, CalendarCheck
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
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Profile", url: "/profile", icon: User },
];

const managerItems = [
  { title: "Book Room", url: "/manager/book-room", icon: DoorOpen },
  { title: "Manage My Bookings", url: "/manager/my-bookings", icon: ClipboardList },
  { title: "Booking History", url: "/manager/booking-history", icon: History },
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
    <Sidebar collapsible="icon" className="border-r-0">
      <div className="p-4 pb-6 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <span className="text-xs font-bold text-muted-foreground">T</span>
        </div>
        {!collapsed && <span className="text-lg font-bold text-primary">TOYOTA</span>}
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
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent"
                        }`}
                        activeClassName=""
                      >
                        <item.icon className="h-5 w-5" />
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
            className="flex items-center gap-2 text-destructive font-medium px-3 py-2"
            onClick={async () => {
              await logout();
              navigate("/login", { replace: true });
            }}
          >
            <LogOut className="h-5 w-5" />
            <span>Logout</span>
          </button>
        </div>
      )}
    </Sidebar>
  );
}
