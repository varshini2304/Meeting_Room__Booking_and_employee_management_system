import { useMemo, useState } from "react";
import { useCheckIn, useCheckOut, useMyAttendance, useMySummary, useRequestCorrection, useTodayAttendance } from "@/hooks/queries/useAttendance";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { LogIn, LogOut, Clock, CalendarDays, TrendingUp, AlertCircle, CheckCircle2, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (iso: string | null | undefined) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const fmtHours = (h: number) => {
  if (h === null || h === undefined) return "0h 0m";
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${mins}m`;
};

const STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  present:  { label: "Present",   color: "text-emerald-700", bg: "bg-emerald-50",  dot: "bg-emerald-500" },
  late:     { label: "Late",      color: "text-amber-700",   bg: "bg-amber-50",    dot: "bg-amber-500"   },
  absent:   { label: "Absent",    color: "text-red-700",     bg: "bg-red-50",      dot: "bg-red-500"     },
  "half-day":{ label: "Half Day", color: "text-sky-700",     bg: "bg-sky-50",      dot: "bg-sky-500"     },
  "on-leave":{ label: "On Leave", color: "text-purple-700",  bg: "bg-purple-50",   dot: "bg-purple-500"  },
};

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Calendar Heatmap ─────────────────────────────────────────────────────────

function AttendanceCalendar({
  records,
  month,
  year,
}: {
  records: { date: string; status: string }[];
  month: number;
  year: number;
}) {
  const recordMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of records) m[r.date] = r.status;
    return m;
  }, [records]);

  const days = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const last = new Date(year, month, 0);
    const startPad = first.getDay(); // 0=Sun
    const cells: (null | { day: number; date: string; status?: string })[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= last.getDate(); d++) {
      const date = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const dow = new Date(year, month - 1, d).getDay();
      cells.push({ day: d, date, status: recordMap[date], isWeekend: dow === 0 || dow === 6 });
    }
    return cells;
  }, [recordMap, month, year]);

  const cellColor = (status?: string) => {
    if (!status) return "bg-muted/40";
    const colors: Record<string, string> = {
      present: "bg-emerald-400",
      late: "bg-amber-400",
      absent: "bg-red-300",
      "half-day": "bg-sky-400",
      "on-leave": "bg-purple-400",
    };
    return colors[status] || "bg-muted/40";
  };

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-background via-muted/20 to-background p-4">
      <div className="grid grid-cols-7 gap-2 mb-2">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
          <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((cell, i) =>
          cell === null ? (
            <div key={`pad-${i}`} />
          ) : (
            <div
              key={cell.date}
              title={`${cell.date}${cell.status ? ` — ${cell.status}` : ""}`}
              className={cn(
                "aspect-square rounded-xl border border-border/60 flex flex-col items-center justify-center text-[12px] font-semibold cursor-default transition-all hover:-translate-y-0.5 hover:shadow-sm",
                cellColor(cell.status),
                cell.status ? "text-white" : "text-foreground",
                cell.isWeekend && !cell.status ? "bg-muted/50 text-muted-foreground" : ""
              )}
            >
              <span>{cell.day}</span>
              {cell.status && (
                <span className="mt-1 h-1.5 w-6 rounded-full bg-white/70" />
              )}
            </div>
          )
        )}
      </div>
      <div className="flex flex-wrap gap-3 mt-4">
        {Object.entries(STATUS_META).map(([key, val]) => (
          <span key={key} className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className={cn("h-2.5 w-2.5 rounded-sm", val.dot)} />
            {val.label}
          </span>
        ))}
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-sm bg-muted" />
          Weekend
        </span>
      </div>
    </div>
  );
}

// ─── Live elapsed timer ───────────────────────────────────────────────────────

function ElapsedTimer({ checkInTime }: { checkInTime: string }) {
  const [, forceRender] = useState(0);
  useMemo(() => {
    const id = setInterval(() => forceRender(n => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const ms = Date.now() - new Date(checkInTime).getTime();
  const hrs = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return <span>{hrs}h {mins}m elapsed</span>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const Attendance = () => {
  const { toast } = useToast();
  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [viewYear, setViewYear] = useState(now.getFullYear());

  const { data: today } = useTodayAttendance();
  const { data: summary } = useMySummary(viewMonth, viewYear);
  const { data: records = [] } = useMyAttendance(viewMonth, viewYear);
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const requestCorrection = useRequestCorrection();
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({
    date: now.toISOString().slice(0, 10),
    checkInTime: "",
    checkOutTime: "",
    reason: "",
  });

  const isCheckedIn = Boolean(today?.checkInTime);
  const isCheckedOut = Boolean(today?.checkOutTime);
  const todayMeta = STATUS_META[today?.status || "absent"];

  const handleCheckIn = async () => {
    try {
      await checkIn.mutateAsync();
      toast({ title: "Checked in ✓", description: `Checked in at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` });
    } catch (e) {
      toast({ title: "Check-in failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  const handleCheckOut = async () => {
    try {
      await checkOut.mutateAsync();
      toast({ title: "Checked out ✓", description: "Have a great rest of your day!" });
    } catch (e) {
      toast({ title: "Check-out failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  const handleRequestSubmit = async () => {
    try {
      await requestCorrection.mutateAsync({
        date: requestForm.date,
        checkInTime: requestForm.checkInTime ? `${requestForm.date}T${requestForm.checkInTime}:00` : undefined,
        checkOutTime: requestForm.checkOutTime ? `${requestForm.date}T${requestForm.checkOutTime}:00` : undefined,
        reason: requestForm.reason,
      });
      toast({ title: "Request sent ✓", description: "Your correction request was sent to your manager." });
      setRequestOpen(false);
      setRequestForm({ date: now.toISOString().slice(0, 10), checkInTime: "", checkOutTime: "", reason: "" });
    } catch (e) {
      toast({ title: "Request failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const statCards = [
    { label: "Present", value: summary?.present ?? 0, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Absent",  value: summary?.absent ?? 0,  icon: AlertCircle,  color: "text-red-600",     bg: "bg-red-50"     },
    { label: "Late",    value: summary?.late ?? 0,    icon: Clock,        color: "text-amber-600",   bg: "bg-amber-50"   },
    { label: "Avg Hours", value: fmtHours(summary?.avgWorkHours ?? 0), icon: TrendingUp, color: "text-sky-600", bg: "bg-sky-50" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-foreground">My Attendance</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </span>
          <Button variant="outline" className="rounded-xl" onClick={() => setRequestOpen(true)}>
            Request Edit
          </Button>
        </div>
      </div>

      {/* ── Today card ── */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row items-stretch">
          {/* Left: status strip */}
          <div className={cn("flex items-center justify-center p-6 sm:w-48 flex-shrink-0", todayMeta.bg)}>
            <div className="text-center">
              <div className={cn("inline-flex items-center gap-2 text-sm font-bold px-3 py-1 rounded-full mb-2", todayMeta.bg, todayMeta.color)}>
                <span className={cn("h-2 w-2 rounded-full", todayMeta.dot)} />
                {todayMeta.label}
              </div>
              <p className="text-xs text-muted-foreground">Today's status</p>
            </div>
          </div>

          {/* Right: times + action */}
          <div className="flex-1 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex gap-8">
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><LogIn className="h-3 w-3" /> Check In</p>
                <p className="text-2xl font-bold text-foreground">{fmt(today?.checkInTime)}</p>
                {isCheckedIn && !isCheckedOut && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <ElapsedTimer checkInTime={today!.checkInTime!} />
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><LogOut className="h-3 w-3" /> Check Out</p>
                <p className="text-2xl font-bold text-foreground">{fmt(today?.checkOutTime)}</p>
                {isCheckedOut && (
                  <p className="text-xs text-muted-foreground mt-0.5">{fmtHours(today?.workHours ?? 0)} worked</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {!isCheckedIn && (
                <Button
                  onClick={handleCheckIn}
                  disabled={checkIn.isPending}
                  className="rounded-xl px-8 h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2"
                >
                  <LogIn className="h-4 w-4" />
                  {checkIn.isPending ? "Checking in…" : "Check In"}
                </Button>
              )}
              {isCheckedIn && !isCheckedOut && (
                <Button
                  onClick={handleCheckOut}
                  disabled={checkOut.isPending}
                  variant="outline"
                  className="rounded-xl px-8 h-12 border-amber-400 text-amber-700 hover:bg-amber-50 font-semibold gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  {checkOut.isPending ? "Checking out…" : "Check Out"}
                </Button>
              )}
              {isCheckedOut && (
                <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                  <CheckCircle2 className="h-5 w-5" />
                  Done for today
                </div>
              )}
              {today?.correctionRequest?.status === "pending" && (
                <span className="text-xs text-amber-600 font-medium">Correction request pending approval</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Summary stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", card.bg)}>
              <card.icon className={cn("h-5 w-5", card.color)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="text-xl font-bold text-foreground">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Calendar heatmap ── */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Attendance Calendar
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">‹</button>
            <span className="text-sm font-medium text-foreground w-24 text-center">
              {MONTH_NAMES[viewMonth - 1]} {viewYear}
            </span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">›</button>
          </div>
        </div>
        <AttendanceCalendar records={records} month={viewMonth} year={viewYear} />
      </div>

      {/* ── History table ── */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Timer className="h-4 w-4 text-primary" />
            This Month's Log
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-xs font-semibold text-muted-foreground px-6 py-3">Date</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Check In</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Check Out</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Hours</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No records for this month yet.
                  </td>
                </tr>
              )}
              {records.map((r) => {
                const meta = STATUS_META[r.status] || STATUS_META.absent;
                return (
                  <tr key={r._id || r.date} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-3 text-sm text-foreground font-medium">
                      {new Date(r.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">{fmt(r.checkInTime)}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{fmt(r.checkOutTime)}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{fmtHours(r.workHours)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full", meta.bg, meta.color)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                        {meta.label}
                      </span>
                      {r.correctionRequest?.status === "pending" && (
                        <span className="ml-2 inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                          Pending edit
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={requestOpen} onOpenChange={(v) => !v && setRequestOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Attendance Edit</DialogTitle>
            <DialogDescription>
              Submit a correction request. Your manager will review and approve the change.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div>
              <Label>Date</Label>
              <Input type="date" value={requestForm.date} onChange={(e) => setRequestForm((p) => ({ ...p, date: e.target.value }))} className="mt-1.5" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Check-in time</Label>
                <Input type="time" value={requestForm.checkInTime} onChange={(e) => setRequestForm((p) => ({ ...p, checkInTime: e.target.value }))} className="mt-1.5" />
              </div>
              <div>
                <Label>Check-out time</Label>
                <Input type="time" value={requestForm.checkOutTime} onChange={(e) => setRequestForm((p) => ({ ...p, checkOutTime: e.target.value }))} className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea
                value={requestForm.reason}
                onChange={(e) => setRequestForm((p) => ({ ...p, reason: e.target.value }))}
                placeholder="Reason for the correction request"
                className="mt-1.5 min-h-20 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestOpen(false)}>Cancel</Button>
            <Button onClick={handleRequestSubmit} disabled={requestCorrection.isPending}>
              {requestCorrection.isPending ? "Submitting…" : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Attendance;
