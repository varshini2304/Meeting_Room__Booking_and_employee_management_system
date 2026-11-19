import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  X,
  Send,
  RotateCcw,
  Bot,
  User,
  Calendar,
  Clock,
  Users,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Building2,
  Compass,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import {
  sendAiChatApi,
  confirmAiBookingApi,
  cancelAiBookingApi,
  cancelAiIntentApi,
  confirmAiAttendanceApi,
  confirmAiLeaveApi,
  PendingIntentCardData,
  CancellationCardData,
  AttendanceActionCardData,
  LeaveRequestCardData,
  NavigationData,
} from "@/api/ai";
import { useToast } from "@/components/ui/use-toast";
import { useOptionalAuth } from "@/contexts/AuthContext";

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  pendingIntentCard?: PendingIntentCardData | null;
  cancellationCard?: CancellationCardData | null;
  attendanceActionCard?: AttendanceActionCardData | null;
  leaveRequestCard?: LeaveRequestCardData | null;
  navigation?: NavigationData | null;
}

export const ALLOWED_EMPLOYEE_DESTINATIONS: Record<
  string,
  { path: string; label: string; description: string }
> = Object.freeze({
  dashboard: {
    path: "/dashboard",
    label: "Dashboard",
    description: "Main overview and room summaries",
  },
  "book-room": {
    path: "/book-room",
    label: "Book Room",
    description: "Meeting room reservation and search",
  },
  "my-bookings": {
    path: "/manage-bookings",
    label: "My Bookings",
    description: "Manage active room bookings",
  },
  "booking-history": {
    path: "/booking-history",
    label: "Booking History",
    description: "Past meeting reservations log",
  },
  attendance: {
    path: "/attendance",
    label: "My Attendance",
    description: "Punch clock and daily attendance logs",
  },
  leaves: {
    path: "/leaves",
    label: "My Leaves",
    description: "Leave balances, history, and applications",
  },
  notifications: {
    path: "/notifications",
    label: "Notifications",
    description: "Inbox notifications and alerts",
  },
  profile: {
    path: "/profile",
    label: "Profile",
    description: "Personal employee profile details",
  },
});

export const ALLOWED_MANAGER_DESTINATIONS: Record<
  string,
  { path: string; label: string; description: string }
> = Object.freeze({
  "manager-dashboard": {
    path: "/manager",
    label: "Manager Dashboard",
    description: "Manager overview and administrative controls",
  },
  "all-bookings": {
    path: "/manager/all-bookings",
    label: "All Bookings",
    description: "Enterprise meeting room bookings across all employees",
  },
  "room-availability": {
    path: "/manager/room-availability",
    label: "Room Availability",
    description: "Enterprise room occupancy and live schedule",
  },
  "manage-rooms": {
    path: "/manager/manage-rooms",
    label: "Manage Rooms",
    description: "Meeting room inventory and settings",
  },
  "manager-attendance": {
    path: "/manager/attendance",
    label: "Manager Attendance",
    description: "Organization live attendance board",
  },
  "manager-leaves": {
    path: "/manager/leaves",
    label: "Manager Leaves",
    description: "Employee leave approvals and management",
  },
  "manager-leave-balances": {
    path: "/manager/leaves/balances",
    label: "Manager Leave Balances",
    description: "Employee leave quota and balance overview",
  },
  "manager-notifications": {
    path: "/manager/notifications",
    label: "Manager Notifications",
    description: "Manager alerts and system notifications",
  },
  "manager-profile": {
    path: "/manager/profile",
    label: "Manager Profile",
    description: "Manager profile and account settings",
  },
});

const QUICK_PROMPTS = [
  "What is my next meeting?",
  "What meetings do I have today?",
  "Find a conference room for 8 people",
  "Show my notifications",
  "Do I have unread notifications?",
  "Show my profile",
  "Open my attendance",
  "Take me to my leaves",
  "What's my leave balance?",
  "Book a room for 5 tomorrow at 3 PM",
  "Available rooms in Bangalore",
  "Show my upcoming bookings",
];

const MANAGER_QUICK_PROMPTS = [
  "Show my notifications",
  "Show unread notifications",
  "Show my profile",
  "Who is on leave today?",
  "Show pending leave requests",
  "Show leave balances",
  "Show today's attendance",
  "Who hasn't checked in today?",
  "Who is late today?",
  "Show team attendance summary",
  "Show all bookings today",
  "Which rooms are available tomorrow at 10:00 AM?",
  "Open team attendance",
  "Open enterprise bookings",
  "Open leave approvals",
  "Open notifications",
  "Open my profile",
];

export function AiAssistant() {
  const navigate = useNavigate();
  const auth = useOptionalAuth();
  const role = auth?.role || "employee";
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(() => {
    return sessionStorage.getItem("meeting_ai_session_id") || undefined;
  });

  const [intentStates, setIntentStates] = useState<Record<string, { status: string; bookingId?: string; error?: string }>>({});
  const [cancellationStates, setCancellationStates] = useState<Record<string, { status: string; error?: string }>>({});
  const [attendanceStates, setAttendanceStates] = useState<Record<string, { status: string; record?: any; error?: string }>>({});
  const [leaveStates, setLeaveStates] = useState<Record<string, { status: string; leave?: any; error?: string }>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: "welcome-1",
          sender: "assistant",
          text: "Hello! I am your Meeting Room & Employee AI Assistant. I can help you find and book rooms, check attendance, or manage your leave requests. How can I help you today?",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  }, []);

  const handleNavigate = (path: string, destination: string) => {
    const verified = ALLOWED_EMPLOYEE_DESTINATIONS[destination] || ALLOWED_MANAGER_DESTINATIONS[destination];
    if (!verified || verified.path !== path) {
      toast({
        title: "Navigation Blocked",
        description: "Destination is not in the authorized navigation allowlist.",
        variant: "destructive",
      });
      return;
    }
    navigate(path);
    toast({
      title: "Navigation",
      description: `Opened ${verified.label}`,
    });
  };

  const handleSendMessage = async (textToSend?: string) => {
    const message = (textToSend || inputValue).trim();
    if (!message || isLoading) return;

    const userMsg: ChatMessage = {
      id: "msg_" + Date.now(),
      sender: "user",
      text: message,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await sendAiChatApi({ message, sessionId });

      if (response.sessionId) {
        setSessionId(response.sessionId);
        sessionStorage.setItem("meeting_ai_session_id", response.sessionId);
      }

      const assistantMsg: ChatMessage = {
        id: "msg_ai_" + Date.now(),
        sender: "assistant",
        text: response.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        pendingIntentCard: response.pendingIntentCard,
        cancellationCard: response.cancellationCard,
        attendanceActionCard: response.attendanceActionCard,
        leaveRequestCard: response.leaveRequestCard,
        navigation: response.navigation,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error: any) {
      const detail = error?.message ? `: ${error.message}` : "";
      const errorMsg: ChatMessage = {
        id: "msg_err_" + Date.now(),
        sender: "assistant",
        text: `I encountered an error communicating with the AI service${detail}. Please check backend connectivity or try again.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
      toast({
        title: "AI Service Error",
        description: error.message || "Failed to reach AI service",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleResetConversation = () => {
    sessionStorage.removeItem("meeting_ai_session_id");
    setSessionId(undefined);
    setIntentStates({});
    setCancellationStates({});
    setAttendanceStates({});
    setLeaveStates({});
    setMessages([
      {
        id: "welcome-reset",
        sender: "assistant",
        text: "Conversation reset. How can I assist you today?",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    toast({
      title: "Conversation Reset",
      description: "Started a fresh conversation session.",
    });
  };

  const handleConfirmBooking = async (intentId: string) => {
    setIntentStates((prev) => ({ ...prev, [intentId]: { status: "confirming" } }));
    try {
      const result = await confirmAiBookingApi(intentId);
      setIntentStates((prev) => ({
        ...prev,
        [intentId]: { status: "confirmed", bookingId: result.booking.bookingId },
      }));
      toast({
        title: "Booking Confirmed!",
        description: `Room ${result.booking.roomNumber} reserved for ${result.booking.date} at ${result.booking.startTime}.`,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: "sys_conf_" + Date.now(),
          sender: "assistant",
          text: `Success! Room **${result.booking.roomNumber}** has been officially booked (${result.booking.date} from ${result.booking.startTime} to ${result.booking.endTime}).`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch (error: any) {
      setIntentStates((prev) => ({
        ...prev,
        [intentId]: { status: "error", error: error.message || "Confirmation failed" },
      }));
      toast({
        title: "Confirmation Failed",
        description: error.message || "Slot is no longer available or intent has expired.",
        variant: "destructive",
      });
    }
  };

  const handleDismissIntent = async (intentId: string) => {
    try {
      await cancelAiIntentApi(intentId);
    } finally {
      setIntentStates((prev) => ({ ...prev, [intentId]: { status: "dismissed" } }));
    }
  };

  const handleConfirmCancellation = async (bookingId: string) => {
    setCancellationStates((prev) => ({ ...prev, [bookingId]: { status: "cancelling" } }));
    try {
      const res = await cancelAiBookingApi(bookingId);
      setCancellationStates((prev) => ({ ...prev, [bookingId]: { status: "cancelled" } }));
      toast({
        title: "Reservation Cancelled",
        description: "Your meeting room booking has been successfully cancelled.",
      });
      setMessages((prev) => [
        ...prev,
        {
          id: "sys_cancel_" + Date.now(),
          sender: "assistant",
          text: `The reservation on ${res.booking.date} at ${res.booking.startTime} has been successfully cancelled and the room has been released.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch (error: any) {
      setCancellationStates((prev) => ({
        ...prev,
        [bookingId]: { status: "error", error: error.message || "Cancellation failed" },
      }));
      toast({
        title: "Cancellation Failed",
        description: error.message || "Unable to cancel booking.",
        variant: "destructive",
      });
    }
  };

  const handleConfirmAttendance = async (card: AttendanceActionCardData) => {
    setAttendanceStates((prev) => ({ ...prev, [card.intentId]: { status: "confirming" } }));
    try {
      const response = await confirmAiAttendanceApi(card.intentId);
      setAttendanceStates((prev) => ({
        ...prev,
        [card.intentId]: { status: "confirmed", record: response.record },
      }));
      toast({
        title: card.action === "PUNCH_IN" ? "Punched In Successfully" : "Punched Out Successfully",
        description: `Your attendance punch for ${card.date} has been recorded.`,
      });
    } catch (error: any) {
      setAttendanceStates((prev) => ({
        ...prev,
        [card.intentId]: { status: "error", error: error.message || "Failed to confirm attendance punch." },
      }));
      toast({
        title: "Punch Confirmation Failed",
        description: error.message || "Unable to confirm attendance punch.",
        variant: "destructive",
      });
    }
  };

  const handleConfirmLeave = async (card: LeaveRequestCardData) => {
    setLeaveStates((prev) => ({ ...prev, [card.intentId]: { status: "confirming" } }));
    try {
      const response = await confirmAiLeaveApi(card.intentId);
      setLeaveStates((prev) => ({
        ...prev,
        [card.intentId]: { status: "confirmed", leave: response.leave },
      }));
      toast({
        title: "Leave Application Submitted",
        description: `Your ${card.leaveType} leave request for ${card.startDate} to ${card.endDate} has been submitted for manager approval.`,
      });
    } catch (error: any) {
      setLeaveStates((prev) => ({
        ...prev,
        [card.intentId]: { status: "error", error: error.message || "Failed to confirm leave application." },
      }));
      toast({
        title: "Leave Submission Failed",
        description: error.message || "Unable to submit leave request.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-full shadow-xl shadow-primary/25 transition-all"
          aria-label="Open AI Assistant"
        >
          <div className="relative">
            <Sparkles className="w-5 h-5 animate-pulse text-sky-200" />
          </div>
          <span className="text-sm font-semibold tracking-wide">AI Assistant</span>
          <Badge className="bg-white/20 text-white text-[10px] px-1.5 py-0.5 border-0 font-medium">
            AI v2.2
          </Badge>
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[450px] max-w-[calc(100vw-1.5rem)] h-[650px] max-h-[calc(100vh-3.5rem)] flex flex-col bg-background border border-border/80 rounded-2xl shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white select-none">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center backdrop-blur-sm border border-white/20">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm tracking-tight">AI Assistant</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <p className="text-[11px] text-white/80">Deterministic Booking Boundary</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleResetConversation}
                title="Reset conversation session"
                className="h-8 w-8 text-white/90 hover:text-white hover:bg-white/20 rounded-full"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                title="Close AI Assistant"
                className="h-8 w-8 text-white/90 hover:text-white hover:bg-white/20 rounded-full"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="bg-muted/60 px-3.5 py-1.5 border-b border-border/40 text-[11px] text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-medium">Deterministic Confirmations Only</span>
            </span>
            <span className="text-[10px] font-mono opacity-80 bg-background/60 px-1.5 py-0.5 rounded border border-border/40">30-min slots</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm bg-muted/15">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.sender === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5 border border-primary/20 shadow-2xs">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div className="flex flex-col max-w-[88%] space-y-2">
                  <div
                    className={`rounded-2xl px-4 py-3 shadow-xs leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-none ml-auto"
                        : "bg-card text-card-foreground border border-border/70 rounded-tl-none shadow-2xs"
                    }`}
                  >
                    <FormattedMessage text={msg.text} isUser={msg.sender === "user"} />
                    <span
                      className={`block text-[10px] mt-1.5 ${
                        msg.sender === "user" ? "text-primary-foreground/70 text-right" : "text-muted-foreground/70"
                      }`}
                    >
                      {msg.timestamp}
                    </span>
                  </div>

                  {msg.pendingIntentCard && (
                    <PendingIntentCardItem
                      card={msg.pendingIntentCard}
                      state={intentStates[msg.pendingIntentCard.intentId]}
                      onConfirm={() => handleConfirmBooking(msg.pendingIntentCard!.intentId)}
                      onDismiss={() => handleDismissIntent(msg.pendingIntentCard!.intentId)}
                    />
                  )}

                  {msg.cancellationCard && (
                    <CancellationCardItem
                      card={msg.cancellationCard}
                      state={cancellationStates[msg.cancellationCard.bookingId]}
                      onConfirm={() => handleConfirmCancellation(msg.cancellationCard!.bookingId)}
                    />
                  )}

                  {msg.attendanceActionCard && (
                    <AttendanceActionCardItem
                      card={msg.attendanceActionCard}
                      state={attendanceStates[msg.attendanceActionCard.intentId]}
                      onConfirm={() => handleConfirmAttendance(msg.attendanceActionCard!)}
                    />
                  )}

                  {msg.leaveRequestCard && (
                    <LeaveRequestCardItem
                      card={msg.leaveRequestCard}
                      state={leaveStates[msg.leaveRequestCard.intentId]}
                      onConfirm={() => handleConfirmLeave(msg.leaveRequestCard!)}
                    />
                  )}

                  {msg.navigation && (
                    <NavigationActionCardItem
                      card={msg.navigation}
                      onNavigate={handleNavigate}
                    />
                  )}
                </div>

                {msg.sender === "user" && (
                  <div className="w-7 h-7 rounded-full bg-slate-700 text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-2xs">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}

            {messages.length <= 1 && !isLoading && (
              <div className="pt-2 space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>Popular Quick Actions</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(role === "manager"
                    ? [
                        { label: "Leave Approvals", icon: "🌴", prompt: "Show pending leave requests" },
                        { label: "Today's Attendance", icon: "📅", prompt: "Show today's attendance" },
                        { label: "Who is on Leave?", icon: "👥", prompt: "Who is on leave today?" },
                        { label: "Leave Balances", icon: "⚖️", prompt: "Show leave balances" },
                        { label: "My Notifications", icon: "🔔", prompt: "Show my notifications" },
                        { label: "My Profile", icon: "👤", prompt: "Show my profile" },
                      ]
                    : [
                        { label: "Next Meeting", icon: "⏰", prompt: "What is my next meeting?" },
                        { label: "Book a Room", icon: "🏢", prompt: "Book a room for 5 tomorrow at 3 PM" },
                        { label: "My Attendance", icon: "📅", prompt: "Open my attendance" },
                        { label: "My Leaves", icon: "🌴", prompt: "Take me to my leaves" },
                        { label: "Leave Balance", icon: "⚖️", prompt: "What's my leave balance?" },
                        { label: "Notifications", icon: "🔔", prompt: "Show my notifications" },
                      ]
                  ).map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(item.prompt)}
                      className="p-2.5 rounded-xl border border-border/70 bg-card hover:bg-primary/5 hover:border-primary/40 text-left transition-all group flex flex-col justify-between gap-1"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{item.icon}</span>
                        <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                          {item.label}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground line-clamp-1">
                        "{item.prompt}"
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground text-xs p-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center animate-pulse">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <span>Analyzing rooms & availability...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {!isLoading && (
            <div
              className="px-3 py-2 border-t border-border/40 bg-muted/20 flex items-center gap-1.5 overflow-x-auto select-none flex-nowrap"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 flex-shrink-0 mr-1">
                <Sparkles className="w-3 h-3 text-primary" />
                <span>Suggestions:</span>
              </div>
              {(role === "manager" ? MANAGER_QUICK_PROMPTS : QUICK_PROMPTS).map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(prompt)}
                  className="text-[11px] whitespace-nowrap bg-background hover:bg-primary/10 hover:text-primary hover:border-primary/40 text-muted-foreground px-2.5 py-1 rounded-full border border-border/70 transition-colors flex-shrink-0"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <div className="p-3 border-t border-border/70 bg-background flex items-center gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventEvent();
                  handleSendMessage();
                }
              }}
              placeholder="Ask me to find, book, or check rooms..."
              className="text-sm h-10 rounded-xl focus-visible:ring-primary"
              disabled={isLoading}
            />
            <Button
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || isLoading}
              size="icon"
              className="h-10 w-10 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl flex-shrink-0 transition-colors"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function PendingIntentCardItem({
  card,
  state,
  onConfirm,
  onDismiss,
}: {
  card: PendingIntentCardData;
  state?: { status: string; bookingId?: string; error?: string };
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const isConfirmed = state?.status === "confirmed";
  const isConfirming = state?.status === "confirming";
  const isDismissed = state?.status === "dismissed";
  const isError = state?.status === "error";

  if (isDismissed) {
    return (
      <div className="p-2 text-xs text-muted-foreground bg-muted/40 rounded-lg border border-dashed text-center">
        Reservation offer dismissed.
      </div>
    );
  }

  return (
    <Card className="border-primary/20 shadow-md overflow-hidden bg-card">
      <CardHeader className="bg-primary/5 px-3.5 py-2.5 border-b border-primary/10 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-1.5">
          <Building2 className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm font-semibold text-foreground">Room {card.roomNumber}</CardTitle>
          <Badge variant="outline" className="text-[10px] font-normal py-0">{card.roomType}</Badge>
        </div>
        <Badge className="bg-primary/10 text-primary border border-primary/20 text-[10px]">Action Required</Badge>
      </CardHeader>
      <CardContent className="p-3.5 space-y-2 text-xs">
        <div className="grid grid-cols-2 gap-2 text-muted-foreground">
          <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-primary" /><span className="font-medium text-foreground">{card.date}</span></div>
          <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-primary" /><span className="font-medium text-foreground">{card.startTime} – {card.endTime}</span></div>
        </div>
        <div className="flex items-center justify-between text-muted-foreground pt-1 border-t border-border/40">
          <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-primary" /><span>{card.branch} {card.floor ? `(${card.floor})` : ""}</span></div>
          <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-primary" /><span>{card.attendeeCount} Attendees</span></div>
        </div>
        {card.requestedAmenities?.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {card.requestedAmenities.map((a, i) => <span key={i} className="bg-secondary text-secondary-foreground border border-border text-[10px] px-1.5 py-0.5 rounded">{a}</span>)}
          </div>
        )}
        {isError && <div className="flex items-center gap-1.5 p-2 rounded bg-destructive/10 text-destructive text-[11px]"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /><span>{state?.error || "This reservation recommendation is no longer available."}</span></div>}
        {isConfirmed && <div className="flex items-center gap-1.5 p-2 rounded bg-emerald-500/10 text-emerald-600 text-[11px] font-medium"><CheckCircle2 className="w-4 h-4 flex-shrink-0" /><span>Booking confirmed! (ID: {state?.bookingId})</span></div>}
      </CardContent>
      {!isConfirmed && (
        <CardFooter className="px-3.5 py-2.5 bg-muted/30 border-t border-border/40 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onDismiss} disabled={isConfirming} className="h-8 text-xs text-muted-foreground hover:text-foreground">Dismiss</Button>
          <Button size="sm" onClick={onConfirm} disabled={isConfirming || isError} className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium flex items-center gap-1.5 px-3 shadow-sm"><CheckCircle2 className="w-3.5 h-3.5" /><span>{isConfirming ? "Confirming..." : "Confirm Booking"}</span></Button>
        </CardFooter>
      )}
    </Card>
  );
}

function CancellationCardItem({ card, state, onConfirm }: { card: CancellationCardData; state?: { status: string; error?: string }; onConfirm: () => void }) {
  const isCancelled = state?.status === "cancelled";
  const isCancelling = state?.status === "cancelling";
  const isError = state?.status === "error";

  return (
    <Card className="border-amber-200 dark:border-amber-950/40 shadow-sm overflow-hidden bg-card/90">
      <CardHeader className="bg-amber-50/60 dark:bg-amber-950/20 px-3.5 py-2 border-b border-amber-100 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-semibold">Cancellation Confirmation</CardTitle>
        <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">Confirm to Cancel</Badge>
      </CardHeader>
      <CardContent className="p-3 space-y-1.5 text-xs">
        <div className="font-medium text-foreground">Room {card.roomNumber} ({card.branch})</div>
        <div className="text-muted-foreground flex items-center gap-2"><span>{card.date}</span><span>&middot;</span><span>{card.startTime} – {card.endTime}</span></div>
        {isError && <div className="flex items-center gap-1.5 p-1.5 rounded bg-destructive/10 text-destructive text-[11px]"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /><span>{state?.error || "Failed to cancel reservation."}</span></div>}
        {isCancelled && <div className="flex items-center gap-1.5 p-1.5 rounded bg-emerald-500/10 text-emerald-600 text-[11px] font-medium"><CheckCircle2 className="w-4 h-4 flex-shrink-0" /><span>Reservation cancelled successfully.</span></div>}
      </CardContent>
      {!isCancelled && <CardFooter className="px-3 py-2 bg-muted/20 border-t border-border/40 flex justify-end"><Button size="sm" variant="destructive" onClick={onConfirm} disabled={isCancelling} className="h-7 text-xs px-3">{isCancelling ? "Cancelling..." : "Confirm Cancellation"}</Button></CardFooter>}
    </Card>
  );
}

function AttendanceActionCardItem({ card, state, onConfirm }: { card: AttendanceActionCardData; state?: { status: string; record?: any; error?: string }; onConfirm: () => void }) {
  const isConfirmed = state?.status === "confirmed";
  const isConfirming = state?.status === "confirming";
  const isError = state?.status === "error";
  const isPunchIn = card.action === "PUNCH_IN";

  return (
    <Card className="border-border/80 shadow-md overflow-hidden bg-card/95">
      <CardHeader className={`px-3.5 py-2.5 border-b flex flex-row items-center justify-between space-y-0 ${isPunchIn ? "bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-200/60" : "bg-blue-50/70 dark:bg-blue-950/25 border-blue-200/60"}`}>
        <div className="flex items-center gap-2"><div className={`w-5 h-5 rounded-full flex items-center justify-center ${isPunchIn ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}><Clock className="w-3 h-3" /></div><CardTitle className="text-xs font-semibold">{card.title}</CardTitle></div>
        <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">{isPunchIn ? "Punch In" : "Punch Out"}</Badge>
      </CardHeader>
      <CardContent className="p-3.5 space-y-2 text-xs">
        <div className="grid grid-cols-2 gap-2 text-muted-foreground"><div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-primary" /><span className="font-medium text-foreground">{card.date}</span></div><div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-primary" /><span className="font-medium text-foreground">{card.time}</span></div></div>
        {card.checkInTime && <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/40"><span>Punched In at: </span><span className="font-semibold text-foreground">{card.checkInTime}</span></div>}
        {isError && <div className="flex items-center gap-1.5 p-2 rounded bg-destructive/10 text-destructive text-[11px]"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /><span>{state?.error || "Failed to confirm attendance punch."}</span></div>}
        {isConfirmed && <div className="flex items-center gap-1.5 p-2 rounded bg-emerald-500/10 text-emerald-600 text-[11px] font-medium"><CheckCircle2 className="w-4 h-4 flex-shrink-0" /><span>{isPunchIn ? "Punched in successfully!" : "Punched out successfully!"}</span></div>}
      </CardContent>
      {!isConfirmed && <CardFooter className="px-3.5 py-2.5 bg-muted/30 border-t border-border/40 flex justify-end"><Button size="sm" onClick={onConfirm} disabled={isConfirming || isError} className={`h-8 text-xs font-medium flex items-center gap-1.5 px-3.5 shadow-sm text-white ${isPunchIn ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700"}`}><CheckCircle2 className="w-3.5 h-3.5" /><span>{isConfirming ? "Recording..." : card.actionText || (isPunchIn ? "Confirm Punch In" : "Confirm Punch Out")}</span></Button></CardFooter>}
    </Card>
  );
}

interface LeaveRequestCardItemProps { card: LeaveRequestCardData; state?: { status: string; leave?: any; error?: string }; onConfirm: () => void; }

function LeaveRequestCardItem({ card, state, onConfirm }: LeaveRequestCardItemProps) {
  const isConfirming = state?.status === "confirming";
  const isConfirmed = state?.status === "confirmed";
  const isError = state?.status === "error";
  const typeCap = card.leaveType.charAt(0).toUpperCase() + card.leaveType.slice(1);

  return (
    <Card className="border border-sky-300 dark:border-sky-800 bg-sky-50/20 dark:bg-sky-950/20 shadow-sm overflow-hidden mt-1">
      <CardHeader className="p-3.5 pb-2 flex flex-row items-center justify-between space-y-0"><div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full flex items-center justify-center bg-sky-100 text-sky-700"><Calendar className="w-3 h-3" /></div><CardTitle className="text-xs font-semibold">{card.title || `${typeCap} Leave Application`}</CardTitle></div><Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">{typeCap}</Badge></CardHeader>
      <CardContent className="p-3.5 space-y-2 text-xs"><div className="grid grid-cols-2 gap-2 text-muted-foreground"><div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-primary" /><span className="font-medium text-foreground">{card.startDate === card.endDate ? card.startDate : `${card.startDate} → ${card.endDate}`}</span></div><div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-primary" /><span className="font-medium text-foreground">{card.totalDays} business day{card.totalDays !== 1 ? "s" : ""}{card.isHalfDay ? " (Half Day)" : ""}</span></div></div>{card.reason && <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/40"><span className="font-medium text-foreground">Reason: </span><span>{card.reason}</span></div>}{isError && <div className="flex items-center gap-1.5 p-2 rounded bg-destructive/10 text-destructive text-[11px]"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /><span>{state?.error || "Failed to submit leave application."}</span></div>}{isConfirmed && <div className="flex items-center gap-1.5 p-2 rounded bg-emerald-500/10 text-emerald-600 text-[11px] font-medium"><CheckCircle2 className="w-4 h-4 flex-shrink-0" /><span>Leave application submitted! Awaiting manager approval.</span></div>}</CardContent>
      {!isConfirmed && <CardFooter className="px-3.5 py-2.5 bg-muted/30 border-t border-border/40 flex justify-end"><Button size="sm" onClick={onConfirm} disabled={isConfirming || isError} className="h-8 text-xs font-medium flex items-center gap-1.5 px-3.5 shadow-sm text-white bg-sky-600 hover:bg-sky-700"><CheckCircle2 className="w-3.5 h-3.5" /><span>{isConfirming ? "Submitting..." : card.actionText || "Confirm Leave Application"}</span></Button></CardFooter>}
    </Card>
  );
}

interface NavigationActionCardItemProps { card: NavigationData; onNavigate: (path: string, destination: string) => void; }

function NavigationActionCardItem({ card, onNavigate }: NavigationActionCardItemProps) {
  const allowed = ALLOWED_EMPLOYEE_DESTINATIONS[card.destination] || ALLOWED_MANAGER_DESTINATIONS[card.destination];
  const isValid = Boolean(allowed && allowed.path === card.path);
  return (
    <Card className="mt-2 text-xs border-indigo-200 dark:border-indigo-900 bg-gradient-to-br from-indigo-50/70 via-white to-sky-50/50">
      <CardHeader className="p-3 pb-2 border-b border-indigo-100 flex flex-row items-center justify-between"><div className="flex items-center gap-2"><div className="w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center shadow-sm"><Compass className="w-3.5 h-3.5" /></div><div><CardTitle className="text-xs font-semibold text-indigo-950">{card.label}</CardTitle><p className="text-[10px] text-muted-foreground">{allowed?.description || card.path}</p></div></div><Badge variant="outline" className="text-[10px] border-indigo-300 text-indigo-700 bg-indigo-50">Page</Badge></CardHeader>
      <CardContent className="p-3 pt-2 pb-2"><p className="text-[11px] text-slate-600">Ready to open <code className="px-1 py-0.5 rounded bg-slate-100 text-[10px]">{card.path}</code></p></CardContent>
      <CardFooter className="p-2 pt-0 flex justify-end"><Button size="sm" className="h-7 text-xs px-3 bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-sm" onClick={() => onNavigate(card.path, card.destination)} disabled={!isValid}><span>{card.actionText || `Open ${card.label}`}</span><ArrowRight className="w-3 h-3" /></Button></CardFooter>
    </Card>
  );
}

function FormattedMessage({ text, isUser }: { text: string; isUser: boolean }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5 leading-relaxed text-sm">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;
        if (trimmed.startsWith("### ")) { const title = trimmed.replace(/^###\s+/, ""); return <div key={idx} className="font-bold text-xs uppercase tracking-wider text-primary border-b border-border/50 pb-1 pt-2 mt-1"><span>{title}</span></div>; }
        if (trimmed.startsWith("## ")) { const title = trimmed.replace(/^##\s+/, ""); return <div key={idx} className="font-bold text-sm text-foreground border-b border-border/60 pb-1 pt-2 mt-1">{title}</div>; }
        if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) { const content = trimmed.replace(/^[-•]\s+/, ""); return <div key={idx} className="flex items-start gap-2 pl-0.5 my-1"><span className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${isUser ? "bg-white" : "bg-primary"}`} /><span className="flex-1">{renderInlineFormatting(content, isUser)}</span></div>; }
        const numMatch = trimmed.match(/^\(\d+\)\s+(.*)$/);
        if (numMatch) return <div key={idx} className="flex items-start gap-2 pl-0.5 my-1"><span className="flex-1">{renderInlineFormatting(numMatch[1], isUser)}</span></div>;
        return <p key={idx} className="my-0.5">{renderInlineFormatting(line, isUser)}</p>;
      })}
    </div>
  );
}

function renderInlineFormatting(str: string, isUser: boolean): React.ReactNode {
  const tokens = str.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
  return tokens.map((token, i) => {
    if (token.startsWith("**") && token.endsWith("**") && token.length >= 4) return <strong key={i} className={`font-semibold ${isUser ? "text-white font-bold" : "text-foreground font-semibold"}`}>{token.slice(2, -2)}</strong>;
    if (token.startsWith("*") && token.endsWith("*") && token.length >= 2) return <em key={i} className="italic opacity-90">{token.slice(1, -1)}</em>;
    if (token.startsWith("`") && token.endsWith("`") && token.length >= 2) return <code key={i} className={`px-1.5 py-0.5 rounded font-mono text-[11px] font-medium ${isUser ? "bg-white/20 text-white" : "bg-muted text-primary"}`}>{token.slice(1, -1)}</code>;
    return token;
  });
}
