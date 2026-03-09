import { Search, Bell, Monitor, Triangle, Smartphone, User, LogOut } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/queries/useNotifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const managerBase = location.pathname.startsWith("/manager") ? "/manager" : "";
  const { logout, user } = useAuth();
  const { data: notifications = [] } = useNotifications();
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-border bg-card">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="text-muted-foreground" />
        <div className="flex items-center gap-2 text-muted-foreground">
          <Smartphone className="h-4 w-4" />
          <Triangle className="h-4 w-4" />
          <Monitor className="h-4 w-4" />
        </div>
      </div>
      <div className="flex items-center gap-2 bg-secondary rounded-full px-4 py-1.5 w-64">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search"
          className="bg-transparent text-sm outline-none w-full text-foreground placeholder:text-muted-foreground"
        />
      </div>
      <div className="flex items-center gap-4">
        {/* Notifications Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="relative text-muted-foreground hover:text-foreground">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
                {unreadCount}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="p-3 border-b border-border">
              <h4 className="font-semibold text-sm text-foreground">Notifications</h4>
            </div>
            <div className="divide-y divide-border max-h-64 overflow-y-auto">
              {notifications.map((n) => (
                <div key={n._id} className="px-3 py-2.5">
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.message}</p>
                </div>
              ))}
            </div>
            <div className="p-2 border-t border-border">
              <Button variant="ghost" size="sm" className="w-full text-primary" onClick={() => navigate(`${managerBase}/notifications`)}>
                View All
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* User Avatar Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-8 h-8 rounded-full bg-muted overflow-hidden cursor-pointer">
              <div className="w-full h-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => navigate(`${managerBase}/profile`)}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`${managerBase}/notifications`)}>
              <Bell className="mr-2 h-4 w-4" />
              Notifications
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await logout();
                navigate("/login", { replace: true });
              }}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
