import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  CalendarCheck,
  ShieldCheck,
  Users,
  Bell,
  ClipboardList,
  Lock,
  ArrowRight,
  Building2,
  KeyRound,
  Mail,
} from "lucide-react";
import conferenceRoom from "@/assets/conference-room.jpg";
import boardroom from "@/assets/boardroom.jpg";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground font-bold">
              M
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide">MEETING ROOMS</div>
              <div className="text-xs text-muted-foreground">Room Booking Platform</div>
            </div>
          </div>
          <Button onClick={() => navigate("/login")} className="gap-2">
            Sign in <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-15"
          style={{ backgroundImage: `url(${conferenceRoom})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/80 to-[#f4f6f9]" />
        <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <Building2 className="h-3.5 w-3.5" /> Enterprise meeting management
            </span>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight md:text-5xl">
              Book rooms, track attendance, and manage leave — all in one place.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              A unified workspace for employees and managers to schedule meetings, confirm
              occupancy, and run day-to-day people operations without juggling tools.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" onClick={() => navigate("/login")} className="gap-2">
                Get started <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  const el = document.getElementById("how-it-works");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                How it works
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Why this app */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-10">
          <h2 className="text-3xl font-bold tracking-tight">Why teams use it</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Spreadsheets and shared calendars break down quickly when dozens of people compete
            for the same rooms. This platform was built to remove that friction with rules,
            visibility, and accountability baked in.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard
            icon={<CalendarCheck className="h-5 w-5" />}
            title="No double bookings"
            body="Fixed 30-minute slots, conflict detection, and a unique index in the database make overlapping reservations impossible."
          />
          <FeatureCard
            icon={<Users className="h-5 w-5" />}
            title="Role-based access"
            body="Employees book rooms and manage their own time. Managers see everything, approve leave, and create rooms."
          />
          <FeatureCard
            icon={<Bell className="h-5 w-5" />}
            title="Email + in-app notifications"
            body="Every booking, invite, cancellation, and approval triggers a confirmation so nothing falls through the cracks."
          />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
            <p className="mt-2 text-muted-foreground">
              Three primary modules covering the most common workplace operations.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <StepCard
              step="1"
              icon={<CalendarCheck className="h-5 w-5" />}
              title="Meeting room booking"
              points={[
                "Browse available rooms by branch, capacity, and time",
                "Reserve a 30-minute slot or chain consecutive slots",
                "Confirm occupancy at the room with a one-time code",
                "Auto-cancel no-shows so rooms free up automatically",
              ]}
            />
            <StepCard
              step="2"
              icon={<ClipboardList className="h-5 w-5" />}
              title="Attendance"
              points={[
                "Daily check-in and check-out from any device",
                "Personal history with hours worked per day",
                "Manager dashboard with team-wide visibility",
              ]}
            />
            <StepCard
              step="3"
              icon={<Mail className="h-5 w-5" />}
              title="Leave management"
              points={[
                "Apply for leave with type, dates, and reason",
                "Track remaining balance per leave category",
                "Manager approval workflow with email confirmation",
              ]}
            />
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
            <img
              src={boardroom}
              alt="Boardroom"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 to-transparent" />
          </div>
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" /> Built with security in mind
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              Your data, protected at every layer
            </h2>
            <ul className="mt-6 space-y-4 text-sm">
              <SecurityItem
                icon={<Lock className="h-4 w-4" />}
                title="JWT authentication"
                body="Every protected request carries a signed JSON Web Token. Tokens expire automatically and never leave the user's browser unencrypted."
              />
              <SecurityItem
                icon={<KeyRound className="h-4 w-4" />}
                title="Hashed passwords"
                body="Passwords are stored with bcrypt salting — even a database leak doesn't expose the original credentials."
              />
              <SecurityItem
                icon={<ShieldCheck className="h-4 w-4" />}
                title="Strict CORS + Helmet"
                body="The API only accepts requests from whitelisted frontend origins, and standard security headers are enforced via Helmet."
              />
              <SecurityItem
                icon={<Users className="h-4 w-4" />}
                title="Role-based authorization"
                body="Manager-only endpoints (room creation, leave approval) check the role on every request — not just in the UI."
              />
            </ul>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-14 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">Ready to get started?</h2>
            <p className="mt-1 text-primary-foreground/80">
              Sign in with your work account to book your first room.
            </p>
          </div>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => navigate("/login")}
            className="gap-2"
          >
            Sign in <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      <footer className="border-t border-border/60 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-sm text-muted-foreground md:flex-row">
          <div>© {new Date().getFullYear()} Meeting Room Platform</div>
          <div>Built with React, Node.js, and MongoDB</div>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) => (
  <div className="rounded-xl border border-border/60 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
    <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
      {icon}
    </div>
    <h3 className="text-lg font-semibold">{title}</h3>
    <p className="mt-2 text-sm text-muted-foreground">{body}</p>
  </div>
);

const StepCard = ({
  step,
  icon,
  title,
  points,
}: {
  step: string;
  icon: React.ReactNode;
  title: string;
  points: string[];
}) => (
  <div className="rounded-xl border border-border/60 bg-[#f8fafc] p-6">
    <div className="mb-4 flex items-center gap-3">
      <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {step}
      </div>
      <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white text-primary">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
    </div>
    <ul className="space-y-2 text-sm text-muted-foreground">
      {points.map((p) => (
        <li key={p} className="flex gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <span>{p}</span>
        </li>
      ))}
    </ul>
  </div>
);

const SecurityItem = ({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) => (
  <li className="flex gap-3">
    <div className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
      {icon}
    </div>
    <div>
      <div className="font-semibold">{title}</div>
      <div className="text-muted-foreground">{body}</div>
    </div>
  </li>
);

export default Landing;
