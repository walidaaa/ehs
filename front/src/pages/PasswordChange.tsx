import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRole } from "@/hooks/usePermissions";
import { authApi } from "@/lib/api";
import { toast } from "sonner";
import { Lock, Eye, EyeOff, Shield, Users, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useTableQuery } from "@/hooks/useSupabaseQuery";
import { useNavigate } from "react-router-dom";

const PasswordChange = () => {
  const { user } = useAuth();
  const { t, dir } = useLanguage();
  const role = useRole();
  const navigate = useNavigate();
  const isSuperAdmin = role === "super_admin";

  // Self change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Super admin state
  const [selectedUserId, setSelectedUserId] = useState("");
  const [adminNewPassword, setAdminNewPassword] = useState("");
  const [adminConfirmPassword, setAdminConfirmPassword] = useState("");
  const [adminSaving, setAdminSaving] = useState(false);
  const [showAdminNew, setShowAdminNew] = useState(false);
  const [showAdminConfirm, setShowAdminConfirm] = useState(false);

  const { data: profiles = [] } = useTableQuery("profiles");
  const { data: userRoles = [] } = useTableQuery("user_roles");

  const usersWithRoles = profiles.map((p: any) => {
    const ur = userRoles.find((r: any) => r.user_id === p.id);
    return { ...p, role: ur?.role || "unknown" };
  }).filter((u: any) => u.id !== user?.id);

  const roleLabels: Record<string, string> = {
    super_admin: t.roleSuperAdmin,
    admin: t.roleAdmin,
    user: t.roleUser,
    parent: t.roleParent,
  };

  const handleSelfChange = async () => {
    if (!currentPassword.trim()) {
      toast.error(t.currentPasswordRequired);
      return;
    }
    if (newPassword.length < 6) {
      toast.error(t.passwordMinLength);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t.passwordMismatch);
      return;
    }

    setSaving(true);

    try {
      await authApi.changePassword(currentPassword, newPassword);
      toast.success(t.passwordChangeSuccess);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error(error.message || t.passwordChangeError);
    } finally {
      setSaving(false);
    }
  };

  const handleAdminChange = async () => {
    if (!selectedUserId) {
      toast.error(t.selectUser);
      return;
    }
    if (adminNewPassword.length < 6) {
      toast.error(t.passwordMinLength);
      return;
    }
    if (adminNewPassword !== adminConfirmPassword) {
      toast.error(t.passwordMismatch);
      return;
    }

    setAdminSaving(true);
    try {
      await authApi.changeAdminPassword(selectedUserId, adminNewPassword);
      const selectedUser = profiles.find((p: any) => p.id === selectedUserId);
      toast.success(`${t.passwordChangeSuccess} - ${selectedUser?.full_name || ""}`);
      setAdminNewPassword("");
      setAdminConfirmPassword("");
      setSelectedUserId("");
    } catch (error: any) {
      toast.error(error.message || t.passwordChangeError);
    } finally {
      setAdminSaving(false);
    }
  };

  const PasswordInput = ({ 
    value, onChange, show, onToggle, placeholder, id 
  }: { 
    value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; placeholder: string; id: string;
  }) => (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl font-cairo pe-10"
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute top-1/2 -translate-y-1/2 end-3 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );

  const passwordStrength = (pwd: string) => {
    if (!pwd) return { width: "0%", color: "bg-muted", label: "" };
    if (pwd.length < 6) return { width: "25%", color: "bg-destructive", label: t.passwordWeak };
    if (pwd.length < 10) return { width: "60%", color: "bg-yellow-500", label: t.passwordMedium };
    return { width: "100%", color: "bg-green-500", label: t.passwordStrong };
  };

  const strength = passwordStrength(newPassword);
  const adminStrength = passwordStrength(adminNewPassword);

  return (
    <DashboardLayout>
      <div dir={dir} className="space-y-6 max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/settings")} className="rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold font-cairo flex items-center gap-2">
              <Lock className="h-6 w-6 text-primary" />
              {t.changePassword}
            </h2>
            <p className="text-muted-foreground font-cairo mt-1">{t.changePasswordSubtitle}</p>
          </div>
        </motion.div>

        {/* Self password change */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="neu-flat rounded-3xl bg-background p-6"
        >
          <h3 className="font-semibold font-cairo text-lg mb-6 flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            {t.changeMyPassword}
          </h3>

          <div className="grid gap-5">
            <div className="space-y-2">
              <Label htmlFor="current" className="font-cairo text-sm text-muted-foreground flex items-center gap-2">
                <Lock className="h-4 w-4" />
                {t.currentPassword}
              </Label>
              <PasswordInput id="current" value={currentPassword} onChange={setCurrentPassword} show={showCurrent} onToggle={() => setShowCurrent(!showCurrent)} placeholder={t.currentPassword} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new" className="font-cairo text-sm text-muted-foreground flex items-center gap-2">
                <Lock className="h-4 w-4" />
                {t.newPassword}
              </Label>
              <PasswordInput id="new" value={newPassword} onChange={setNewPassword} show={showNew} onToggle={() => setShowNew(!showNew)} placeholder={t.newPassword} />
              {newPassword && (
                <div className="space-y-1">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${strength.color}`} style={{ width: strength.width }} />
                  </div>
                  <p className={`text-xs font-cairo ${strength.color === "bg-destructive" ? "text-destructive" : strength.color === "bg-yellow-500" ? "text-yellow-600" : "text-green-600"}`}>
                    {strength.label}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm" className="font-cairo text-sm text-muted-foreground flex items-center gap-2">
                <Lock className="h-4 w-4" />
                {t.confirmNewPassword}
              </Label>
              <PasswordInput id="confirm" value={confirmPassword} onChange={setConfirmPassword} show={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} placeholder={t.confirmNewPassword} />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive font-cairo">{t.passwordMismatch}</p>
              )}
              {confirmPassword && newPassword === confirmPassword && confirmPassword.length > 0 && (
                <p className="text-xs text-green-600 font-cairo">✓ {t.passwordMatch}</p>
              )}
            </div>

            <Button
              onClick={handleSelfChange}
              disabled={saving || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 6}
              className="rounded-xl font-cairo gap-2 gradient-primary text-primary-foreground w-full"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full" />
                  {t.saving}
                </span>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  {t.changePassword}
                </>
              )}
            </Button>
          </div>
        </motion.div>

        {/* Super Admin: change any user's password */}
        {isSuperAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="neu-flat rounded-3xl bg-background p-6"
          >
            <h3 className="font-semibold font-cairo text-lg mb-6 flex items-center gap-2">
              <Shield className="h-5 w-5 text-accent" />
              {t.adminChangePassword}
            </h3>

            <div className="grid gap-5">
              <div className="space-y-2">
                <Label className="font-cairo text-sm text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {t.selectUser}
                </Label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-cairo ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">{t.selectUser}...</option>
                  {usersWithRoles.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} — {roleLabels[u.role] || u.role}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-new" className="font-cairo text-sm text-muted-foreground flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  {t.newPassword}
                </Label>
                <PasswordInput id="admin-new" value={adminNewPassword} onChange={setAdminNewPassword} show={showAdminNew} onToggle={() => setShowAdminNew(!showAdminNew)} placeholder={t.newPassword} />
                {adminNewPassword && (
                  <div className="space-y-1">
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-300 ${adminStrength.color}`} style={{ width: adminStrength.width }} />
                    </div>
                    <p className={`text-xs font-cairo ${adminStrength.color === "bg-destructive" ? "text-destructive" : adminStrength.color === "bg-yellow-500" ? "text-yellow-600" : "text-green-600"}`}>
                      {adminStrength.label}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-confirm" className="font-cairo text-sm text-muted-foreground flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  {t.confirmNewPassword}
                </Label>
                <PasswordInput id="admin-confirm" value={adminConfirmPassword} onChange={setAdminConfirmPassword} show={showAdminConfirm} onToggle={() => setShowAdminConfirm(!showAdminConfirm)} placeholder={t.confirmNewPassword} />
                {adminConfirmPassword && adminNewPassword !== adminConfirmPassword && (
                  <p className="text-xs text-destructive font-cairo">{t.passwordMismatch}</p>
                )}
                {adminConfirmPassword && adminNewPassword === adminConfirmPassword && adminConfirmPassword.length > 0 && (
                  <p className="text-xs text-green-600 font-cairo">✓ {t.passwordMatch}</p>
                )}
              </div>

              <Button
                onClick={handleAdminChange}
                disabled={adminSaving || !selectedUserId || !adminNewPassword || !adminConfirmPassword || adminNewPassword !== adminConfirmPassword || adminNewPassword.length < 6}
                className="rounded-xl font-cairo gap-2 bg-accent text-accent-foreground hover:bg-accent/90 w-full"
              >
                {adminSaving ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin h-4 w-4 border-2 border-accent-foreground border-t-transparent rounded-full" />
                    {t.saving}
                  </span>
                ) : (
                  <>
                    <Shield className="h-4 w-4" />
                    {t.adminChangePassword}
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PasswordChange;
