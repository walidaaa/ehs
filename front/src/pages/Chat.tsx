import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/usePermissions";
import { useTableQuery } from "@/hooks/useSupabaseQuery";
import { usePresence } from "@/hooks/usePresence";
import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { MessageCircle, Search, Users, Stethoscope, UserCheck } from "lucide-react";
import { ChatConversation } from "@/components/chat/ChatConversation";
import { ChatContactList } from "@/components/chat/ChatContactList";
import { specialtyMap, translateValue } from "@/lib/translationMaps";

const Chat = () => {
  const { t, dir } = useLanguage();
  const { user } = useAuth();
  const role = useRole();
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const queryClient = useQueryClient();
  
  // Track presence updates
  usePresence();

  const { data: profiles = [], refetch: refetchProfiles } = useTableQuery("profiles");
  const { data: parents = [] } = useTableQuery("parents");
  const { data: patients = [] } = useTableQuery("patients");
  const { data: userRoles = [] } = useTableQuery("user_roles");
  const { data: patientDoctors = [] } = useTableQuery("patient_doctors");
  const { data: messages = [], refetch: refetchMessages } = useTableQuery("messages" as any);
  
  // Initial load - fetch profiles immediately
  useEffect(() => {
    refetchProfiles();
  }, [refetchProfiles]);
  
  // Refresh profiles periodically to get updated last_seen values
  useEffect(() => {
    const interval = setInterval(() => {
      // Invalidate cache and refetch to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      refetchProfiles();
    }, 3000); // Refresh every 3 seconds for faster real-time status updates
    return () => clearInterval(interval);
  }, [refetchProfiles, queryClient]);
  
  // Update presence on user interaction (click, typing, etc)
  useEffect(() => {
    const handleActivity = () => {
      if (user?.id) {
        // Trigger presence update via the hook
        refetchProfiles();
      }
    };
    
    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);
    
    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, [user?.id, refetchProfiles]);

  const contacts: any[] = useMemo(() => {
    if (!user?.id) return [];

    // Parent: sees only doctors of their children
    if (role === "parent") {
      const parentRecord = parents.find((p: any) => p.user_id === user.id);
      if (!parentRecord) return [];
      const myChildren = patients.filter((p: any) => p.parent_id === parentRecord.id);
      const doctorIds = new Set<string>();
      myChildren.forEach((child: any) => {
        if (child.doctor_id) doctorIds.add(child.doctor_id);
        patientDoctors.filter((pd: any) => pd.patient_id === child.id).forEach((pd: any) => doctorIds.add(pd.doctor_id));
      });
      return Array.from(doctorIds).map(did => {
        const prof = profiles.find((p: any) => p.id === did);
        if (!prof) return null;
        const childNames = myChildren.filter(c => c.doctor_id === did || patientDoctors.some((pd: any) => pd.patient_id === c.id && pd.doctor_id === did)).map(c => c.name);
        return { id: did, name: prof.full_name, subtitle: prof.specialty ? translateValue(prof.specialty, specialtyMap, t) : t.doctor, userId: did, childNames, contactType: "doctor" as const, lastSeen: (prof as any).last_seen };
      }).filter(Boolean);
    }

    // Doctor (user): sees parents of their patients + their admin + super admins
    if (role === "user") {
      const myPatientIds = patientDoctors.filter((pd: any) => pd.doctor_id === user.id).map((pd: any) => pd.patient_id);
      const myPatients = patients.filter((p: any) => myPatientIds.includes(p.id) || p.doctor_id === user.id);
      const parentIds = new Set<string>();
      myPatients.forEach((p: any) => { if (p.parent_id) parentIds.add(p.parent_id); });
      const parentContacts = Array.from(parentIds).map(pid => {
        const par = parents.find((p: any) => p.id === pid);
        if (!par || !par.user_id) return null;
        const childNames = myPatients.filter(p => p.parent_id === pid).map(p => p.name);
        return { id: par.user_id, name: par.full_name, subtitle: t.parentGuardian, userId: par.user_id, childNames, contactType: "parent" as const, lastSeen: profiles.find((p: any) => p.id === par.user_id)?.last_seen as any };
      }).filter(Boolean);

      // Add admin who created this doctor
      const myProfile = profiles.find((p: any) => p.id === user.id);
      const adminContacts: any[] = [];
      if (myProfile?.created_by) {
        const adminProf = profiles.find((p: any) => p.id === myProfile.created_by);
        if (adminProf) {
          adminContacts.push({ id: adminProf.id, name: adminProf.full_name, subtitle: (adminProf as any).service_name || t.chatService, userId: adminProf.id, childNames: [], contactType: "admin" as const, lastSeen: (adminProf as any).last_seen });
        }
      }

      // Add super admins
      const superAdminContacts = profiles.filter((p: any) =>
        p.id !== user.id && userRoles.some((r: any) => r.user_id === p.id && r.role === "super_admin")
      ).map(p => ({ id: p.id, name: p.full_name, subtitle: "مشرف عام", userId: p.id, childNames: [] as string[], contactType: "super_admin" as const, lastSeen: (p as any).last_seen }));

      return [...adminContacts, ...superAdminContacts, ...parentContacts];
    }

    // Admin (مصلحة): sees doctors + parents (NOT patients)
    if (role === "admin") {
      const doctorContacts = profiles.filter((p: any) =>
        p.created_by === user.id && userRoles.some((r: any) => r.user_id === p.id && r.role === "user")
      ).map(p => ({ id: p.id, name: p.full_name, subtitle: (p as any).specialty ? translateValue((p as any).specialty, specialtyMap, t) : t.doctor, userId: p.id, childNames: [] as string[], contactType: "doctor" as const, lastSeen: (p as any).last_seen }));

      // Only parents linked to patients of this admin's doctors
      const myDoctorIds = profiles.filter((p: any) =>
        p.created_by === user.id && userRoles.some((r: any) => r.user_id === p.id && r.role === "user")
      ).map((p: any) => p.id);
      const myPatients = patients.filter((p: any) =>
        (p.doctor_id && myDoctorIds.includes(p.doctor_id)) ||
        patientDoctors.some((pd: any) => pd.patient_id === p.id && myDoctorIds.includes(pd.doctor_id))
      );
      const scopedParentIds = new Set(myPatients.map((p: any) => p.parent_id).filter(Boolean));
      const parentContacts = parents
        .filter((p: any) => p.user_id && scopedParentIds.has(p.id))
        .map(p => {
          const childNames = myPatients.filter((pt: any) => pt.parent_id === p.id).map((pt: any) => pt.name);
          return { id: p.user_id!, name: p.full_name, subtitle: t.parentGuardian, userId: p.user_id!, childNames, contactType: "parent" as const, lastSeen: profiles.find((pr: any) => pr.id === p.user_id)?.last_seen as any };
        });

      // Add super admins
      const superAdminContacts = profiles.filter((p: any) =>
        p.id !== user.id && userRoles.some((r: any) => r.user_id === p.id && r.role === "super_admin")
      ).map(p => ({ id: p.id, name: p.full_name, subtitle: "مشرف عام", userId: p.id, childNames: [] as string[], contactType: "super_admin" as const, lastSeen: (p as any).last_seen }));

      return [...superAdminContacts, ...doctorContacts, ...parentContacts];
    }

    // Super Admin: sees admins (مصالح) + doctors only (NOT parents)
    if (role === "super_admin") {
      const adminContacts = profiles.filter((p: any) =>
        userRoles.some((r: any) => r.user_id === p.id && r.role === "admin")
      ).map(p => ({ id: p.id, name: p.full_name, subtitle: (p as any).service_name || t.chatService, userId: p.id, childNames: [] as string[], contactType: "admin" as const, lastSeen: (p as any).last_seen }));

      const doctorContacts = profiles.filter((p: any) =>
        userRoles.some((r: any) => r.user_id === p.id && r.role === "user")
      ).map(p => ({ id: p.id, name: p.full_name, subtitle: (p as any).specialty ? translateValue((p as any).specialty, specialtyMap, t) : t.doctor, userId: p.id, childNames: [] as string[], contactType: "doctor" as const, lastSeen: (p as any).last_seen }));

      return [...adminContacts, ...doctorContacts];
    }

    return [];
  }, [user?.id, role, profiles, parents, patients, userRoles, patientDoctors]);

  // Get available tabs based on role
  const tabs = useMemo(() => {
    if (role === "parent") return [{ key: "all", label: t.chatDoctors, icon: Stethoscope }];
    if (role === "user") return [
      { key: "all", label: t.chatAll, icon: MessageCircle },
      { key: "admin", label: t.chatServices, icon: UserCheck },
      { key: "parent", label: t.chatParents, icon: Users },
    ];
    if (role === "admin") return [
      { key: "all", label: t.chatAll, icon: MessageCircle },
      { key: "super_admin", label: "مشرف عام", icon: UserCheck },
      { key: "doctor", label: t.chatDoctors, icon: Stethoscope },
      { key: "parent", label: t.chatParents, icon: Users },
    ];
    if (role === "super_admin") return [
      { key: "all", label: t.chatAll, icon: MessageCircle },
      { key: "admin", label: t.chatServices, icon: UserCheck },
      { key: "doctor", label: t.chatDoctors, icon: Stethoscope },
    ];
    return [];
  }, [role, t]);

  const filteredContacts = useMemo(() => {
    let list = contacts;
    if (activeTab !== "all") {
      list = list.filter((c: any) => c.contactType === activeTab);
    }
    if (search) {
      list = list.filter((c: any) => c.name?.includes(search) || c.subtitle?.includes(search));
    }
    return list;
  }, [contacts, activeTab, search]);

  const unreadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    messages.forEach((m: any) => {
      if (m.receiver_id === user?.id && !m.read) {
        counts[m.sender_id] = (counts[m.sender_id] || 0) + 1;
      }
    });
    return counts;
  }, [messages, user?.id]);

  const lastMessages = useMemo(() => {
    const map: Record<string, any> = {};
    messages.forEach((m: any) => {
      const contactId = m.sender_id === user?.id ? m.receiver_id : m.sender_id;
      if (!map[contactId] || new Date(m.created_at) > new Date(map[contactId].created_at)) {
        map[contactId] = m;
      }
    });
    return map;
  }, [messages, user?.id]);

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  return (
    <DashboardLayout>
      <div dir={dir} className="h-[calc(100vh-120px)] p-2 md:p-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="h-full flex gap-3">
          
          {/* Contacts Sidebar */}
          <div className={`${selectedContact ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 lg:w-96 rounded-2xl border border-border/40 bg-card shadow-sm overflow-hidden`}>
            {/* Header */}
            <div className="p-4 border-b border-border/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <MessageCircle className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold font-cairo text-foreground">{t.chatTitle}</h2>
                    <p className="text-[10px] text-muted-foreground font-cairo">
                      {contacts.length} {t.chatContacts}
                      {totalUnread > 0 && <span className="text-primary font-bold ms-1">• {totalUnread} {t.chatUnread}</span>}
                    </p>
                  </div>
                </div>
              </div>

              {/* Search */}
              <div className="relative mb-3">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.searchContacts}
                  className="w-full bg-muted/50 border border-border/30 rounded-xl pe-10 ps-4 py-2 text-sm outline-none font-cairo focus:ring-2 focus:ring-primary/20 transition-all" />
              </div>

              {/* Tabs */}
              {tabs.length > 1 && (
                <div className="flex gap-1 bg-muted/40 rounded-xl p-1">
                  {tabs.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.key;
                    const tabCount = tab.key === "all" ? contacts.length : contacts.filter((c: any) => c.contactType === tab.key).length;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-cairo font-medium transition-all ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{tab.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          isActive ? "bg-primary-foreground/20" : "bg-muted"
                        }`}>{tabCount}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Contacts List */}
            <div className="flex-1 overflow-y-auto p-2">
              <ChatContactList
                contacts={filteredContacts}
                selectedId={selectedContact?.id}
                unreadCounts={unreadCounts}
                lastMessages={lastMessages}
                onSelect={(c) => setSelectedContact(c)}
                t={t}
              />
            </div>
          </div>

          {/* Chat Area */}
          <div className={`${selectedContact ? 'flex' : 'hidden md:flex'} flex-1 flex-col rounded-2xl border border-border/40 bg-card shadow-sm overflow-hidden`}>
            {selectedContact ? (
              <ChatConversation
                contact={selectedContact}
                currentUserId={user?.id || ""}
                onBack={() => setSelectedContact(null)}
                onMessagesUpdate={refetchMessages}
                t={t}
                dir={dir}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center bg-muted/10">
                <div className="text-center space-y-4">
                  <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                    <MessageCircle className="h-10 w-10 text-primary/50" />
                  </div>
                  <h3 className="text-lg font-bold font-cairo text-foreground">{t.selectConversation}</h3>
                  <p className="text-sm text-muted-foreground font-cairo max-w-xs">{t.chatWelcome}</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default Chat;
