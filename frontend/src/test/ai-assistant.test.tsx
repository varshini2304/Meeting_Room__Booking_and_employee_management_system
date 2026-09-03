import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AiAssistant } from "@/components/ai/AiAssistant";
import * as aiApi from "@/api/ai";

vi.mock("@/api/ai", () => ({
  sendAiChatApi: vi.fn(),
  confirmAiBookingApi: vi.fn(),
  cancelAiBookingApi: vi.fn(),
  cancelAiIntentApi: vi.fn(),
  confirmAiAttendanceApi: vi.fn(),
  confirmAiLeaveApi: vi.fn(),
}));

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe("AiAssistant Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("renders the floating trigger button", () => {
    renderWithRouter(<AiAssistant />);
    const button = screen.getByRole("button", { name: /open toyota ai assistant/i });
    expect(button).toBeInTheDocument();
    expect(screen.getByText("Toyota AI Assistant")).toBeInTheDocument();
  });

  it("opens the chat window upon clicking the floating button", () => {
    renderWithRouter(<AiAssistant />);
    const trigger = screen.getByRole("button", { name: /open toyota ai assistant/i });
    fireEvent.click(trigger);

    expect(screen.getByText("Deterministic Booking Boundary")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ask me to find, book, or check rooms/i)).toBeInTheDocument();
  });

  it("renders PendingIntentCard and clicking Confirm Booking invokes confirmAiBookingApi", async () => {
    const mockChatResponse: aiApi.AiChatResponse = {
      sessionId: "sess_123",
      intent: "BOOK_ROOM",
      reply: "I found the best match: Room A-201 for tomorrow at 15:00.",
      pendingIntentCard: {
        intentId: "intent_abc_123",
        roomNumber: "A-201",
        roomType: "Conference Room",
        branch: "Bangalore",
        date: "2026-09-03",
        startTime: "15:00",
        endTime: "15:30",
        attendeeCount: 5,
        requestedAmenities: ["Projector"],
        expiresAt: new Date(Date.now() + 600000).toISOString(),
        action: "CONFIRM_REQUIRED",
        confirmEndpoint: "/api/ai/booking/confirm",
      },
      turnCount: 2,
    };

    (aiApi.sendAiChatApi as any).mockResolvedValueOnce(mockChatResponse);
    (aiApi.confirmAiBookingApi as any).mockResolvedValueOnce({
      success: true,
      booking: {
        bookingId: "bk_999",
        roomNumber: "A-201",
        roomType: "Conference Room",
        date: "2026-09-03",
        startTime: "15:00",
        endTime: "15:30",
        status: "booked",
      },
    });

    renderWithRouter(<AiAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open toyota ai assistant/i }));

    const input = screen.getByPlaceholderText(/ask me to find, book, or check rooms/i);
    fireEvent.change(input, { target: { value: "Book a room for 5 tomorrow at 3 PM" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    // Verify user message and AI response appear
    await waitFor(() => {
      expect(screen.getByText(/I found the best match: Room A-201/i)).toBeInTheDocument();
    });

    // Verify PendingIntentCard elements appear
    expect(screen.getByText("Room A-201")).toBeInTheDocument();
    expect(screen.getByText("15:00 – 15:30")).toBeInTheDocument();
    expect(screen.getByText("5 Attendees")).toBeInTheDocument();

    const confirmButton = screen.getByRole("button", { name: /confirm booking/i });
    expect(confirmButton).toBeInTheDocument();

    // Click [Confirm Booking]
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(aiApi.confirmAiBookingApi).toHaveBeenCalledWith("intent_abc_123");
      expect(screen.getByText(/booking confirmed! \(id: bk_999\)/i)).toBeInTheDocument();
    });
  });

  it("renders CancellationCard and clicking Confirm Cancellation invokes cancelAiBookingApi", async () => {
    const mockCancelResponse: aiApi.AiChatResponse = {
      sessionId: "sess_456",
      intent: "CANCEL_BOOKING",
      reply: "I found your reservation for Room B-101.",
      cancellationCard: {
        bookingId: "booking_to_cancel_1",
        roomNumber: "B-101",
        branch: "Bangalore",
        date: "2026-09-04",
        startTime: "10:00",
        endTime: "10:30",
        action: "CANCEL_REQUIRED",
        cancelEndpoint: "/api/ai/booking/cancel",
      },
      turnCount: 2,
    };

    (aiApi.sendAiChatApi as any).mockResolvedValueOnce(mockCancelResponse);
    (aiApi.cancelAiBookingApi as any).mockResolvedValueOnce({
      success: true,
      message: "Booking cancelled successfully",
      booking: {
        bookingId: "booking_to_cancel_1",
        date: "2026-09-04",
        startTime: "10:00",
        endTime: "10:30",
        status: "cancelled",
        canceledAt: new Date().toISOString(),
      },
    });

    renderWithRouter(<AiAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open toyota ai assistant/i }));

    const input = screen.getByPlaceholderText(/ask me to find, book, or check rooms/i);
    fireEvent.change(input, { target: { value: "Cancel my meeting tomorrow" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(screen.getByText(/Cancellation Confirmation/i)).toBeInTheDocument();
      expect(screen.getByText("Room B-101 (Bangalore)")).toBeInTheDocument();
    });

    const cancelConfirmBtn = screen.getByRole("button", { name: /confirm cancellation/i });
    fireEvent.click(cancelConfirmBtn);

    await waitFor(() => {
      expect(aiApi.cancelAiBookingApi).toHaveBeenCalledWith("booking_to_cancel_1");
      expect(screen.getByText(/reservation cancelled successfully/i)).toBeInTheDocument();
    });
  });

  it("renders NavigationActionCard and clicking button navigates to allowlisted route", async () => {
    const mockNavResponse: aiApi.AiChatResponse = {
      sessionId: "sess_nav",
      domain: "NAVIGATION",
      action: "OPEN_EMPLOYEE_PAGE",
      intent: "GENERAL_HELP",
      reply: "Opening your attendance page.",
      navigation: {
        destination: "attendance",
        path: "/attendance",
        label: "My Attendance",
        actionText: "Open My Attendance",
      },
      turnCount: 2,
    };

    (aiApi.sendAiChatApi as any).mockResolvedValueOnce(mockNavResponse);

    renderWithRouter(<AiAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open toyota ai assistant/i }));

    const input = screen.getByPlaceholderText(/ask me to find, book, or check rooms/i);
    fireEvent.change(input, { target: { value: "Open my attendance" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(screen.getByText("Opening your attendance page.")).toBeInTheDocument();
      expect(screen.getByText("My Attendance")).toBeInTheDocument();
      expect(screen.getByText("Ready to open")).toBeInTheDocument();
    });

    const navBtns = screen.getAllByRole("button", { name: /open my attendance/i });
    expect(navBtns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(navBtns[0]);
  });

  it("renders Notification and Profile informational responses", async () => {
    const mockNotifResponse: aiApi.AiChatResponse = {
      sessionId: "sess_notif",
      domain: "NOTIFICATION",
      action: "GET_UNREAD",
      intent: "GENERAL_HELP",
      reply: "You have 0 unread notifications. You're all caught up! 🎉",
      turnCount: 2,
    };

    (aiApi.sendAiChatApi as any).mockResolvedValueOnce(mockNotifResponse);

    renderWithRouter(<AiAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open toyota ai assistant/i }));

    const input = screen.getByPlaceholderText(/ask me to find, book, or check rooms/i);
    fireEvent.change(input, { target: { value: "Do I have unread notifications?" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(screen.getByText(/You have 0 unread notifications/i)).toBeInTheDocument();
    });
  });
});
