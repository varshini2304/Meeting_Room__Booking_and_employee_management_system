import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getMeApi, loginApi, logoutApi, signupApi } from "@/api/auth";
import { getToken, setToken } from "@/api/client";
import type { User, UserRole } from "@/api/types";

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  role: UserRole | null;
  login: (email: string, password: string) => Promise<User>;
  signup: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(getToken()));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const bootstrap = async () => {
      if (!getToken()) {
        setIsLoading(false);
        return;
      }
      try {
        const me = await getMeApi();
        setUser(me);
        setIsAuthenticated(true);
      } catch {
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };
    bootstrap();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      isLoading,
      user,
      role: user?.role ?? null,
      login: async (email, password) => {
        const data = await loginApi({ email: email.trim().toLowerCase(), password });
        setToken(data.token);
        setUser(data.user);
        setIsAuthenticated(true);
        return data.user;
      },
      signup: async (email, password) => {
        const normalizedEmail = email.trim().toLowerCase();
        const generatedName = normalizedEmail.split("@")[0] || "Employee";
        const generatedEmployeeId = `EMP-${Date.now().toString().slice(-6)}`;
        const data = await signupApi({
          email: normalizedEmail,
          password,
          name: generatedName,
          employeeId: generatedEmployeeId,
          role: "employee",
        });
        setToken(data.token);
        setUser(data.user);
        setIsAuthenticated(true);
        return data.user;
      },
      logout: async () => {
        try {
          await logoutApi();
        } catch {
          // ignore API logout failures; clear local auth regardless
        }
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
      },
    }),
    [isAuthenticated, isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
