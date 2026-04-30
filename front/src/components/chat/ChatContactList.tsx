import { motion } from "framer-motion";
import { MessageCircle, Stethoscope, Users, UserCheck } from "lucide-react";
import { isUserOnline } from "@/hooks/usePresence";

interface ChatContactListProps {
  contacts: any[];
  selectedId?: string;
  unreadCounts: Record<string, number>;
  lastMessages: Record<string, any>;
  onSelect: (contact: any) => void;
  t: any;
}

const contactTypeIcon = (type: string) => {
  if (type === "doctor") return Stethoscope;
  if (type === "admin") return UserCheck;
  if (type === "parent") return Users;
  return MessageCircle;
};

const contactTypeColor = (type: string) => {
  if (type === "doctor") return "bg-blue-500/10 text-blue-600";
  if (type === "admin") return "bg-emerald-500/10 text-emerald-600";
  if (type === "parent") return "bg-amber-500/10 text-amber-600";
  return "bg-primary/10 text-primary";
};

export const ChatContactList = ({ contacts, selectedId, unreadCounts, lastMessages, onSelect, t }: ChatContactListProps) => {
  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <MessageCircle className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground font-cairo">{t.noContacts}</p>
      </div>
    );
  }

  const sorted = [...contacts].sort((a, b) => {
    const unreadA = unreadCounts[a.id] || 0;
    const unreadB = unreadCounts[b.id] || 0;
    if (unreadA !== unreadB) return unreadB - unreadA;
    const lastA = lastMessages[a.id]?.created_at || "";
    const lastB = lastMessages[b.id]?.created_at || "";
    return lastB.localeCompare(lastA);
  });

  const getPreview = (contactId: string) => {
    const msg = lastMessages[contactId];
    if (!msg) return "";
    if (msg.message_type === "image") return "📷 " + (t.chatPhoto || "صورة");
    if (msg.message_type === "voice") return "🎤 " + (t.voiceMessage || "رسالة صوتية");
    return msg.content?.substring(0, 40) || "";
  };

  const getTime = (contactId: string) => {
    const msg = lastMessages[contactId];
    if (!msg) return "";
    const d = new Date(msg.created_at);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div className="space-y-1">
      {sorted.map((contact: any, i: number) => {
        const unread = unreadCounts[contact.id] || 0;
        const isSelected = selectedId === contact.id;
        const Icon = contactTypeIcon(contact.contactType);
        const colorClass = contactTypeColor(contact.contactType);
        return (
          <motion.button
            key={contact.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => onSelect(contact)}
            className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-right ${
              isSelected ? "bg-primary/10 border border-primary/20 shadow-sm" : "hover:bg-muted/50 border border-transparent"
            }`}
          >
            <div className="relative">
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                isSelected ? "bg-primary text-primary-foreground" : colorClass
              }`}>
                <Icon className="h-5 w-5" />
              </div>
              {/* LED Status Indicator */}
              <div className={`absolute bottom-0 end-0 h-3.5 w-3.5 rounded-full border-2 border-background shadow-md z-10 ${
                isUserOnline(contact.lastSeen)
                  ? "bg-green-500 animate-pulse shadow-green-500/50"
                  : "bg-red-500 shadow-red-500/50"
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className={`font-semibold font-cairo text-sm truncate ${unread > 0 ? "text-foreground" : "text-foreground/80"}`}>{contact.name}</h4>
                <span className={`text-[10px] shrink-0 ${unread > 0 ? "text-primary font-bold" : "text-muted-foreground"}`}>{getTime(contact.id)}</span>
              </div>
              <div className="flex items-center gap-2 justify-between">
                <p className="text-xs text-muted-foreground font-cairo truncate flex-1">{contact.subtitle}</p>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`inline-block h-2 w-2 rounded-full ${
                    isUserOnline(contact.lastSeen)
                      ? "bg-green-500 animate-pulse"
                      : "bg-red-500"
                  }`} />
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-cairo font-medium ${
                    isUserOnline(contact.lastSeen)
                      ? "bg-green-500/20 text-green-600 dark:text-green-400"
                      : "bg-red-500/20 text-red-600 dark:text-red-400"
                  }`}>
                    {isUserOnline(contact.lastSeen) ? "متصل" : "غير متصل"}
                  </span>
                </div>
              </div>
              {contact.childNames?.length > 0 && (
                <p className="text-[10px] text-primary/70 font-cairo truncate">{contact.childNames.join("، ")}</p>
              )}
              {getPreview(contact.id) && (
                <p className={`text-xs font-cairo truncate mt-0.5 ${unread > 0 ? "text-foreground/70 font-medium" : "text-muted-foreground/70"}`}>{getPreview(contact.id)}</p>
              )}
            </div>
            {unread > 0 && (
              <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-5 min-w-5 flex items-center justify-center px-1.5 shrink-0">
                {unread}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
};
