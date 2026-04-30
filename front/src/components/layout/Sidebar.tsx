import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Calendar,
  Bell,
  Settings,
  Heart,
  Building2,
  Archive,
  MessageCircle,
  X,
  ClipboardList,
} from "lucide-react";
import { useRole } from "@/hooks/usePermissions";
import { roleNavItems, type AppRole } from "@/lib/permissions";
import { useLanguage } from "@/contexts/LanguageContext";
import logoImg from "@/assets/logo-themed.png";
import { createContext, useContext, useState } from "react";

// Mobile sidebar state context
const MobileSidebarContext = createContext<{
  open: boolean;
  setOpen: (v: boolean) => void;
}>({ open: false, setOpen: () => {} });

export const useMobileSidebar = () => useContext(MobileSidebarContext);

export const MobileSidebarProvider = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <MobileSidebarContext.Provider value={{ open, setOpen }}>
      {children}
    </MobileSidebarContext.Provider>
  );
};

export const Sidebar = () => {
  const location = useLocation();
  const role = useRole();
  const { t, dir } = useLanguage();

  const navItems = [
    { icon: LayoutDashboard, label: t.navDashboard, path: "/" },
    { icon: Users, label: t.navPatients, path: "/patients", roles: ["super_admin", "admin", "user"] },
    { icon: Heart, label: t.navMyChildren, path: "/patients", roles: ["parent"] },
    { icon: ClipboardList, label: t.navReception, path: "/reception", roles: ["receptionist"] },
    { icon: Building2, label: t.navDepartments, path: "/users", roles: ["super_admin"] },
    { icon: UserCheck, label: t.navDoctors, path: "/users", roles: ["admin"] },
    { icon: Heart, label: t.navParents, path: "/parents" },
    { icon: Archive, label: t.navArchive, path: "/patients/archived", roles: ["super_admin", "admin", "user"] },
    { icon: MessageCircle, label: t.navChat, path: "/chat" },
    { icon: Bell, label: t.navNotifications, path: "/notifications" },
    { icon: Settings, label: t.navSettings, path: "/settings" },
  ];

  const allowedPaths = role ? roleNavItems[role] : [];
  const visibleItems = navItems.filter((item) => {
    if (!allowedPaths.includes(item.path)) return false;
    if (item.roles && role && !item.roles.includes(role)) return false;
    return true;
  });

  const navContent = (onNavigate?: () => void) => (
    <>
      <div className="flex items-center gap-3 px-6 py-6">
        <img src={logoImg} alt="EHS" className="h-11 w-11 rounded-2xl object-contain" />
        <div>
          <h1 className="text-lg font-bold font-cairo text-sidebar-foreground">EHS Ain Abessa</h1>
          <p className="text-xs text-sidebar-foreground/60">{t.sidebarSubtitle}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path + item.label}
              to={item.path}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary shadow-md"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="font-cairo">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4">
        <div className="rounded-2xl bg-sidebar-accent p-4 text-center">
          <p className="text-xs text-sidebar-foreground/60 font-cairo">{t.sidebarVersion}</p>
          <p className="text-xs text-sidebar-foreground/40 font-cairo mt-1">EHS Ain Abessa</p>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-72 flex-col bg-sidebar text-sidebar-foreground" dir={dir}>
        {navContent()}
      </aside>
    </>
  );
};

export const MobileSidebar = () => {
  const { open, setOpen } = useMobileSidebar();
  const { dir } = useLanguage();
  const location = useLocation();
  const role = useRole();
  const { t } = useLanguage();

  const navItems = [
    { icon: LayoutDashboard, label: t.navDashboard, path: "/" },
    { icon: Users, label: t.navPatients, path: "/patients", roles: ["super_admin", "admin", "user"] },
    { icon: Heart, label: t.navMyChildren, path: "/patients", roles: ["parent"] },
    { icon: ClipboardList, label: t.navReception, path: "/reception", roles: ["receptionist"] },
    { icon: Building2, label: t.navDepartments, path: "/users", roles: ["super_admin"] },
    { icon: UserCheck, label: t.navDoctors, path: "/users", roles: ["admin"] },
    { icon: Heart, label: t.navParents, path: "/parents" },
    { icon: Archive, label: t.navArchive, path: "/patients/archived", roles: ["super_admin", "admin", "user"] },
    { icon: MessageCircle, label: t.navChat, path: "/chat" },
    { icon: Bell, label: t.navNotifications, path: "/notifications" },
    { icon: Settings, label: t.navSettings, path: "/settings" },
  ];

  const allowedPaths = role ? roleNavItems[role] : [];
  const visibleItems = navItems.filter((item) => {
    if (!allowedPaths.includes(item.path)) return false;
    if (item.roles && role && !item.roles.includes(role)) return false;
    return true;
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
      {/* Drawer */}
      <aside
        className="absolute top-0 bottom-0 w-72 flex flex-col bg-sidebar text-sidebar-foreground shadow-2xl animate-in slide-in-from-right duration-300"
        style={{ [dir === "rtl" ? "right" : "left"]: 0 }}
        dir={dir}
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute top-4 left-4 right-auto rtl:right-4 rtl:left-auto p-2 rounded-xl hover:bg-sidebar-accent"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 px-6 py-6 mt-8">
          <img src={logoImg} alt="EHS" className="h-11 w-11 rounded-2xl object-contain" />
          <div>
            <h1 className="text-lg font-bold font-cairo text-sidebar-foreground">EHS Ain Abessa</h1>
            <p className="text-xs text-sidebar-foreground/60">{t.sidebarSubtitle}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {visibleItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path + item.label}
                to={item.path}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary shadow-md"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="font-cairo">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4">
          <div className="rounded-2xl bg-sidebar-accent p-4 text-center">
            <p className="text-xs text-sidebar-foreground/60 font-cairo">{t.sidebarVersion}</p>
            <p className="text-xs text-sidebar-foreground/40 font-cairo mt-1">EHS Ain Abessa</p>
          </div>
        </div>
      </aside>
    </div>
  );
};
