import { useMemo, useState } from "react";
import { useApplyLeave, useCancelLeave, useMyBalance, useMyLeaves, useTeamCalendar } from "@/hooks/queries/useLeaves";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { CalendarDays, Clock, TrendingUp, Umbrella, Heart, Baby, Plus, X, ChevronLeft, ChevronRight, Droplet, MapPin } from "lucide-react";
import type { LeaveType, LeaveStatus } from "@/api/leaves";

// ─── Constants ────────────────────────────────────────────────────────────────

const LEAVE_META: Record<LeaveType, { label: string; color: string; bg: string; border: string; dot: string; icon: React.ElementType; defaultDays: number }> = {
  casual:     { label: "Casual",     color: "text-sky-700",     bg: "bg-sky-50",     border: "border-sky-200",     dot: "bg-sky-500",     icon: Umbrella,    defaultDays: 12 },
  sick:       { label: "Sick",       color: "text-rose-700",    bg: "bg-rose-50",    border: "border-rose-200",    dot: "bg-rose-500",    icon: Heart,       defaultDays: 10 },
  earned:     { label: "Earned (EL)",color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500", icon: CalendarDays, defaultDays: 12 },
  menstrual:  { label: "Menstrual",  color: "text-fuchsia-700", bg: "bg-fuchsia-50", border: "border-fuchsia-200", dot: "bg-fuchsia-500", icon: Droplet,     defaultDays: 12 },
  relocation: { label: "Relocation", color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   dot: "bg-amber-500",   icon: MapPin,      defaultDays: 5  },
  unpaid:     { label: "Unpaid",     color: "text-zinc-600",    bg: "bg-zinc-50",    border: "border-zinc-200",    dot: "bg-zinc-400",    icon: Clock,       defaultDays: 0  },
  maternity:  { label: "Maternity",  color: "text-purple-700",  bg: "bg-purple-50",  border: "border-purple-200",  dot: "bg-purple-500",  icon: Baby,        defaultDays: 90 },
  paternity:  { label: "Paternity",  color: "text-indigo-700",  bg: "bg-indigo-50",  border: "border-indigo-200",  dot: "bg-indigo-500",  icon: Baby,        defaultDays: 15 },
};

const STATUS_META: Record<LeaveStatus, { label: string; color: string; bg: string }> = {
  pending:   { label: "Pending",   color: "text-amber-700",   bg: "bg-amber-50"   },
  approved:  { label: "Approved",  color: "text-emerald-700", bg: "bg-emerald-50" },
  rejected:  { label: "Rejected",  color: "text-red-700",     bg: "bg-red-50"     },
  cancelled: { label: "Cancelled", color: "text-zinc-500",    bg: "bg-zinc-100"   },
};

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const LEAVE_TYPES = Object.keys(LEAVE_META) as LeaveType[];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

const daysBetween = (start: string, end: string) => {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end   + "T00:00:00");
  let days = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) days++;
    cur.setDate(cur.getDate() + 1);
  }
  return days;
};

// ─── Balance Progress Card ────────────────────────────────────────────────────

function BalanceCard({ type, quota }: { type: LeaveType; quota: { total: number; used: number; pending: number; remaining: number } }) {
  const meta = LEAVE_META[type];
  const Icon = meta.icon;
  const pct = quota.total > 0 && quota.total < 999
    ? Math.round(((quota.used + quota.pending) / quota.total) * 100)
    : 0;
  const isUnlimited = quota.total >= 999;

  return (
    <div className={cn("rounded-2xl border p-4 flex flex-col gap-3 transition-all hover:shadow-sm", meta.bg, meta.border)}>
      <div className="flex items-start justify-between">
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", "bg-white/70")}>
          <Icon className={cn("h-4 w-4", meta.color)} />
        </div>
        <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full bg-white/70", meta.color)}>
          {isUnlimited ? "Unlimited" : `${quota.remaining} left`}
        </span>
      </div>
      <div>
        <p className={cn("text-sm font-bold", meta.color)}>{meta.label}</p>
        {!isUnlimited && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {quota.used} used · {quota.pending} pending · {quota.total} total
          </p>
        )}
      </div>
      {!isUnlimited && (
        <div className="h-1.5 rounded-full bg-white/60 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", meta.dot)}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Team Calendar ────────────────────────────────────────────────────────────

function TeamCalendar({ month, year }: { month: number; year: number }) {
  const { data: entries = [] } = useTeamCalendar(month, year);

  const cells = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const last  = new Date(year, month, 0);
    const pad   = first.getDay();
    const arr: (null | { day: number; date: string })[] = [];
    for (let i = 0; i < pad; i++) arr.push(null);
    for (let d = 1; d <= last.getDate(); d++) {
      const date = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      arr.push({ day: d, date });
    }
    return arr;
  }, [month, year]);

  const leaveByDate = useMemo(() => {
    const map: Record<string, { name: string; type: LeaveType }[]> = {};
    for (const e of entries) {
      const emp = e.employeeId as { name: string };
      const s = new Date(e.startDate + "T00:00:00");
      const en = new Date(e.endDate   + "T00:00:00");
      const cur = new Date(s);
      while (cur <= en) {
        const key = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}-${String(cur.getDate()).padStart(2,"0")}`;
        if (!map[key]) map[key] = [];
        map[key].push({ name: emp?.name || "?", type: e.leaveType });
        cur.setDate(cur.getDate() + 1);
      }
    }
    return map;
  }, [entries]);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
          <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) =>
          cell === null ? <div key={`p${i}`} /> : (
            <div key={cell.date} className="aspect-square rounded-lg flex flex-col items-center justify-center relative group cursor-default">
              <div className={cn(
                "w-full h-full rounded-lg flex flex-col items-center justify-center gap-0.5",
                leaveByDate[cell.date]?.length ? "bg-primary/8" : "hover:bg-muted/40 transition-colors"
              )}>
                <span className="text-[11px] font-medium text-foreground">{cell.day}</span>
                {leaveByDate[cell.date]?.slice(0,2).map((l, li) => (
                  <span key={li} className={cn("h-1 w-1 rounded-full", LEAVE_META[l.type].dot)} />
                ))}
              </div>
              {leaveByDate[cell.date]?.length ? (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-popover border border-border rounded-lg px-2 py-1.5 text-xs shadow-lg z-10 hidden group-hover:block w-36 pointer-events-none">
                  {leaveByDate[cell.date].map((l, li) => (
                    <div key={li} className="flex items-center gap-1.5">
                      <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", LEAVE_META[l.type].dot)} />
                      <span className="truncate text-foreground">{l.name}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ─── Apply Form Dialog ────────────────────────────────────────────────────────

function ApplyDialog({ open, onClose, allowedTypes }: { open: boolean; onClose: () => void; allowedTypes: LeaveType[] }) {
  const applyLeave = useApplyLeave();
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    leaveType: (allowedTypes[0] || "casual") as LeaveType,
    startDate: today,
    endDate:   today,
    reason:    "",
    isHalfDay: false,
  });

  const preview = form.startDate && form.endDate
    ? daysBetween(form.startDate, form.endDate)
    : 0;

  const set = (k: string, v: unknown) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async () => {
    if (!form.reason.trim()) {
      toast({ title: "Reason required", description: "Please describe your reason for this leave.", variant: "destructive" });
      return;
    }
    try {
      await applyLeave.mutateAsync(form);
      toast({ title: "Leave applied ✓", description: "Your request has been submitted for approval." });
      onClose();
      setForm({ leaveType: (allowedTypes[0] || "casual") as LeaveType, startDate: today, endDate: today, reason: "", isHalfDay: false });
    } catch (e) {
      toast({ title: "Application failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Apply for Leave</DialogTitle>
          <DialogDescription>Fill in the details below. Your manager will be notified immediately.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div>
            <Label className="text-sm font-semibold">Leave Type</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {allowedTypes.map(type => {
                const meta = LEAVE_META[type];
                const Icon = meta.icon;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => set("leaveType", type)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition-all",
                      form.leaveType === type
                        ? cn(meta.bg, meta.border, meta.color, "shadow-sm")
                        : "border-border text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-semibold">Start Date</Label>
              <Input type="date" value={form.startDate} min={today} onChange={e => set("startDate", e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-sm font-semibold">End Date</Label>
              <Input type="date" value={form.endDate} min={form.startDate} onChange={e => set("endDate", e.target.value)} className="mt-1.5" />
            </div>
          </div>

          {preview > 0 && (
            <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-4 py-3">
              <CalendarDays className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-sm text-foreground font-medium">
                {form.isHalfDay ? "0.5" : preview} business day{preview !== 1 && !form.isHalfDay ? "s" : ""}
              </span>
              {preview === 1 && (
                <label className="flex items-center gap-1.5 ml-auto text-xs text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={form.isHalfDay} onChange={e => set("isHalfDay", e.target.checked)} className="rounded" />
                  Half day
                </label>
              )}
            </div>
          )}

          <div>
            <Label className="text-sm font-semibold">Reason</Label>
            <Textarea
              value={form.reason}
              onChange={e => set("reason", e.target.value)}
              placeholder="Briefly describe the reason for your leave…"
              className="mt-1.5 min-h-20 resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={applyLeave.isPending || preview === 0}>
            {applyLeave.isPending ? "Submitting…" : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const MyLeaves = () => {
  const { user } = useAuth();
  const now  = new Date();
  const year = now.getFullYear();
  const [applyOpen, setApplyOpen]   = useState(false);
  const [calMonth, setCalMonth]     = useState(now.getMonth() + 1);
  const [calYear, setCalYear]       = useState(year);
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | "all">("all");

  const { data: balance } = useMyBalance(year);
  const { data: leaves = [] } = useMyLeaves(undefined, statusFilter === "all" ? undefined : statusFilter);
  const cancelLeave = useCancelLeave();
  const { toast } = useToast();
  const gender = user?.gender || "unspecified";
  const visibleLeaveTypes = useMemo(
    () =>
      LEAVE_TYPES.filter((type) => {
        if (type === "menstrual" || type === "maternity") return gender === "female";
        if (type === "paternity") return gender === "male";
        return true;
      }),
    [gender]
  );

  const filteredLeaves = useMemo(() => leaves.slice().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ), [leaves]);

  const handleCancel = async (id: string) => {
    try {
      await cancelLeave.mutateAsync(id);
      toast({ title: "Leave cancelled", description: "Your leave request has been withdrawn." });
    } catch (e) {
      toast({ title: "Cannot cancel", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  const prevMonth = () => { if (calMonth === 1) { setCalMonth(12); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); };
  const nextMonth = () => { if (calMonth === 12) { setCalMonth(1);  setCalYear(y => y + 1); } else setCalMonth(m => m + 1); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Leaves</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{year} leave summary</p>
        </div>
        <Button onClick={() => setApplyOpen(true)} className="gap-2 rounded-xl px-5">
          <Plus className="h-4 w-4" /> Apply for Leave
        </Button>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {visibleLeaveTypes.map(type => (
          <BalanceCard
            key={type}
            type={type}
            quota={balance?.[type] ?? { total: LEAVE_META[type].defaultDays, used: 0, pending: 0, remaining: LEAVE_META[type].defaultDays }}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Leave history */}
        <div className="xl:col-span-2 bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Leave History</h2>
            <div className="flex gap-1">
              {(["all", "pending", "approved", "rejected", "cancelled"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-semibold transition-colors capitalize",
                    statusFilter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60"
                  )}
                >
                  {s === "all" ? "All" : STATUS_META[s as LeaveStatus].label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-border">
            {filteredLeaves.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No leave requests yet.
              </div>
            )}
            {filteredLeaves.map(leave => {
              const typeMeta   = LEAVE_META[leave.leaveType];
              const statusMeta = STATUS_META[leave.status];
              const Icon = typeMeta.icon;
              return (
                <div key={leave._id} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/20 transition-colors">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", typeMeta.bg)}>
                    <Icon className={cn("h-4 w-4", typeMeta.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{typeMeta.label} Leave</span>
                      <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", statusMeta.bg, statusMeta.color)}>
                        {statusMeta.label}
                      </span>
                      {leave.isHalfDay && (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Half day</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(leave.startDate)} → {formatDate(leave.endDate)} · {leave.totalDays} day{leave.totalDays !== 1 ? "s" : ""}
                    </p>
                    {leave.reason && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5 max-w-xs">{leave.reason}</p>
                    )}
                    {leave.reviewNotes && leave.status === "rejected" && (
                      <p className="text-xs text-red-600 mt-0.5 truncate max-w-xs">↳ {leave.reviewNotes}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {leave.status === "pending" && (
                      <button
                        onClick={() => handleCancel(leave._id)}
                        disabled={cancelLeave.isPending}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Cancel request"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Team calendar */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Team Calendar</h2>
            <div className="flex items-center gap-1">
              <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-medium text-foreground w-28 text-center">
                {MONTH_NAMES[calMonth - 1]} {calYear}
              </span>
              <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <TeamCalendar month={calMonth} year={calYear} />
          {/* Legend */}
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-x-3 gap-y-1.5">
            {visibleLeaveTypes.map(t => (
              <div key={t} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className={cn("h-2 w-2 rounded-full flex-shrink-0", LEAVE_META[t].dot)} />
                {LEAVE_META[t].label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <ApplyDialog open={applyOpen} onClose={() => setApplyOpen(false)} allowedTypes={visibleLeaveTypes} />
    </div>
  );
};

export default MyLeaves;
