import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { crudApi, uploadMedia } from "@/lib/apiClient";
import { toast } from "sonner";
import { User, LogOut, Mail, Phone, Stethoscope, Building2, Pencil, Save, X, Shield, Lock, Upload, Loader2, Volume2, VolumeX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { type AppRole } from "@/lib/permissions";
import { useLanguage } from "@/contexts/LanguageContext";
import { getRoleGradient, getRoleImage, getRoleColors } from "@/lib/roleColors";
import { playNotificationSound } from "@/lib/notificationSound";

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:3003';

// Helper to resolve image URLs - converts relative backend paths to full URLs
const resolveImageUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  // Already a full URL
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // Relative path from backend - prepend backend base URL
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
};

interface ProfileData {
  full_name: string;
  phone: string;
  specialty: string;
  service_name: string;
}

const Settings = () => {
  const { user, profile, userRole, signOut } = useAuth();
  const { t, dir, lang } = useLanguage();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileData>({
    full_name: "",
    phone: "",
    specialty: "",
    service_name: "",
  });

  // Notification sound preference. Defaults to `true` so legacy accounts
  // still hear the cue until they actively turn it off.
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [savingSound, setSavingSound] = useState(false);

  const roleLabelsTranslated: Record<string, string> = {
    super_admin: t.roleSuperAdmin,
    admin: t.roleAdmin,
    user: t.roleUser,
    parent: t.roleParent,
  };

  // Localized labels for the sound toggle. We keep them inline so we don't
  // need to edit the i18n files for this incremental feature.
  const soundLabels = {
    title: lang === "fr" ? "Notifications sonores" : "التنبيهات الصوتية",
    desc:
      lang === "fr"
        ? "Jouer un petit son lorsqu'une notification de rendez-vous apparaît."
        : "تشغيل نغمة قصيرة عند وصول إشعار بموعد.",
    enabled: lang === "fr" ? "Activé" : "مفعّل",
    disabled: lang === "fr" ? "Désactivé" : "معطّل",
    test: lang === "fr" ? "Tester le son" : "تجربة الصوت",
  };

  useEffect(() => {
    if (!user?.id) return;
    crudApi.getOne("profiles", user.id).then((data) => {
      if (data) {
        setForm({
          full_name: data.full_name || "",
          phone: data.phone || "",
          specialty: data.specialty || "",
          service_name: data.service_name || "",
        });
        if (data.profile_image_url) {
          setProfileImageUrl(data.profile_image_url);
        }
        // Read sound preference; treat anything other than `false` as enabled
        // so missing column / new accounts keep sound on by default.
        setSoundEnabled(data.notification_sound_enabled !== false);
      }
    }).catch(() => {});
  }, [user?.id]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    setUploadingImage(true);
    try {
      // Upload file using the proper uploadMedia function from apiClient
      const imageUrl = await uploadMedia(file);
      console.log('[v0] Image uploaded to:', imageUrl);
      
      // Update profile with the new image URL using the existing CRUD update endpoint
      await crudApi.update("profiles", user.id, {
        profile_image_url: imageUrl,
      });
      console.log('[v0] Profile updated with image URL:', imageUrl);
      
      setProfileImageUrl(imageUrl);
      toast.success(t.uploadSuccess || 'Image uploaded successfully');
    } catch (error: any) {
      console.error('[v0] Upload error:', error);
      toast.error(error.message || 'Upload failed');
    } finally {
      setUploadingImage(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await crudApi.update("profiles", user.id, {
        full_name: form.full_name,
        phone: form.phone,
        specialty: form.specialty,
        service_name: form.service_name,
      });
      toast.success(t.saveSuccess);
      setEditing(false);
      window.location.reload();
    } catch {
      toast.error(t.saveError);
    }
    setSaving(false);
  };

  const handleCancel = () => {
    setEditing(false);
    if (user?.id) {
      crudApi.getOne("profiles", user.id).then((data) => {
        if (data) {
          setForm({
            full_name: data.full_name || "",
            phone: data.phone || "",
            specialty: data.specialty || "",
            service_name: data.service_name || "",
          });
        }
      }).catch(() => {});
    }
  };

  // Toggle + persist sound preference. Optimistic UI: we flip the switch
  // immediately and roll back on failure so the UI feels responsive.
  const toggleSound = async () => {
    if (!user?.id || savingSound) return;
    const next = !soundEnabled;
    setSoundEnabled(next);
    setSavingSound(true);
    try {
      await crudApi.update("profiles", user.id, {
        notification_sound_enabled: next,
      });
      // Play a short test ding when turning the sound ON so the user knows
      // the change took effect. Also counts as the "unlock" gesture for
      // audio on most browsers.
      if (next) playNotificationSound();
      toast.success(t.saveSuccess);
    } catch (err: any) {
      setSoundEnabled(!next); // rollback
      toast.error(t.saveError || "Save failed");
    } finally {
      setSavingSound(false);
    }
  };

  const roleLabelAr = userRole ? roleLabelsTranslated[userRole] || userRole : t.welcomeUser;

  const profileFields = [
    { key: "full_name" as const, label: t.fullName, icon: User, show: true },
    { key: "phone" as const, label: t.phone, icon: Phone, show: true },
    { key: "specialty" as const, label: t.specialty, icon: Stethoscope, show: userRole === "super_admin" || userRole === "user" },
    { key: "service_name" as const, label: t.departmentService, icon: Building2, show: userRole === "super_admin" || userRole === "admin" },
  ];

  return (
    <DashboardLayout>
      <div dir={dir} className="space-y-6 max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-2xl font-bold font-cairo">{t.settingsTitle}</h2>
          <p className="text-muted-foreground font-cairo mt-1">{t.settingsSubtitle}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="neu-flat rounded-3xl bg-background overflow-hidden">
          <div className={`h-32 bg-gradient-to-r ${getRoleColors(userRole).gradient} relative`}>
            <img src={resolveImageUrl(profileImageUrl) || getRoleImage(userRole)} alt="Profile header" className="w-full h-full object-cover opacity-80" />
            <label className="absolute top-2 right-2 cursor-pointer">
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploadingImage} />
              <div className="bg-white/90 hover:bg-white rounded-lg p-2 flex items-center gap-1 text-sm text-gray-700 transition-colors">
                {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                <span className="hidden sm:inline">{t.upload || 'Upload'}</span>
              </div>
            </label>
            <div className="absolute -bottom-10 right-6">
              <div className="h-24 w-24 rounded-2xl bg-background shadow-lg flex items-center justify-center border-4 border-background overflow-hidden">
                <img src={resolveImageUrl(profileImageUrl) || getRoleImage(userRole)} alt="Profile" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
          <div className="pt-14 px-6 pb-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold font-cairo">{form.full_name || t.welcomeUser}</h3>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  <span>{user?.email}</span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium font-cairo gradient-accent text-primary-foreground">
                <Shield className="h-3 w-3" />
                {roleLabelAr}
              </span>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="neu-flat rounded-3xl bg-background p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold font-cairo text-lg">{t.personalInfo}</h3>
            {!editing ? (
              userRole !== "parent" && (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="rounded-xl font-cairo gap-2">
                  <Pencil className="h-4 w-4" />
                  {t.edit}
                </Button>
              )
            ) : (
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving} className="rounded-xl font-cairo gap-2 bg-gradient-to-r from-orange-400 to-orange-600 text-white hover:from-orange-500 hover:to-orange-700">
                  <Save className="h-4 w-4" />
                  {saving ? t.saving : t.save}
                </Button>
                <Button variant="outline" size="sm" onClick={handleCancel} className="rounded-xl font-cairo gap-2">
                  <X className="h-4 w-4" />
                  {t.cancel}
                </Button>
              </div>
            )}
          </div>

          <div className="grid gap-5">
            {profileFields.filter((f) => f.show).map((field) => (
              <div key={field.key} className="space-y-2">
                <Label className="font-cairo text-sm text-muted-foreground flex items-center gap-2">
                  <field.icon className="h-4 w-4" />
                  {field.label}
                </Label>
                {editing ? (
                  <Input value={form[field.key]} onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))} className="rounded-xl font-cairo" placeholder={field.label} />
                ) : (
                  <div className="rounded-xl bg-muted/50 px-4 py-3 text-sm font-cairo min-h-[44px] flex items-center">
                    {form[field.key] || <span className="text-muted-foreground">{t.notSpecified}</span>}
                  </div>
                )}
              </div>
            ))}

            <div className="space-y-2">
              <Label className="font-cairo text-sm text-muted-foreground flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {t.emailLabel}
              </Label>
              <div className="rounded-xl bg-muted/50 px-4 py-3 text-sm font-cairo min-h-[44px] flex items-center text-muted-foreground">
                {user?.email}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-cairo text-sm text-muted-foreground flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {t.roleLabel}
              </Label>
              <div className="rounded-xl bg-muted/50 px-4 py-3 text-sm font-cairo min-h-[44px] flex items-center text-muted-foreground">
                {roleLabelAr}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Notification sound preferences */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="neu-flat rounded-3xl bg-background p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-2xl flex items-center justify-center gradient-accent text-primary-foreground shrink-0">
                {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold font-cairo text-lg">{soundLabels.title}</h3>
                <p className="text-sm text-muted-foreground font-cairo mt-1">
                  {soundLabels.desc}
                </p>
                <p className="text-xs font-cairo mt-2">
                  <span
                    className={
                      soundEnabled
                        ? "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 bg-green-500/15 text-green-600 dark:text-green-400"
                        : "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 bg-muted text-muted-foreground"
                    }
                  >
                    {soundEnabled ? soundLabels.enabled : soundLabels.disabled}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              {/* Accessible switch — plain HTML so we don't depend on any
                  extra shadcn primitive that may or may not be in the repo. */}
              <button
                type="button"
                role="switch"
                aria-checked={soundEnabled}
                aria-label={soundLabels.title}
                disabled={savingSound}
                onClick={toggleSound}
                className={
                  "relative inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-50 " +
                  (soundEnabled ? "bg-gradient-to-r from-orange-400 to-orange-600" : "bg-muted")
                }
              >
                <span
                  className={
                    "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform " +
                    (soundEnabled ? "translate-x-6" : "translate-x-1")
                  }
                />
              </button>

              <Button
                variant="outline"
                size="sm"
                disabled={!soundEnabled}
                onClick={() => playNotificationSound()}
                className="rounded-xl font-cairo gap-2"
              >
                <Volume2 className="h-4 w-4" />
                {soundLabels.test}
              </Button>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-3">
          <button onClick={() => navigate("/password-change")}
            className="neu-flat rounded-2xl bg-background px-6 py-3 flex items-center gap-3 text-primary font-cairo font-medium hover:scale-105 transition-transform w-full justify-center">
            <Lock className="h-5 w-5" />
            {t.changePassword}
          </button>
          <button onClick={signOut}
            className="neu-flat rounded-2xl bg-background px-6 py-3 flex items-center gap-3 text-destructive font-cairo font-medium hover:scale-105 transition-transform w-full justify-center">
            <LogOut className="h-5 w-5" />
            {t.logout}
          </button>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default Settings;