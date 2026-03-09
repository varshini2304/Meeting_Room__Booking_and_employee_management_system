import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mail, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import conferenceRoom from "@/assets/conference-room.jpg";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const user = await login(email, password);
      navigate(user.role === "manager" ? "/manager" : "/dashboard");
    } catch (error) {
      toast({
        title: "Login failed",
        description: error instanceof Error ? error.message : "Unable to login",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f4f6f9]">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-[-8%] top-[18%] h-[420px] w-[560px] rounded-3xl bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${conferenceRoom})` }}
        />
        <div
          className="absolute right-[-8%] top-[18%] h-[420px] w-[560px] rounded-3xl bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${conferenceRoom})` }}
        />
        <div className="absolute inset-0 bg-white/65 backdrop-blur-[1px]" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-5 py-10">
        <div className="w-full max-w-[660px] text-center">
          <div className="mx-auto mb-3 flex h-24 w-36 items-center justify-center rounded-[999px] border-[5px] border-slate-500/80 bg-gradient-to-b from-white to-slate-200 shadow-inner">
            <div className="rounded-[999px] border-4 border-slate-500/80 px-7 py-2">
              <span className="text-3xl font-bold tracking-tight text-slate-700">T</span>
            </div>
          </div>
          <h1 className="text-5xl font-black leading-none tracking-tight text-[#da1e27] sm:text-6xl">TOYOTA</h1>

          <p className="mb-10 mt-9 text-2xl font-semibold tracking-tight text-[#4b5563] sm:text-4xl">
            Enterprise Meeting Room Booking System
          </p>

          <div className="mx-auto max-w-[600px] rounded-3xl border border-slate-200 bg-white/95 px-5 py-8 shadow-[0_16px_32px_rgba(15,23,42,0.12)] sm:px-8 sm:py-9">
            <form onSubmit={handleLogin} className="space-y-4">
              <label className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-4 shadow-[0_2px_8px_rgba(15,23,42,0.08)]">
                <Mail className="h-5 w-5 text-slate-500" />
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent text-lg text-slate-700 outline-none placeholder:text-slate-400"
                />
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-4 shadow-[0_2px_8px_rgba(15,23,42,0.08)]">
                <Lock className="h-5 w-5 text-slate-500" />
                <input
                  type="password"
                  placeholder="•••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent text-lg text-slate-700 outline-none placeholder:text-slate-400"
                />
              </label>

              <div className="text-right">
                <a href="#" className="text-base font-medium text-[#0d69d9] hover:underline sm:text-xl">
                  Forgot Password?
                </a>
              </div>

              <Button
                type="submit"
                className="mt-1 h-16 w-full rounded-2xl bg-gradient-to-b from-[#2f89ff] to-[#0f65d3] text-2xl font-bold text-white shadow-[0_10px_20px_rgba(15,101,211,0.35)] hover:from-[#2d7fe9] hover:to-[#0e5ec2] sm:text-4xl"
                disabled={isSubmitting}
              >
                Login
              </Button>
            </form>

            <p className="mt-10 text-lg text-slate-500 sm:text-xl">
              Need help?{" "}
              <a href="#" className="font-medium text-[#0d69d9] hover:underline">
                Contact IT Support
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
