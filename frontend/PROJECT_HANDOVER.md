# Project Handover (For Next Chat)

## 1. Project Scope
Toyota Meeting Room Booking system with separate Employee and Manager flows.

Frontend in this repo:
- `frontend/` (Vite + React 18 + TypeScript + Tailwind + shadcn/ui + Radix)

Backend in this repo:
- `server/` (Express + MongoDB/Mongoose + JWT)

Important:
- There is also a legacy `client/` folder, but current integrated app is `frontend/`.

---

## 2. Tech Stack

Frontend:
- Vite
- React 18 + TypeScript
- React Router v6
- TanStack React Query
- Tailwind CSS + shadcn/ui + Radix

Backend:
- Node.js + Express
- MongoDB + Mongoose
- JWT auth

---

## 3. High-Level Architecture

### Frontend
- Auth context now uses real backend APIs.
- Token is stored in localStorage (`app_token`).
- Role-aware routing is enforced:
  - Employee routes require `role=employee`
  - Manager routes require `role=manager`

### Backend
- Auth endpoints support both old and new names:
  - `/auth/register` and `/auth/signup`
  - `/auth/profile` and `/auth/me`
  - `/auth/logout`

---

## 4. Current Route Structure (Frontend)

Employee tree:
- `/dashboard`
- `/book-room`
- `/manage-bookings`
- `/booking-history`
- `/notifications`
- `/profile`

Manager tree:
- `/manager`
- `/manager/book-room`
- `/manager/my-bookings`
- `/manager/booking-history`
- `/manager/create-room`
- `/manager/manage-rooms`
- `/manager/all-bookings`
- `/manager/room-availability`
- `/manager/notifications`
- `/manager/profile`

Landing:
- `/` role-aware redirect
- `/login`

---

## 5. API Integration Status

Integrated modules in `frontend/src/api`:
- `client.ts` (base API + auth token handling)
- `auth.ts`
- `rooms.ts`
- `bookings.ts`
- `notifications.ts`
- `users.ts`
- `types.ts` (shared types)

React Query hooks in `frontend/src/hooks/queries`:
- `useRooms.ts`
- `useBookings.ts`
- `useNotifications.ts`
- `useProfile.ts`

Pages wired to backend:
- Dashboard
- Book Room
- Manage Bookings
- Booking History
- Notifications
- Profile
- Manager Dashboard
- Create Room
- Manage Rooms
- All Bookings
- Room Availability

---

## 6. Auth + Role Behavior

Auth context:
- File: `frontend/src/contexts/AuthContext.tsx`
- On app load:
  - if token exists -> calls `/auth/me`
  - on failure -> clears token and logs out

Login:
- `POST /api/auth/login`

Signup:
- `POST /api/auth/signup`
- Frontend defaults role to `employee`
- If `name`/`employeeId` missing, backend auto-generates fallback values

Logout:
- `POST /api/auth/logout` (protected)

Protected routes:
- File: `frontend/src/components/auth/ProtectedRoute.tsx`
- Supports `requireRole`

---

## 7. Credentials / Test Users

### What exists right now
- No hardcoded or seeded user credentials were committed.
- No fixed default manager/employee account is guaranteed in DB.

### What users can do
- Any user can sign up from UI login page (creates `employee` role by default).

### Manager account creation
- Must be created explicitly via backend (role `manager`) using:
  - `POST /api/auth/register` or `POST /api/auth/signup`
  - include `"role": "manager"` in payload

Example manager payload:
```json
{
  "employeeId": "MGR-1001",
  "name": "Manager One",
  "email": "manager@toyota.com",
  "password": "Password@123",
  "role": "manager"
}
```

Note:
- These are example credentials only; not preloaded unless you create them.

---

## 8. Environment Setup

Frontend env (`frontend/.env`):
```env
VITE_API_URL=http://localhost:5000/api
```

Backend env (`server/.env`) must include:
- `PORT`
- `MONGO_URI`
- `JWT_SECRET`
- mail vars as needed

---

## 9. Run Instructions

Backend:
```bash
cd server
npm install
npm run dev
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```

---

## 10. Key Files Changed in Integration

Backend:
- `server/routes/auth.routes.js`
- `server/controllers/auth.controller.js`

Frontend:
- `frontend/src/App.tsx`
- `frontend/src/contexts/AuthContext.tsx`
- `frontend/src/components/auth/ProtectedRoute.tsx`
- `frontend/src/components/layout/Navbar.tsx`
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/pages/Login.tsx`
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/BookRoom.tsx`
- `frontend/src/pages/ManageBookings.tsx`
- `frontend/src/pages/Notifications.tsx`
- `frontend/src/pages/Profile.tsx`
- `frontend/src/pages/ManagerDashboard.tsx`
- `frontend/src/pages/CreateRoom.tsx`
- `frontend/src/pages/ManageRooms.tsx`
- `frontend/src/pages/AllBookings.tsx`
- `frontend/src/pages/RoomAvailability.tsx`
- `frontend/src/components/rooms/RoomForm.tsx`
- `frontend/src/components/rooms/RoomsTable.tsx`
- `frontend/src/components/booking/RoomCard.tsx`
- `frontend/src/components/booking/InviteMembers.tsx`
- `frontend/src/components/UpcomingMeetings.tsx`

New:
- `frontend/src/api/*`
- `frontend/src/hooks/queries/*`
- `frontend/.env.example`

---

## 11. Known Gaps / Next Steps

1. Some filter controls are still UI-only and not fully passed as backend query params.
2. Manager room edit flow can be extended to dedicated edit page with ID route param.
3. Add better error/loading skeleton states for all list pages.
4. Add frontend integration tests for auth + role guards + mutations.
5. Consider server-side validation hardening and consistent error format.

---

## 12. Quick Handoff Summary

- Integration target is `frontend/` + `server/`.
- UI structure was kept; data/auth was connected to backend.
- Auth is now token-based with role-aware route protection.
- No fixed hardcoded credentials exist; create manager account explicitly.

