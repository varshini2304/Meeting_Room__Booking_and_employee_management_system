import { useState, useMemo } from "react";
import { useLiveBoard, useOverrideAttendance, useReviewCorrection } from "@/hooks/queries/useAttendance";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Search, RefreshCw, Users, CheckCircle2, AlertCircle, Clock, TrendingUp, Edit3, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LiveBoardEntry } from "@/api/attendance";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const fmt = (iso: string | null | undefined) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
const fmtHours = (h: number) => {
  if (!h) return "—";
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${mins}m`;
};

const STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  present:    { label: "Present",   color: "text-emerald-700", bg: "bg-emerald-50",  dot: "bg-emerald-500" },
  late:       { label: "Late",      color: "text-amber-700",   bg: "bg-amber-50",    dot: "bg-amber-500"   },
  absent:     { label: "Absent",    color: "text-red-700",     bg: "bg-red-50",      dot: "bg-red-500"     },
  "half-day": { label: "Half Day",  color: "text-sky-700",     bg: "bg-sky-50",      dot: "bg-sky-500"     },
  "on-leave": { label: "On Leave",  color: "text-purple-700",  bg: "bg-purple-50",   dot: "bg-purple-500"  },
  weekend:    { label: "Weekend",   color: "text-zinc-600",    bg: "bg-zinc-100",    dot: "bg-zinc-400"    },
};

// ─── Override dialog ──────────────────────────────────────────────────────────

interface OverrideDialogProps {
  entry: LiveBoardEntry | null;
  open: boolean;
  onClose: () => void;
}

function OverrideDialog({ entry, open, onClose }: OverrideDialogProps) {
  const override = useOverrideAttendance();
  const { toast } = useToast();
  const [status, setStatus] = useState("present");
  const [checkInTime, setCheckInTime] = useState("");
  const [checkOutTime, setCheckOutTime] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async () => {
    if (!entry) return;
    try {
      await override.mutateAsync({
        recordId: entry.recordId || "new",
        payload: {
          status,
          notes,
          checkInTime: checkInTime ? `${entry.date}T${checkInTime}:00` : undefined,
          checkOutTime: checkOutTime ? `${entry.date}T${checkOutTime}:00` : undefined,
          employeeId: entry.employee._id,
          date: entry.date,
        },
      });
      toast({ title: "Attendance updated", description: `${entry.employee.name}'s record has been corrected.` });
      onClose();
    } catch (e) {
      toast({ title: "Override failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Override Attendance</DialogTitle>
          <DialogDescription>
            Manually correct <strong>{entry?.employee.name}</strong>'s attendance for{" "}
            <strong>{entry?.date}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="late">Late</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
                <SelectItem value="half-day">Half Day</SelectItem>
                <SelectItem value="on-leave">On Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Check-in time</Label>
              <Input type="time" value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>Check-out time</Label>
              <Input type="time" value={checkOutTime} onChange={(e) => setCheckOutTime(e.target.value)} className="mt-1.5" />
            </div>
          </div>
          <div>
            <Label>Reason / Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for override" className="mt-1.5" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={override.isPending}>
            {override.isPending ? "Saving…" : "Save Override"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Correction review dialog ────────────────────────────────────────────────

function ReviewDialog({ entry, open, onClose }: OverrideDialogProps) {
  const review = useReviewCorrection();
  const { toast } = useToast();
  const [notes, setNotes] = useState("");

  const handleAction = async (action: "approve" | "reject") => {
    if (!entry?.recordId) return;
    try {
      await review.mutateAsync({ recordId: entry.recordId, payload: { action, notes } });
      toast({
        title: action === "approve" ? "Request approved" : "Request rejected",
        description: `${entry.employee.name}'s correction request has been ${action}d.`,
      });
      onClose();
      setNotes("");
    } catch (e) {
      toast({ title: "Action failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  const req = entry?.correctionRequest;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Review Correction Request</DialogTitle>
          <DialogDescription>
            Review the requested changes for <strong>{entry?.employee.name}</strong> on{" "}
            <strong>{entry?.date}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1 text-sm">
          <div className="rounded-lg border border-border p-3 bg-muted/30">
            <p className="text-xs text-muted-foreground">Requested Check-in</p>
            <p className="font-semibold text-foreground">
              {req?.requestedCheckInTime ? new Date(req.requestedCheckInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-border p-3 bg-muted/30">
            <p className="text-xs text-muted-foreground">Requested Check-out</p>
            <p className="font-semibold text-foreground">
              {req?.requestedCheckOutTime ? new Date(req.requestedCheckOutTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
            </p>
          </div>
          {req?.reason ? (
            <div className="rounded-lg border border-border p-3 bg-muted/30">
              <p className="text-xs text-muted-foreground">Reason</p>
              <p className="text-foreground">{req.reason}</p>
            </div>
          ) : null}
          <div>
            <Label>Reviewer Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1.5" placeholder="Add a note for the employee" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleAction("reject")} disabled={review.isPending}>
            Reject
          </Button>
          <Button onClick={() => handleAction("approve")} disabled={review.isPending}>
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type StatusFilter = "all" | "present" | "late" | "absent" | "half-day" | "on-leave" | "weekend";

const ManagerAttendance = () => {
  const [date, setDate] = useState(todayStr());
  const selectedDate = useMemo(() => new Date(date + "T00:00:00"), [date]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [overrideEntry, setOverrideEntry] = useState<LiveBoardEntry | null>(null);
  const [reviewEntry, setReviewEntry] = useState<LiveBoardEntry | null>(null);

  const { data: board = [], isLoading, refetch, isFetching } = useLiveBoard(date);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return board.filter((entry) => {
      if (statusFilter !== "all" && entry.status !== statusFilter) return false;
      if (q) {
        const hay = `${entry.employee.name} ${entry.employee.employeeId} ${entry.employee.department}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [board, search, statusFilter]);

  const stats = useMemo(() => ({
    total:   board.length,
    present: board.filter(e => e.status === "present" || e.status === "late").length,
    absent:  board.filter(e => e.status === "absent").length,
    late:    board.filter(e => e.status === "late").length,
    onLeave: board.filter(e => e.status === "on-leave").length,
  }), [board]);

  const summaryCards = [
    { label: "Total Employees", value: stats.total,   icon: Users,         color: "text-primary",      bg: "bg-accent"      },
    { label: "Present Today",   value: stats.present, icon: CheckCircle2,  color: "text-emerald-600",  bg: "bg-emerald-50"  },
    { label: "Absent",          value: stats.absent,  icon: AlertCircle,   color: "text-red-600",      bg: "bg-red-50"      },
    { label: "Late Arrivals",   value: stats.late,    icon: Clock,         color: "text-amber-600",    bg: "bg-amber-50"    },
    { label: "On Leave",        value: stats.onLeave, icon: TrendingUp,    color: "text-purple-600",   bg: "bg-purple-50"   },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/5 via-background to-background p-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Attendance Board</h1>
            <p className="text-sm text-muted-foreground mt-1">Monitor daily check-ins and corrections in real time.</p>
          </div>
          <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2 rounded-xl">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                {selectedDate.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="p-0 w-auto">
              <div className="rounded-xl border border-border bg-card p-3 shadow-lg">
                <div className="text-xs font-semibold text-muted-foreground mb-2">Select date</div>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => {
                    if (!d) return;
                    setDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
                  }}
                  disabled={{ after: new Date() }}
                  className="rounded-xl border border-border bg-background"
                />
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {summaryCards.map((card) => (
          <div key={card.label} className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3 shadow-sm">
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", card.bg)}>
              <card.icon className={cn("h-4 w-4", card.color)} />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground leading-none mb-1">{card.label}</p>
              <p className="text-xl font-bold text-foreground">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2 flex-1 min-w-48 max-w-sm">
            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, ID, department…"
              className="bg-transparent text-sm outline-none w-full text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {(["all", "present", "late", "absent", "half-day", "on-leave", "weekend"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold transition-colors capitalize",
                  statusFilter === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {s === "all" ? "All" : STATUS_META[s]?.label}
                {s !== "all" && (
                  <span className="ml-1 opacity-70">
                    ({board.filter((e) => e.status === s).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Table ── */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                {["Employee", "Department", "Check In", "Check Out", "Hours", "Status", ""].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                    Loading attendance data…
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                    No records match your filters.
                  </td>
                </tr>
              )}
              {filtered.map((entry) => {
                const meta = STATUS_META[entry.status] || STATUS_META.absent;
                const initials = entry.employee.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
                return (
                  <tr
                    key={entry.employee._id}
                    className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                          {initials}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{entry.employee.name}</p>
                          <p className="text-xs text-muted-foreground">{entry.employee.employeeId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">
                      {entry.employee.department || "—"}
                    </td>
                    <td className="px-5 py-3 text-sm text-foreground font-medium">
                      {fmt(entry.checkInTime)}
                    </td>
                    <td className="px-5 py-3 text-sm text-foreground font-medium">
                      {fmt(entry.checkOutTime)}
                    </td>
                    <td className="px-5 py-3 text-sm text-foreground">
                      {fmtHours(entry.workHours)}
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full", meta.bg, meta.color)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                        {meta.label}
                      </span>
                      {entry.correctionRequest?.status === "pending" && (
                        <span className="ml-2 inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                          Edit requested
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {entry.correctionRequest?.status === "pending" && (
                          <Button size="sm" variant="outline" onClick={() => setReviewEntry(entry)}>
                            Review
                          </Button>
                        )}
                        <button
                          onClick={() => setOverrideEntry(entry)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Override attendance"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-border text-xs text-muted-foreground">
          Showing {filtered.length} of {board.length} employees · Auto-refreshes every 30s
        </div>
      </div>

      <OverrideDialog
        entry={overrideEntry}
        open={Boolean(overrideEntry)}
        onClose={() => setOverrideEntry(null)}
      />
      <ReviewDialog
        entry={reviewEntry}
        open={Boolean(reviewEntry)}
        onClose={() => setReviewEntry(null)}
      />
    </div>
  );
};

export default ManagerAttendance;
