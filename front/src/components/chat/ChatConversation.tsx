import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { isUserOnline } from "@/hooks/usePresence";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { crudApi } from "@/lib/api";
import { uploadMedia } from "@/lib/apiClient";
import { ArrowRight, Send, Image, Mic, X, Check, CheckCheck, Pencil, Trash2, Trash, MoreVertical } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Convert backend URLs to full accessible URLs
const API_BASE_CHAT = import.meta.env.VITE_API_URL || 'http://localhost:3003/api';

// Get token from localStorage (same as in apiClient)
const getTokenForMedia = (): string | null => {
  return localStorage.getItem('accessToken') || localStorage.getItem('auth_token');
};

const getMediaUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (url.startsWith('blob:')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  
  // Handle both /api/files/... (SeaweedFS) and /api/uploads/... (legacy local) paths
  let fullUrl = url;
  if (url.startsWith('/api/')) {
    const backendOrigin = API_BASE_CHAT.replace(/\/api\/?$/, '');
    fullUrl = `${backendOrigin}${url}`;
  } else if (url.startsWith('/')) {
    const backendOrigin = API_BASE_CHAT.replace(/\/api\/?$/, '');
    fullUrl = `${backendOrigin}${url}`;
  }
  
  // Add token as query parameter for authentication (for img tags and audio elements)
  // This allows images to be displayed even when token is not in headers
  if (fullUrl.includes('/api/files/')) {
    const token = getTokenForMedia();
    if (token && !fullUrl.includes('?token=')) {
      fullUrl += (fullUrl.includes('?') ? '&' : '?') + `token=${token}`;
    }
  }
  
  return fullUrl;
};

interface ChatConversationProps {
  contact: any;
  currentUserId: string;
  onBack: () => void;
  onMessagesUpdate: () => void;
  t: any;
  dir: string;
}

export const ChatConversation = ({ contact, currentUserId, onBack, onMessagesUpdate, t, dir }: ChatConversationProps) => {
  const { playMessageSound, playReceivedMessageSound } = useNotificationSound();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{ file: File; type: string; url: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimerRef = useRef<any>(null);
  const previousMessageCountRef = useRef<number>(0);

  // Edit & Delete states
  const [editingMsg, setEditingMsg] = useState<any>(null);
  const [editText, setEditText] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "single" | "all"; msgId?: string } | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const data = await crudApi.getAll("messages");
      if (data && Array.isArray(data)) {
        const filtered = data.filter(m =>
          (m.sender_id === currentUserId && m.receiver_id === contact.id) ||
          (m.sender_id === contact.id && m.receiver_id === currentUserId)
        ).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        // Play sound if new messages from contact received
        if (filtered.length > previousMessageCountRef.current) {
          const newMessages = filtered.slice(previousMessageCountRef.current);
          const hasNewFromContact = newMessages.some(m => m.sender_id === contact.id && !m.read);
          if (hasNewFromContact) {
            playReceivedMessageSound();
          }
        }
        
        previousMessageCountRef.current = filtered.length;
        setMessages(filtered);
      }
    } catch (err) {
      console.error("[Chat] Fetch messages error:", err);
    }
  }, [currentUserId, contact.id, playReceivedMessageSound]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);
  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Mark received messages as read
  useEffect(() => {
    const unread = messages.filter(m => m.sender_id === contact.id && !m.read);
    if (unread.length > 0) {
      Promise.all(unread.map(m =>
        crudApi.update("messages", m.id, { read: true })
      )).then(() => onMessagesUpdate()).catch(err => console.error("[Chat] Error marking read:", err));
    }
  }, [messages, contact.id, onMessagesUpdate]);

  // Poll for new messages
  useEffect(() => {
    const pollingInterval = setInterval(() => {
      fetchMessages();
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollingInterval);
  }, [fetchMessages]);

  const sendMessage = async (content?: string | null, messageType = "text", mediaUrl?: string, mediaType?: string) => {
    setSending(true);
    try {
      // Update presence before sending message
      await crudApi.custom('/presence', {
        method: 'POST',
        body: JSON.stringify({
          user_id: currentUserId,
          last_seen: new Date().toISOString()
        })
      }).catch(() => {}); // Silently fail if presence update fails
      
      await crudApi.insert("messages", {
        sender_id: currentUserId,
        receiver_id: contact.id,
        content: content || null,
        message_type: messageType,
        media_url: mediaUrl || null,
        media_type: mediaType || null,
        read: false,
      });
      playMessageSound();
      onMessagesUpdate();
    } catch (err) {
      console.error("[Chat] Send message error:", err);
      toast.error(t.sendError || "خطأ في إرسال الرسالة");
    }
    setSending(false);
  };

  const handleSendText = async () => {
    if (!text.trim() && !mediaPreview) return;
    if (mediaPreview) {
      try {
        console.log("[Chat] Uploading media:", mediaPreview.file.name);
        const url = await uploadMedia(mediaPreview.file);
        console.log("[Chat] Upload successful, URL:", url);
        if (url) {
          await sendMessage(text.trim() || null, mediaPreview.type, url, mediaPreview.file.type);
        }
        setMediaPreview(null);
      } catch (err) {
        console.error("[Chat] Upload error:", err);
        toast.error(t.uploadError || "خطأ في تحميل الملف");
      }
    } else {
      await sendMessage(text.trim());
    }
    setText("");
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error(t.fileTooLarge || "الملف كبير جداً"); return; }
    setMediaPreview({ file, type: "image", url: URL.createObjectURL(file) });
  };

  // Edit message
  const handleEditMessage = async () => {
    if (!editingMsg || !editText.trim()) return;
    try {
      await crudApi.update("messages", editingMsg.id, { content: editText.trim() });
      setMessages(prev => prev.map(m => m.id === editingMsg.id ? { ...m, content: editText.trim() } : m));
      toast.success(t.messageEdited || "تم تعديل الرسالة");
      onMessagesUpdate();
    } catch (err) {
      console.error("[Chat] Edit message error:", err);
      toast.error(t.editError || "خطأ في تعديل الرسالة");
    }
    setEditingMsg(null);
    setEditText("");
  };

  // Delete single message
  const handleDeleteMessage = async (msgId: string) => {
    try {
      await crudApi.delete("messages", msgId);
      setMessages(prev => prev.filter(m => m.id !== msgId));
      toast.success(t.messageDeleted || "تم حذف الرسالة");
      onMessagesUpdate();
    } catch (err) {
      console.error("[Chat] Delete message error:", err);
      toast.error(t.deleteError || "خطأ في حذف الرسالة");
    }
    setDeleteConfirm(null);
  };

  // Delete all messages in this conversation (only my sent messages)
  const handleDeleteAllMessages = async () => {
    const myMessages = messages.filter(m => m.sender_id === currentUserId);
    if (myMessages.length === 0) { setDeleteConfirm(null); return; }
    try {
      let deleted = 0;
      for (const m of myMessages) {
        try {
          await crudApi.delete("messages", m.id);
          deleted++;
        } catch (err) {
          console.error("[Chat] Error deleting message:", err);
        }
      }
      setMessages(prev => prev.filter(m => m.sender_id !== currentUserId));
      toast.success(`${t.messagesDeleted || "تم حذف"} ${deleted} ${t.messagesCount || "رسالة"}`);
      onMessagesUpdate();
    } catch (err) {
      console.error("[Chat] Delete all error:", err);
      toast.error("خطأ في حذف الرسائل");
    }
    setDeleteConfirm(null);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
        const url = await uploadMedia(file);
        if (url) await sendMessage(null, "voice", url, "audio/webm");
        setRecordingTime(0);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      toast.error(t.micPermissionDenied || "لم يتم السماح بالميكروفون");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    clearInterval(recordingTimerRef.current);
  };

  const cancelRecording = () => {
    mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop());
    mediaRecorderRef.current = null;
    setRecording(false);
    setRecordingTime(0);
    clearInterval(recordingTimerRef.current);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const groupMessagesByDate = () => {
    const groups: { date: string; msgs: any[] }[] = [];
    messages.forEach(m => {
      const d = new Date(m.created_at).toLocaleDateString();
      const last = groups[groups.length - 1];
      if (last && last.date === d) last.msgs.push(m);
      else groups.push({ date: d, msgs: [m] });
    });
    return groups;
  };

  const myMessagesCount = messages.filter(m => m.sender_id === currentUserId).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header - Messenger style */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/20 bg-card/80 backdrop-blur-sm">
        <button onClick={onBack} className="md:hidden rounded-full p-1.5 hover:bg-muted/50 transition-colors">
          <ArrowRight className="h-5 w-5 text-foreground" />
        </button>
        <div className="relative">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[hsl(262,85%,58%)] to-[hsl(230,85%,55%)] flex items-center justify-center text-white font-bold text-sm shrink-0">
            {contact.name?.charAt(0)}
          </div>
          {isUserOnline(contact.lastSeen) && (
            <div className="absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-card" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold font-cairo text-sm text-foreground truncate">{contact.name}</h3>
          <p className={`text-[11px] font-cairo ${isUserOnline(contact.lastSeen) ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
            {isUserOnline(contact.lastSeen) ? (t.online || "متصل") : (t.offline || "غير متصل")}
          </p>
        </div>

        {myMessagesCount > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-9 w-9 rounded-full hover:bg-muted/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                <MoreVertical className="h-4.5 w-4.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px]">
              <DropdownMenuItem
                onClick={() => setDeleteConfirm({ type: "all" })}
                className="text-destructive focus:text-destructive gap-2 font-cairo"
              >
                <Trash className="h-4 w-4" />
                {t.deleteAllMessages || "حذف كل رسائلي"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1" style={{ background: 'linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--muted)/0.3) 100%)' }}>
        {groupMessagesByDate().map(group => (
          <div key={group.date}>
            <div className="flex justify-center my-4">
              <span className="text-[11px] bg-muted/60 text-muted-foreground px-4 py-1.5 rounded-full font-cairo font-medium">
                {group.date}
              </span>
            </div>
            {group.msgs.map((msg, i) => {
              const isMine = msg.sender_id === currentUserId;
              const isLast = i === group.msgs.length - 1 || group.msgs[i + 1]?.sender_id !== msg.sender_id;
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.01, duration: 0.15 }}
                  className={`flex ${isLast ? "mb-3" : "mb-0.5"} group ${isMine ? "justify-start" : "justify-end"}`}
                >
                  {/* Contact avatar on received messages */}
                  {!isMine && isLast ? (
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-[11px] font-bold shrink-0 self-end mb-0.5 me-1.5">
                      {contact.name?.charAt(0)}
                    </div>
                  ) : !isMine ? (
                    <div className="w-7 shrink-0 me-1.5" />
                  ) : null}

                  {/* Actions for own messages */}
                  {isMine && (
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity mx-1 gap-0.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-6 w-6 rounded-full hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all">
                            <MoreVertical className="h-3 w-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" side="top" className="min-w-[160px]">
                          {msg.message_type === "text" && msg.content && (
                            <DropdownMenuItem
                              onClick={() => { setEditingMsg(msg); setEditText(msg.content || ""); }}
                              className="gap-2 font-cairo"
                            >
                              <Pencil className="h-3.5 w-3.5 text-primary" />
                              <span>{t.editMessage || "تعديل"}</span>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => setDeleteConfirm({ type: "single", msgId: msg.id })}
                            className="text-destructive focus:text-destructive gap-2 font-cairo"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>{t.deleteMessage || "حذف"}</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}

                  <div className={`max-w-[70%] px-3 py-2 ${
                    isMine
                      ? `bg-gradient-to-br from-[hsl(262,85%,58%)] to-[hsl(230,85%,55%)] text-white ${isLast ? "rounded-[18px_18px_4px_18px]" : "rounded-[18px_18px_4px_18px]"}`
                      : `bg-muted/70 dark:bg-muted/50 text-foreground ${isLast ? "rounded-[18px_18px_18px_4px]" : "rounded-[18px_18px_18px_4px]"}`
                  }`}>
                    {msg.message_type === "image" && msg.media_url && (
                      <img src={getMediaUrl(msg.media_url) || ''} alt="" className="rounded-xl max-w-full max-h-60 object-cover mb-1 cursor-pointer"
                        onClick={() => window.open(getMediaUrl(msg.media_url) || '', "_blank")} />
                    )}
                    {msg.message_type === "voice" && msg.media_url && (
                      <audio src={getMediaUrl(msg.media_url) || ''} controls className="max-w-[240px]" />
                    )}
                    {msg.content && (
                      <p className="text-[14px] font-cairo whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                    )}

                    {/* Time & Read receipts */}
                    <div className={`flex items-center gap-1 mt-0.5 ${isMine ? "justify-start" : "justify-end"}`}>
                      <span className={`text-[10px] ${isMine ? "text-white/50" : "text-muted-foreground/70"}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {isMine && (
                        msg.read
                          ? <CheckCheck className="h-3 w-3 text-white/70" />
                          : <Check className="h-3 w-3 text-white/40" />
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Media Preview */}
      <AnimatePresence>
        {mediaPreview && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="border-t border-border/30 p-3 bg-card">
            <div className="relative inline-block">
              <img src={mediaPreview.url} className="h-24 rounded-xl object-cover" />
              <button onClick={() => setMediaPreview(null)}
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                <X className="h-3 w-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input - Messenger style */}
      <div className="px-3 py-2.5 border-t border-border/20 bg-card/80 backdrop-blur-sm">
        {recording ? (
          <div className="flex items-center gap-3">
            <button onClick={cancelRecording} className="h-9 w-9 rounded-full bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-colors">
              <X className="h-4 w-4" />
            </button>
            <div className="flex-1 flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm font-cairo font-medium text-destructive">{formatTime(recordingTime)}</span>
              <span className="text-xs text-muted-foreground font-cairo">{t.recording || "جاري التسجيل..."}</span>
            </div>
            <button onClick={stopRecording}
              className="h-9 w-9 rounded-full bg-gradient-to-br from-[hsl(262,85%,58%)] to-[hsl(230,85%,55%)] text-white flex items-center justify-center hover:opacity-90 transition-opacity">
              <Send className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            <button onClick={() => fileInputRef.current?.click()}
              className="h-8 w-8 rounded-full hover:bg-muted/60 flex items-center justify-center text-[hsl(262,85%,58%)] hover:text-[hsl(262,85%,48%)] transition-colors"
              title={t.sendImage || "صورة"}>
              <Image className="h-5 w-5" />
            </button>
            <button onClick={startRecording}
              className="h-8 w-8 rounded-full hover:bg-muted/60 flex items-center justify-center text-[hsl(262,85%,58%)] hover:text-[hsl(262,85%,48%)] transition-colors"
              title={t.recordVoice || "تسجيل صوتي"}>
              <Mic className="h-5 w-5" />
            </button>
            <div className="flex-1">
              <input
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSendText()}
                placeholder={t.typeMessage || "Aa"}
                className="w-full bg-muted/50 rounded-full px-4 py-2 text-sm outline-none font-cairo placeholder:text-muted-foreground/50 focus:bg-muted/70 transition-all"
              />
            </div>
            <button
              onClick={handleSendText}
              disabled={sending || (!text.trim() && !mediaPreview)}
              className="h-8 w-8 rounded-full flex items-center justify-center text-[hsl(262,85%,58%)] hover:text-[hsl(262,85%,48%)] transition-colors disabled:opacity-30"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {/* Edit Message Dialog */}
      <Dialog open={!!editingMsg} onOpenChange={(open) => { if (!open) { setEditingMsg(null); setEditText(""); } }}>
        <DialogContent className="sm:max-w-md" dir={dir}>
          <DialogHeader>
            <DialogTitle className="font-cairo">{t.editMessage || "تعديل الرسالة"}</DialogTitle>
            <DialogDescription className="font-cairo text-muted-foreground">
              {t.editMessageDesc || "قم بتعديل نص الرسالة"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full bg-muted/40 border border-border/30 rounded-xl px-4 py-3 text-sm outline-none font-cairo focus:ring-2 focus:ring-primary/20 transition-all min-h-[100px] resize-none"
              dir={dir}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setEditingMsg(null); setEditText(""); }} className="font-cairo">
              {t.cancel || "إل��اء"}
            </Button>
            <Button onClick={handleEditMessage} disabled={!editText.trim()} className="font-cairo gap-2">
              <Pencil className="h-4 w-4" />
              {t.save || "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent className="sm:max-w-sm" dir={dir}>
          <DialogHeader>
            <DialogTitle className="font-cairo text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              {deleteConfirm?.type === "all"
                ? (t.deleteAllMessages || "حذف كل رسائلي")
                : (t.deleteMessage || "حذف الرسالة")}
            </DialogTitle>
            <DialogDescription className="font-cairo text-muted-foreground">
              {deleteConfirm?.type === "all"
                ? (t.deleteAllConfirm || `هل تريد حذف جميع رسائلك في هذه المحادثة؟ (${myMessagesCount} رسالة)`)
                : (t.deleteSingleConfirm || "هل تريد حذف هذه الرسالة؟ لا يمكن التراجع عن هذا الإجراء.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="font-cairo">
              {t.cancel || "إلغاء"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirm?.type === "all") handleDeleteAllMessages();
                else if (deleteConfirm?.msgId) handleDeleteMessage(deleteConfirm.msgId);
              }}
              className="font-cairo gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {t.confirmDelete || "حذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
