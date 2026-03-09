import { StatCard } from "@/components/StatCard";
import { Building2, CalendarCheck, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useAllBookings } from "@/hooks/queries/useBookings";
import { useRooms } from "@/hooks/queries/useRooms";
import { useCreateUser } from "@/hooks/queries/useUsers";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import type { UserRole } from "@/api/types";

const chartConfig = {
  meetings: { label: "Meetings", color: "hsl(211 100% 50%)" },
  participants: { label: "Participants", color: "hsl(211 100% 80%)" },
} satisfies ChartConfig;

type NewUserFormValues = {
  employeeId: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  country: string;
  branch: string;
  block: string;
  floor: string;
};

const initialFormValues: NewUserFormValues = {
  employeeId: "",
  name: "",
  email: "",
  password: "",
  role: "employee",
  country: "",
  branch: "",
  block: "",
  floor: "",
};

const ManagerDashboard = () => {
  const { data: rooms = [] } = useRooms();
  const { data: bookings = [] } = useAllBookings();
  const createUser = useCreateUser();
  const { toast } = useToast();
  const [form, setForm] = useState<NewUserFormValues>(initialFormValues);
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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createUser.mutateAsync({
        employeeId: form.employeeId.trim(),
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
        country: form.country.trim(),
        branch: form.branch.trim(),
        block: form.block.trim(),
        floor: form.floor.trim(),
      });
      toast({ title: "User created", description: "New user account has been added." });
      setForm(initialFormValues);
    } catch (error) {
      toast({
        title: "User creation failed",
        description: error instanceof Error ? error.message : "Unable to create user",
        variant: "destructive",
      });
    }
  };

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
      </div>

      <div className="bg-card rounded-xl border border-border p-5 mt-6">
        <h2 className="font-semibold text-card-foreground mb-2">Add New User</h2>
        <p className="text-sm text-muted-foreground mb-4">Manager can create employee or manager accounts.</p>
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Employee ID</Label>
              <Input
                value={form.employeeId}
                onChange={(e) => setForm((prev) => ({ ...prev, employeeId: e.target.value }))}
                placeholder="EMP-1001"
                required
              />
            </div>
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="John Doe"
                required
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="john.doe@company.com"
                required
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                minLength={6}
                placeholder="Minimum 6 characters"
                required
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(value) => setForm((prev) => ({ ...prev, role: value as UserRole }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Country</Label>
              <Input value={form.country} onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))} placeholder="India" />
            </div>
            <div>
              <Label>Branch</Label>
              <Input value={form.branch} onChange={(e) => setForm((prev) => ({ ...prev, branch: e.target.value }))} placeholder="HQ" />
            </div>
            <div>
              <Label>Block</Label>
              <Input value={form.block} onChange={(e) => setForm((prev) => ({ ...prev, block: e.target.value }))} placeholder="A Block" />
            </div>
            <div>
              <Label>Floor</Label>
              <Input value={form.floor} onChange={(e) => setForm((prev) => ({ ...prev, floor: e.target.value }))} placeholder="3rd Floor" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={createUser.isPending}>
              {createUser.isPending ? "Creating..." : "Create User"}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
};

export default ManagerDashboard;
