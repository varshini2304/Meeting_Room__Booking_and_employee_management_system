# Toyota Meeting Room Booking System (MERN)

Enterprise-grade starter for a Toyota employee meeting room booking platform with JWT auth, role-based access, booking constraints, email confirmations, and notifications.

## Tech Stack
- Frontend: React (Vite)
- Backend: Node.js, Express.js
- Database: MongoDB + Mongoose
- Auth: JWT
- Email: NodeMailer

## Roles
- Employee
- Manager

## Project Structure
```text
root
├── client
│   ├── public
│   ├── src
│   │   ├── assets
│   │   ├── components
│   │   │   ├── Navbar.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── RoomCard.jsx
│   │   │   ├── BookingModal.jsx
│   │   │   └── NotificationDropdown.jsx
│   │   ├── pages
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── CreateBooking.jsx
│   │   │   ├── ManageBookings.jsx
│   │   │   ├── AllBookings.jsx
│   │   │   ├── Profile.jsx
│   │   │   ├── ManagerDashboard.jsx
│   │   │   ├── CreateRoom.jsx
│   │   │   └── EditRoom.jsx
│   │   ├── services
│   │   │   ├── authService.js
│   │   │   ├── bookingService.js
│   │   │   ├── roomService.js
│   │   │   └── notificationService.js
│   │   ├── context
│   │   │   └── AuthContext.jsx
│   │   ├── utils
│   │   │   └── slotGenerator.js
│   │   ├── App.jsx
│   │   ├── routes.jsx
│   │   └── main.jsx
├── server
│   ├── config
│   │   ├── db.js
│   │   ├── jwt.js
│   │   └── mailer.js
│   ├── models
│   │   ├── user.model.js
│   │   ├── room.model.js
│   │   ├── booking.model.js
│   │   └── notification.model.js
│   ├── controllers
│   │   ├── auth.controller.js
│   │   ├── room.controller.js
│   │   ├── booking.controller.js
│   │   └── notification.controller.js
│   ├── services
│   │   ├── booking.service.js
│   │   ├── email.service.js
│   │   └── notification.service.js
│   ├── middlewares
│   │   ├── auth.middleware.js
│   │   ├── role.middleware.js
│   │   └── error.middleware.js
│   ├── routes
│   │   ├── auth.routes.js
│   │   ├── room.routes.js
│   │   ├── booking.routes.js
│   │   └── notification.routes.js
│   ├── utils
│   │   └── generateSlots.js
│   ├── app.js
│   └── server.js
└── README.md
```

## Business Rules Implemented
- Fixed 30-minute booking slots.
- No overlapping room bookings.
- Only booking owner can cancel and confirm occupancy.
- Manager-only room management.
- JWT required for protected APIs.
- Email confirmation on booking.
- Invite notification generation.

## Data Models
- `Users`
- `Rooms`
- `Bookings`
- `Notifications`

`Bookings` has a compound unique index:
- `(roomId, date, startTime)` with active-booking partial filter.

## API Endpoints
### Auth
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/profile`

### Rooms
- `POST /api/rooms` (manager)
- `PUT /api/rooms/:id` (manager)
- `GET /api/rooms`
- `GET /api/rooms/availability`

### Bookings
- `POST /api/bookings`
- `GET /api/bookings/my`
- `GET /api/bookings/history`
- `DELETE /api/bookings/:id`
- `PUT /api/bookings/:id/confirm-occupancy`

### Notifications
- `GET /api/notifications`
- `PUT /api/notifications/:id/read`

## Environment Setup
1. Copy env files:
   - `server/.env.example` -> `server/.env`
   - `client/.env.example` -> `client/.env`

## Run Backend
```bash
cd server
npm install
npm run dev
```

## Run Frontend
```bash
cd client
npm install
npm start
```

## Notes for Production Hardening
- Add request validation (Joi/Zod).
- Add rate limiting and audit logs.
- Add job scheduler for reminder notifications.
- Add automated test suite (unit/integration/e2e).

## Deployment

The repo is configured for three independent deployments:

| App        | Path        | Host    | Config            |
| ---------- | ----------- | ------- | ----------------- |
| Backend    | `server/`   | Render  | `render.yaml`     |
| Frontend   | `frontend/` | Vercel  | `vercel.json`     |
| Rooms UI   | `rooms/`    | Vercel  | `vercel.json`     |

### 1. Backend on Render

Recommended order — deploy the backend first so you can plug its URL into the two frontends.

1. Push this repo to GitHub.
2. In Render, **New + → Blueprint** and point at this repo. Render will pick up `server/render.yaml` and create a web service rooted at `server/`.
   - Or do it manually: **New + → Web Service**, root directory `server`, build `npm install`, start `npm start`, health check `/health`.
3. Set the env vars listed in `server/.env.example`:
   - `MONGO_URI` — MongoDB Atlas connection string. Whitelist `0.0.0.0/0` in Atlas (Render does not publish a fixed egress IP on free/standard plans).
   - `JWT_SECRET`, `MEETING_LINK_SECRET` — strong random strings (Render auto-generates these from the blueprint).
   - `CLIENT_URL` — main frontend Vercel URL (set after step 2 below).
   - `CLIENT_URLS` — comma-separated list, include both Vercel apps. CORS rejects anything not in this list when `NODE_ENV=production`.
   - `FRONTEND_URL`, `BACKEND_URL` — used to build links inside outbound emails.
   - SMTP settings for nodemailer.
4. Note the resulting URL, e.g. `https://meeting-room-api.onrender.com`.

> **Free-tier caveat:** Render free web services sleep after ~15 min of inactivity. The booking sweep `setInterval` and `node-cron` jobs won't fire while the service is asleep. For production use a paid plan, or wake the service with an external cron pinging `/health`.

### 2. Frontend on Vercel

1. **New Project** → import the repo → set **Root Directory** to `frontend`.
2. Vercel auto-detects Vite (also pinned in `frontend/vercel.json`). No overrides needed.
3. Set env var:
   - `VITE_API_URL=https://meeting-room-api.onrender.com/api` (note the trailing `/api`).
4. Deploy. Copy the resulting URL into the backend's `CLIENT_URL` / `CLIENT_URLS` and redeploy the backend.

### 3. Rooms display on Vercel

1. **New Project** → import the repo → set **Root Directory** to `rooms`.
2. Set env var:
   - `VITE_API_BASE_URL=https://meeting-room-api.onrender.com/api`.
3. Deploy. Add this URL to the backend's `CLIENT_URLS` (comma-separated alongside the main frontend) and redeploy the backend.

### Local development

Copy each `.env.example` to `.env` (or `.env.local` for Vite) and fill in values. Defaults assume the backend on `:5000`, frontend on `:8080`, rooms on Vite's default `:5173`.
