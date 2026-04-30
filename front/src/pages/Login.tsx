import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LogIn, Eye, EyeOff, Loader2, Moon, Sun, Globe, MapPin, Phone, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import logoImg from "@/assets/logo-themed.png";
import heroImg from "@/assets/login-hero.jpg";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { t, lang, setLang, dir } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  // Optional hero translations (fallback strings used when missing)
  const tx = t as Record<string, string | undefined>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error(t.enterEmailPassword);
      return;
    }
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      if (error.message?.includes("Invalid login credentials")) {
        toast.error(t.invalidCredentials);
      } else {
        toast.error(t.loginError + ": " + error.message);
      }
    } else {
      toast.success(t.loginSuccess);
      navigate("/");
    }
    setLoading(false);
  };

  return (
    <div dir={dir} className="relative min-h-screen w-full overflow-hidden bg-background">
      {/* ── Subtle ambient background (kept far from the card) ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-56 -left-56 h-[480px] w-[480px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-56 -right-56 h-[520px] w-[520px] rounded-full bg-accent/40 blur-3xl" />
      </div>

      {/* ── Top controls ── */}
      <div className="absolute top-4 z-30 flex items-center gap-2" style={{ insetInlineEnd: "1rem" }}>
        <button
          onClick={toggleTheme}
          className="rounded-2xl p-2.5 bg-card border border-border shadow-sm hover:shadow-md transition-all text-foreground"
          aria-label="Toggle theme"
        >
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
        <button
          onClick={() => setLang(lang === "ar" ? "fr" : "ar")}
          className="rounded-2xl px-3 py-2 bg-card border border-border shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 text-sm font-medium text-foreground"
        >
          <span>{lang === "ar" ? "FR" : "AR"}</span>
          <Globe className="h-4 w-4" />
        </button>
      </div>

      {/* ── Main split layout ── */}
      <div className="relative z-10 grid min-h-screen grid-cols-1 lg:grid-cols-2">
        {/* ── Left: Hero image with info (shown on lg+) ── */}
        <div className="relative hidden lg:block overflow-hidden order-2 lg:order-1">
          <motion.div
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0"
          >
            <img src={heroImg} alt="EHS Ain Abessa" className="h-full w-full object-cover" />
            {/* Strong dark gradient so the white text is fully readable */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/15" />
          </motion.div>

          {/* Hero text overlay */}
          <div className="absolute inset-0 flex flex-col justify-end p-10 lg:p-14 text-white">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="space-y-4"
            >
              <h2 className="text-3xl lg:text-4xl font-bold leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                {tx.heroTitle ?? "المؤسسة الاستشفائية المتخصصة عين عبسة"}
              </h2>
              <p className="text-sm lg:text-base text-white max-w-lg leading-relaxed drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                {tx.heroSubtitle ??
                  "نظام متكامل لإدارة الرعاية الصحية النفسية — متابعة المرضى، المواعيد، العلاجات والتقارير بكل سهولة واحترافية."}
              </p>

              <div className="space-y-2 pt-4 text-sm text-white/95 drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span>{tx.heroAddress ?? "عين عباسة، سطيف، الجزائر"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0" />
                  <span>+213 36 85 44 55</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>{tx.heroHours ?? "الأحد - الخميس: 08:00 - 16:00"}</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* ── Right: Login Card ── */}
        <div className="flex items-center justify-center p-6 lg:p-12 order-1 lg:order-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative w-full max-w-md"
          >
            {/* Solid, high-contrast card — no heavy blur/transparency */}
            <div className="relative overflow-hidden rounded-3xl bg-card border border-border shadow-xl p-8 lg:p-10">
              {/* Top accent — brand gradient */}
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500" />

              {/* ── Header ── */}
              <div className="relative flex flex-col items-center text-center mb-8">
                <div className="mb-4 rounded-full bg-background p-2 shadow-md ring-2 ring-border">
                  <img src={logoImg} alt="EHS Ain Abessa" className="h-20 w-20 rounded-full object-contain" />
                </div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">
                  {t.loginTitle}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">{t.loginSubtitle}</p>
              </div>

              {/* ── Form ── */}
              <form onSubmit={handleSubmit} className="relative space-y-5">
                {/* Email */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-foreground">
                    {t.loginEmail}
                  </label>
                  <div
                    className={`relative rounded-2xl bg-background border-2 transition-all ${
                      focused === "email"
                        ? "border-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.15)]"
                        : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocused("email")}
                      onBlur={() => setFocused(null)}
                      className="w-full bg-transparent px-4 py-3.5 text-sm outline-none rounded-2xl text-foreground placeholder:text-muted-foreground/70"
                      placeholder="parent1@exemple.com"
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-foreground">
                    {t.loginPassword}
                  </label>
                  <div
                    className={`relative rounded-2xl bg-background border-2 transition-all ${
                      focused === "password"
                        ? "border-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.15)]"
                        : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocused("password")}
                      onBlur={() => setFocused(null)}
                      className="w-full bg-transparent px-4 py-3.5 text-sm outline-none rounded-2xl text-foreground placeholder:text-muted-foreground/70"
                      style={{ paddingInlineEnd: "3rem" }}
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      style={{ insetInlineEnd: "0.75rem" }}
                      aria-label="Toggle password visibility"
                    >
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={showPassword ? "show" : "hide"}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.15 }}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </motion.div>
                      </AnimatePresence>
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 px-6 py-4 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:shadow-primary/20 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                  <span className="relative flex items-center justify-center gap-2">
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t.loginLoading}
                      </>
                    ) : (
                      <>
                        <LogIn className="h-4 w-4" />
                        {t.loginButton}
                      </>
                    )}
                  </span>
                </button>
              </form>

              {/* ── Footer ── */}
              <div className="relative mt-8 pt-6 border-t border-border text-center">
                <p className="text-xs text-muted-foreground">EHS Ain Abessa © 2026</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Login;