import { useMemo, useState } from "react";
import { useAllLeaves, useApproveLeave, useRejectLeave, useTeamCalendar } from "@/hooks/queries/useLeaves";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { CalendarDays, Check, X, Clock, Users, ChevronLeft, ChevronRight, Search, Umbrella, Heart, Baby, TrendingUp, Droplet, MapPin } from "lucide-react";
import type { LeaveRequest, LeaveType, LeaveStatus } from "@/api/leaves";

// ─── Constants ────────────────────────────────────────────────────────────────

const LEAVE_META: Record<LeaveType, { label: string; color: string; bg: string; border: string; dot: string; icon: React.ElementType }> = {
  casual:     { label: "Casual",     color: "text-sky-700",     bg: "bg-sky-50",     border: "border-sky-200",     dot: "bg-sky-500",     icon: Umbrella },
  sick:       { label: "Sick",       color: "text-rose-700",    bg: "bg-rose-50",    border: "border-rose-200",    dot: "bg-rose-500",    icon: Heart    },
  earned:     { label: "Earned (EL)",color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500", icon: CalendarDays },
  menstrual:  { label: "Menstrual",  color: "text-fuchsia-700", bg: "bg-fuchsia-50", border: "border-fuchsia-200", dot: "bg-fuchsia-500", icon: Droplet },
  relocation: { label: "Relocation", color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   dot: "bg-amber-500",   icon: MapPin  },
  unpaid:     { label: "Unpaid",     color: "text-zinc-600",    bg: "bg-zinc-50",    border: "border-zinc-200",    dot: "bg-zinc-400",    icon: Clock    },
  maternity:  { label: "Maternity",  color: "text-purple-700",  bg: "bg-purple-50",  border: "border-purple-200",  dot: "bg-purple-500",  icon: Baby     },
  paternity:  { label: "Paternity",  color: "text-indigo-700",  bg: "bg-indigo-50",  border: "border-indigo-200",  dot: "bg-indigo-500",  icon: Baby     },
};

const STATUS_META: Record<LeaveStatus, { label: string; color: string; bg: string }> = {
  pending:   { label: "Pending",   color: "text-amber-700",   bg: "bg-amber-50"   },
  approved:  { label: "Approved",  color: "text-emerald-700", bg: "bg-emerald-50" },
  rejected:  { label: "Rejected",  color: "text-red-700",     bg: "bg-red-50"     },
  cancelled: { label: "Cancelled", color: "text-zinc-500",    bg: "bg-zinc-100"   },
};

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });

const getEmployee = (leave: LeaveRequest) => {
  if (typeof leave.employeeId === "object" && leave.employeeId !== null) return leave.employeeId as { _id: string; name: string; email: string; employeeId: string; department?: string };
  return null;
};

// ─── Action Dialog ────────────────────────────────────────────────────────────

function ActionDialog({
  leave,
  action,
  onClose,
}: {
  leave: LeaveRequest | null;
  action: "approve" | "reject" | null;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState("");
  const approve = useApproveLeave();
  const reject  = useRejectLeave();
  const { toast } = useToast();

  if (!leave || !action) return null;

  const emp  = getEmployee(leave);
  const meta = LEAVE_META[leave.leaveType];
  const Icon = meta.icon;
  const isReject = action === "reject";

  const handleSubmit = async () => {
    if (isReject && !notes.trim()) {
      toast({ title: "Rejection reason required", description: "You must provide a reason when rejecting a leave request.", variant: "destructive" });
      return;
    }
    try {
      if (isReject) {
        await reject.mutateAsync({ id: leave._id, notes });
        toast({ title: "Leave rejected", description: `${emp?.name || "Employee"}'s request has been rejected.` });
      } else {
        await approve.mutateAsync({ id: leave._id, notes });
        toast({ title: "Leave approved ✓", description: `${emp?.name || "Employee"}'s leave has been approved.` });
      }
      onClose();
      setNotes("");
    } catch (e) {
      toast({ title: "Action failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  const isPending = approve.isPending || reject.isPending;

  return (
    <Dialog open={Boolean(leave && action)} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isReject ? "Reject Leave Request" : "Approve Leave Request"}</DialogTitle>
          <DialogDescription>
            {isReject
              ? "This will notify the employee and release their pending balance."
              : "This will approve the leave and mark attendance days as on-leave."}
          </DialogDescription>
        </DialogHeader>

        {/* Leave summary */}
        <div className={cn("rounded-xl border p-4 space-y-2", meta.bg, meta.border)}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/70 flex items-center justify-center">
              <Icon className={cn("h-3.5 w-3.5", meta.color)} />
            </div>
            <div>
              <p className={cn("text-sm font-bold", meta.color)}>{emp?.name || "Employee"}</p>
              <p className="text-xs text-muted-foreground">{emp?.department || emp?.email || ""}</p>
            </div>
          </div>
          <div className="text-sm text-foreground">
            <span className="font-semibold">{meta.label} leave</span> · {formatDate(leave.startDate)} – {formatDate(leave.endDate)} · {leave.totalDays} day{leave.totalDays !== 1 ? "s" : ""}
          </div>
          {leave.reason && (
            <p className="text-xs text-muted-foreground italic">"{leave.reason}"</p>
          )}
        </div>

        <div>
          <Label className="text-sm font-semibold">{isReject ? "Rejection Reason *" : "Note (optional)"}</Label>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={isReject ? "Explain why this request is being rejected…" : "Add an optional note for the employee…"}
            className="mt-1.5 min-h-20 resize-none"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            className={isReject ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : ""}
          >
            {isPending ? "Processing…" : isReject ? "Reject Request" : "Approve Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Leave Request Card ───────────────────────────────────────────────────────

function LeaveCard({
  leave,
  onAction,
}: {
  leave: LeaveRequest;
  onAction: (leave: LeaveRequest, action: "approve" | "reject") => void;
}) {
  const emp      = getEmployee(leave);
  const typeMeta = LEAVE_META[leave.leaveType];
  const stMeta   = STATUS_META[leave.status];
  const Icon     = typeMeta.icon;
  const initials = emp?.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?";

  return (
    <div className="flex flex-col sm:flex-row gap-4 px-6 py-4 hover:bg-muted/20 transition-colors border-b border-border last:border-0">
      {/* Employee avatar */}
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{emp?.name || "Employee"}</span>
            <span className="text-xs text-muted-foreground">{emp?.department || ""}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold", typeMeta.bg, typeMeta.color)}>
              <Icon className="h-3 w-3" />
              {typeMeta.label}
            </div>
            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", stMeta.bg, stMeta.color)}>
              {stMeta.label}
            </span>
            {leave.isHalfDay && <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">Half day</span>}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDate(leave.startDate)} → {formatDate(leave.endDate)} · <span className="font-medium">{leave.totalDays} day{leave.totalDays !== 1 ? "s" : ""}</span>
          </p>
          {leave.reason && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-md italic">"{leave.reason}"</p>
          )}
          {leave.reviewNotes && leave.status !== "pending" && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-md">↳ {leave.reviewNotes}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      {leave.status === "pending" && (
        <div className="flex items-center gap-2 flex-shrink-0 sm:self-center">
          <button
            onClick={() => onAction(leave, "approve")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
          >
            <Check className="h-3.5 w-3.5" /> Approve
          </button>
          <button
            onClick={() => onAction(leave, "reject")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
          >
            <X className="h-3.5 w-3.5" /> Reject
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Team Calendar ────────────────────────────────────────────────────────────

function ManagerCalendar({ month, year }: { month: number; year: number }) {
  const { data: entries = [] } = useTeamCalendar(month, year);

  const cells = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const last  = new Date(year, month, 0);
    const arr: (null | { day: number; date: string })[] = [];
    for (let i = 0; i < first.getDay(); i++) arr.push(null);
    for (let d = 1; d <= last.getDate(); d++) {
      arr.push({ day: d, date: `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}` });
    }
    return arr;
  }, [month, year]);

  const byDate = useMemo(() => {
    const map: Record<string, { name: string; type: LeaveType }[]> = {};
    for (const e of entries) {
      const emp = e.employeeId as { name: string };
      const s = new Date(e.startDate + "T00:00:00"), en = new Date(e.endDate + "T00:00:00");
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
      <div className="grid grid-cols-7 gap-1 mb-1">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) =>
          cell === null ? <div key={`p${i}`} /> : (
            <div key={cell.date} className="relative group">
              <div className={cn(
                "aspect-square rounded-md flex flex-col items-center justify-center gap-0.5 cursor-default",
                byDate[cell.date]?.length ? "bg-primary/8" : "hover:bg-muted/30 transition-colors"
              )}>
                <span className="text-[10px] font-medium text-foreground">{cell.day}</span>
                {byDate[cell.date]?.slice(0, 3).map((l, li) => (
                  <span key={li} className={cn("h-1 w-1 rounded-full", LEAVE_META[l.type]?.dot || "bg-muted")} />
                ))}
              </div>
              {byDate[cell.date]?.length ? (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-20 bg-popover border border-border rounded-lg px-2 py-1.5 shadow-lg hidden group-hover:block w-40 pointer-events-none">
                  {byDate[cell.date].map((l, li) => (
                    <div key={li} className="flex items-center gap-1.5 text-xs">
                      <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", LEAVE_META[l.type]?.dot)} />
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

// ─── Page ─────────────────────────────────────────────────────────────────────

type TabFilter = "all" | LeaveStatus;

const ManagerLeaves = () => {
  const now = new Date();
  const [tab, setTab]               = useState<TabFilter>("pending");
  const [search, setSearch]         = useState("");
  const [actionLeave, setActionLeave] = useState<LeaveRequest | null>(null);
  const [actionType, setActionType]  = useState<"approve" | "reject" | null>(null);
  const [calMonth, setCalMonth]      = useState(now.getMonth() + 1);
  const [calYear, setCalYear]        = useState(now.getFullYear());

  const { data: leaves = [], isLoading } = useAllLeaves({});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leaves.filter((l) => {
      if (tab !== "all" && l.status !== tab) return false;
      if (!q) return true;
      const emp = getEmployee(l);
      return `${emp?.name || ""} ${emp?.employeeId || ""} ${emp?.department || ""}`.toLowerCase().includes(q);
    });
  }, [leaves, search, tab]);

  const counts = useMemo(() => ({
    all:       leaves.length,
    pending:   leaves.filter(l => l.status === "pending").length,
    approved:  leaves.filter(l => l.status === "approved").length,
    rejected:  leaves.filter(l => l.status === "rejected").length,
    cancelled: leaves.filter(l => l.status === "cancelled").length,
  }), [leaves]);

  // Summary stats (current filter)
  const stats = useMemo(() => ({
    total:    leaves.length,
    days:     leaves.reduce((s, l) => s + l.totalDays, 0),
    employees:new Set(leaves.map(l => { const e = getEmployee(l); return e?._id || String(l.employeeId); })).size,
  }), [leaves]);

  const onAction = (leave: LeaveRequest, act: "approve" | "reject") => {
    setActionLeave(leave);
    setActionType(act);
  };

  const prevMonth = () => { if (calMonth === 1) { setCalMonth(12); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); };
  const nextMonth = () => { if (calMonth === 12) { setCalMonth(1);  setCalYear(y => y + 1); } else setCalMonth(m => m + 1); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leave Requests</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Review and action your team's leave applications</p>
        </div>
        {counts.pending > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-2">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-semibold">{counts.pending} pending review</span>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Requests", value: stats.total,     icon: CalendarDays, color: "text-primary",    bg: "bg-primary/8"    },
          { label: "Total days", value: stats.days,    icon: TrendingUp,   color: "text-sky-600",    bg: "bg-sky-50"       },
          { label: "Employees", value: stats.employees, icon: Users,       color: "text-purple-600", bg: "bg-purple-50"   },
        ].map(c => (
          <div key={c.label} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", c.bg)}>
              <c.icon className={cn("h-4 w-4", c.color)} />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">{c.label}</p>
              <p className="text-xl font-bold text-foreground">{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Requests panel */}
        <div className="xl:col-span-2 bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 py-3 border-b border-border space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              {(["pending","all","approved","rejected","cancelled"] as TabFilter[]).map(t => {
                const cnt = t === "all" ? counts.all : counts[t as LeaveStatus];
                return (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize",
                      tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60"
                    )}
                  >
                    {t === "all" ? "All" : STATUS_META[t as LeaveStatus].label}
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", tab === t ? "bg-white/20" : "bg-muted")}>
                      {cnt}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search employee name, ID, department…"
                className="bg-transparent text-sm outline-none w-full text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* List */}
          <div>
            {isLoading && (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading leave requests…</div>
            )}
            {!isLoading && filtered.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground">No leave requests match your filters.</div>
            )}
            {filtered.map(leave => (
              <LeaveCard key={leave._id} leave={leave} onAction={onAction} />
            ))}
          </div>
        </div>

        {/* Team calendar */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground text-sm">Team On Leave</h2>
            <div className="flex items-center gap-1">
              <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-muted/60 text-muted-foreground"><ChevronLeft className="h-3.5 w-3.5" /></button>
              <span className="text-xs font-medium w-24 text-center text-foreground">{MONTH_NAMES[calMonth-1].slice(0,3)} {calYear}</span>
              <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-muted/60 text-muted-foreground"><ChevronRight className="h-3.5 w-3.5" /></button>
            </div>
          </div>
          <ManagerCalendar month={calMonth} year={calYear} />
          <div className="mt-4 pt-3 border-t border-border grid grid-cols-2 gap-x-2 gap-y-1.5">
            {(Object.keys(LEAVE_META) as LeaveType[]).map(t => (
              <div key={t} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", LEAVE_META[t].dot)} />
                {LEAVE_META[t].label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <ActionDialog
        leave={actionLeave}
        action={actionType}
        onClose={() => { setActionLeave(null); setActionType(null); }}
      />
    </div>
  );
};

export default ManagerLeaves;
