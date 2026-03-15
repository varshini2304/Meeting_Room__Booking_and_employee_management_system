import { useMemo, useState } from "react";
import { useUsers } from "@/hooks/queries/useUsers";
import { useAllLeaves, useEmployeeBalance } from "@/hooks/queries/useLeaves";
import { CalendarDays, Heart, Umbrella, Clock, Baby, Droplet, MapPin, Users, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { LeaveBalance, LeaveRequest, LeaveStatus, LeaveType } from "@/api/leaves";

const LEAVE_META: Record<LeaveType, { label: string; dot: string; icon: React.ElementType }> = {
  casual:     { label: "Casual",       dot: "bg-sky-500",     icon: Umbrella },
  sick:       { label: "Sick",         dot: "bg-rose-500",    icon: Heart },
  earned:     { label: "Earned (EL)",  dot: "bg-emerald-500", icon: CalendarDays },
  menstrual:  { label: "Menstrual",    dot: "bg-fuchsia-500", icon: Droplet },
  relocation: { label: "Relocation",   dot: "bg-amber-500",   icon: MapPin },
  unpaid:     { label: "Unpaid",       dot: "bg-zinc-400",    icon: Clock },
  maternity:  { label: "Maternity",    dot: "bg-purple-500",  icon: Baby },
  paternity:  { label: "Paternity",    dot: "bg-indigo-500",  icon: Baby },
};

const leaveTypes = Object.keys(LEAVE_META) as LeaveType[];

const STATUS_META: Record<LeaveStatus, { label: string; color: string; bg: string }> = {
  pending:   { label: "Pending",   color: "text-amber-700",   bg: "bg-amber-50" },
  approved:  { label: "Approved",  color: "text-emerald-700", bg: "bg-emerald-50" },
  rejected:  { label: "Rejected",  color: "text-red-700",     bg: "bg-red-50" },
  cancelled: { label: "Cancelled", color: "text-zinc-500",    bg: "bg-zinc-100" },
};

function BalanceRow({
  userId,
  name,
  employeeId,
  department,
  gender,
  year,
  onOpen,
}: {
  userId: string;
  name: string;
  employeeId?: string;
  department?: string;
  gender?: "female" | "male" | "other" | "unspecified";
  year: number;
  onOpen: () => void;
}) {
  const { data: balance } = useEmployeeBalance(userId, year);

  const totals = useMemo(() => {
    if (!balance) return { used: 0, total: 0 };
    let used = 0;
    let total = 0;
    for (const t of leaveTypes) {
      const q = (balance as Record<string, LeaveBalance[LeaveType]>)[t];
      if (!q) continue;
      used += q.used;
      total += q.total >= 999 ? 0 : q.total;
    }
    return { used, total };
  }, [balance]);

  const visibleTypes = useMemo(() => {
    if (gender === "female") return leaveTypes.filter((t) => t !== "paternity");
    if (gender === "male") return leaveTypes.filter((t) => t !== "menstrual" && t !== "maternity");
    return leaveTypes.filter((t) => t !== "menstrual" && t !== "maternity" && t !== "paternity");
  }, [gender]);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group border border-border/70 rounded-2xl p-4 bg-card text-left hover:shadow-md hover:-translate-y-0.5 transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">
            {employeeId ? `${employeeId} · ` : ""}{department || "—"}
          </p>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full bg-muted/60 border border-border/60">
            {gender && gender !== "unspecified" ? gender : "unspecified"}
          </span>
          <span>Used {totals.used} / {totals.total || "—"}</span>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-blue-500 transition-all"
          style={{ width: `${totals.total ? Math.min(100, Math.round((totals.used / totals.total) * 100)) : 0}%` }}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-3">
        {visibleTypes.map((t) => {
          const q = (balance as Record<string, LeaveBalance[LeaveType]> | undefined)?.[t];
          const Icon = LEAVE_META[t].icon;
          return (
            <div key={t} className="rounded-xl border border-border/70 p-2.5 flex items-center gap-2 bg-background/60 group-hover:bg-background transition-colors">
              <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center", "bg-muted/50")}>
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">{LEAVE_META[t].label}</p>
                <p className="text-xs font-semibold text-foreground">
                  {q ? `${q.used} / ${q.total >= 999 ? "∞" : q.total}` : "—"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </button>
  );
}

const ManagerLeaveBalances = () => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const { data: users = [], isLoading } = useUsers();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{
    id: string;
    name: string;
    employeeId?: string;
    department?: string;
    gender?: "female" | "male" | "other" | "unspecified";
  } | null>(null);
  const { data: selectedLeaves = [], isLoading: isLeavesLoading } = useAllLeaves(
    selected ? { employeeId: selected.id } : undefined,
    Boolean(selected)
  );

  const leavesByType = useMemo(() => {
    const map: Record<string, LeaveRequest[]> = {};
    for (const l of selectedLeaves) {
      if (!map[l.leaveType]) map[l.leaveType] = [];
      map[l.leaveType].push(l);
    }
    return map;
  }, [selectedLeaves]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      `${u.name} ${u.employeeId || ""} ${u.department || ""}`.toLowerCase().includes(q)
    );
  }, [users, query]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/5 via-background to-background p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
              <Sparkles className="h-3.5 w-3.5" />
              Leave Analytics
            </div>
            <h1 className="text-2xl font-bold text-foreground mt-2">Leave Balances</h1>
            <p className="text-sm text-muted-foreground">Review leave usage by employee for payroll decisions.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 border border-border rounded-xl px-3 py-2 bg-card">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{users.length} employees</span>
            </div>
            <select
              className="border border-border rounded-xl px-3 py-2 text-sm bg-card"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {[year - 1, year, year + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 max-w-md">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search employee name, ID, department…"
            className="bg-transparent text-sm outline-none w-full text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {isLoading && (
          <div className="text-sm text-muted-foreground">Loading employees…</div>
        )}
        {!isLoading && filteredUsers.length === 0 && (
          <div className="text-sm text-muted-foreground">No employees found.</div>
        )}
        {filteredUsers.map((u) => (
          <BalanceRow
            key={u._id}
            userId={u._id}
            name={u.name}
            employeeId={u.employeeId}
            department={u.department}
            gender={u.gender}
            year={year}
            onOpen={() =>
              setSelected({
                id: u._id,
                name: u.name,
                employeeId: u.employeeId,
                department: u.department,
                gender: u.gender,
              })
            }
          />
        ))}
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Leave Usage Details</DialogTitle>
            <DialogDescription>
              {selected ? `${selected.name}${selected.employeeId ? ` · ${selected.employeeId}` : ""}${selected.department ? ` · ${selected.department}` : ""}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {isLeavesLoading && (
              <div className="text-sm text-muted-foreground">Loading leave history…</div>
            )}
            {!isLeavesLoading && selectedLeaves.length === 0 && (
              <div className="text-sm text-muted-foreground">No leaves found for this employee.</div>
            )}
            {!isLeavesLoading && selectedLeaves.length > 0 && (
              <div className="space-y-4">
                {leaveTypes
                  .filter((t) => {
                    if (selected?.gender === "female") return t !== "paternity";
                    if (selected?.gender === "male") return t !== "menstrual" && t !== "maternity";
                    return t !== "menstrual" && t !== "maternity" && t !== "paternity";
                  })
                  .map((t) => {
                  const list = leavesByType[t] || [];
                  if (list.length === 0) return null;
                  const meta = LEAVE_META[t];
                  const Icon = meta.icon;
                  return (
                    <div key={t} className="border border-border rounded-xl p-4 bg-card">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-7 w-7 rounded-lg bg-muted/50 flex items-center justify-center">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <h3 className="text-sm font-semibold text-foreground">{meta.label}</h3>
                        <span className="text-xs text-muted-foreground">({list.length})</span>
                      </div>
                      <div className="space-y-2">
                        {list.map((l) => {
                          const st = STATUS_META[l.status];
                          return (
                            <div key={l._id} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2 bg-background/60">
                              <div>
                                <p className="text-sm text-foreground font-medium">
                                  {l.startDate} → {l.endDate} · {l.totalDays} day{l.totalDays !== 1 ? "s" : ""}
                                </p>
                                {l.reason && (
                                  <p className="text-xs text-muted-foreground truncate max-w-md">"{l.reason}"</p>
                                )}
                              </div>
                              <span className={cn("text-xs font-semibold px-2 py-1 rounded-full", st.bg, st.color)}>
                                {st.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagerLeaveBalances;
