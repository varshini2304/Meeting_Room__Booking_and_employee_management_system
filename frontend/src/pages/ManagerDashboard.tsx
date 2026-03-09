import { StatCard } from "@/components/StatCard";
import { Building2, CalendarCheck, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useAllBookings } from "@/hooks/queries/useBookings";
import { useRooms } from "@/hooks/queries/useRooms";

const chartConfig = {
  meetings: { label: "Meetings", color: "hsl(211 100% 50%)" },
  participants: { label: "Participants", color: "hsl(211 100% 80%)" },
} satisfies ChartConfig;

const ManagerDashboard = () => {
  const { data: rooms = [] } = useRooms();
  const { data: bookings = [] } = useAllBookings();
  const today = new Date().toISOString().slice(0, 10);
  const bookedToday = bookings.filter((b) => b.date === today && b.status === "booked").length;
  const availableRooms = Math.max(rooms.length - bookedToday, 0);
  const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const chartData = dayOrder.map((day) => {
    const dayBookings = bookings.filter((b) => {
      const d = new Date(b.date);
      return d.toLocaleDateString("en-US", { weekday: "short" }) === day && b.status === "booked";
    });
    const participants = dayBookings.reduce((sum, item) => sum + (item.invitedMembers?.length || 0), 0);
    return { day, meetings: dayBookings.length, participants };
  });

  return (
    <>
      <h1 className="text-2xl font-bold text-foreground mb-6">Manager Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard icon={Building2} iconBg="bg-accent" iconColor="text-primary" label="Total Rooms" value={rooms.length} />
        <StatCard icon={CalendarCheck} iconBg="bg-accent" iconColor="text-primary" label="Rooms Booked Today" value={bookedToday} />
        <StatCard icon={CheckCircle} iconBg="bg-green-50" iconColor="text-success" label="Available Rooms" value={availableRooms} />
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="font-semibold text-card-foreground mb-2">Meeting Analytics</h2>
        <h3 className="text-sm text-muted-foreground mb-4">Meetings Overview</h3>

        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Area type="monotone" dataKey="participants" stackId="1" stroke="var(--color-participants)" fill="var(--color-participants)" fillOpacity={0.3} />
            <Area type="monotone" dataKey="meetings" stackId="2" stroke="var(--color-meetings)" fill="var(--color-meetings)" fillOpacity={0.1} />
          </AreaChart>
        </ChartContainer>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline">Cancel</Button>
          <Button>Save Room</Button>
        </div>
      </div>
    </>
  );
};

export default ManagerDashboard;
