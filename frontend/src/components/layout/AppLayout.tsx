import { SidebarProvider } from "@/components/ui/sidebar";
import { SidebarNav } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { Outlet } from "react-router-dom";

interface AppLayoutProps {
  children?: React.ReactNode;
  variant?: "user" | "manager";
}

export function AppLayout({ children, variant = "user" }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <SidebarNav variant={variant} />
        <div className="flex-1 flex flex-col">
          <Navbar />
          <main className="flex-1 p-6">{children ?? <Outlet />}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
