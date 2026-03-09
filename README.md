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

-I'm changing this file to update the application gitignore files
