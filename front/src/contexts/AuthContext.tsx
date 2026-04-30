import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi, getAccessToken, clearTokens } from "@/lib/api";

interface User {
  id: string;
  email: string;
  doctorId?: string; // For doctors, this is their profile ID used in appointments table
}

interface AuthContextType {
  user: User | null;
  userRole: string | null;
  profile: { full_name: string; phone?: string } | null;
  doctorId: string | null; // For doctors: profile ID used in appointments/patient_doctors tables
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ full_name: string; phone?: string } | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const token = getAccessToken();
        if (!token) {
          setUser(null);
          setUserRole(null);
          setProfile(null);
          setDoctorId(null);
          setLoading(false);
          return;
        }

        const data = await authApi.getMe();
        if (!mounted) return;

        setUser(data.user);
        setUserRole(data.role);
        setProfile(data.profile);
        setDoctorId(data.doctorId || null);
      } catch (err) {
        console.error("Auth load error:", err);
        clearTokens();
        setUser(null);
        setUserRole(null);
        setProfile(null);
        setDoctorId(null);
      }
      if (mounted) setLoading(false);
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const data = await authApi.login(email, password);
      setUser(data.user);
      setUserRole(data.role);
      setProfile(data.profile);
      setDoctorId(data.doctorId || null);
      return { error: null };
    } catch (error: any) {
      return { error: { message: error.message } };
    }
  };

  const signOut = async () => {
    queryClient.clear();
    authApi.logout();
    setUser(null);
    setUserRole(null);
    setProfile(null);
    setDoctorId(null);
  };

  return (
    <AuthContext.Provider value={{ user, userRole, profile, doctorId, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
