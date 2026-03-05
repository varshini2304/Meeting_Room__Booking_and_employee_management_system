
---

## 🚀 Features
- User authentication (JWT-based)
- Room booking and availability management
- Email notifications for bookings
- Role-based access (Admin/User)
- Modular architecture for scalability

---

## 🛠️ Tech Stack
- **Frontend:** React, Axios, CSS/Bootstrap
- **Backend:** Node.js, Express.js
- **Database:** MongoDB (Mongoose ODM)
- **Authentication:** JWT
- **Email Service:** Nodemailer

---

## ⚙️ Installation & Setup
```

client/
│
├── pages/          # Application pages (Home, Login, Dashboard, etc.)
├── components/     # Reusable UI components
└── services/       # API service calls to backend

server/
│
├── models/         # Database models
│   ├── user.model.js
│   ├── room.model.js
│   ├── booking.model.js
│   └── notification.model.js
│
├── controllers/    # Business logic for routes
├── routes/         # API route definitions
├── middlewares/    # Custom middleware (e.g., authentication)
│   └── auth.js
│
└── services/       # External/internal services (e.g., email service)
    └── emailService.js

```



## 🏗 1️⃣ COMPLETE SYSTEM ARCHITECTURE
```
React (Frontend)
      ↓
API Layer (Axios Services)
      ↓
Node.js + Express (Backend API)
      ↓
Controllers
      ↓
Service Layer
      ↓
Models (Mongoose)
      ↓
MongoDB
      ↓
Email Service (NodeMailer)
```
## 🧠 2️⃣ ARCHITECTURE STYLE

We will use:

✔ MVC Pattern
✔ Layered Architecture
✔ Role-Based Access Control
✔ RESTful API
✔ JWT Authentication
✔ Modular Folder Structure

📁 FULL PROJECT STRUCTURE
## Client
```
client/
│
├── public/
│
├── src/
│   │
│   ├── assets/
│   │
│   ├── components/
│   │   ├── Navbar.jsx
│   │   ├── Sidebar.jsx
│   │   ├── RoomCard.jsx
│   │   ├── BookingModal.jsx
│   │   ├── NotificationDropdown.jsx
│   │
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── CreateBooking.jsx
│   │   ├── ManageBookings.jsx
│   │   ├── AllBookings.jsx
│   │   ├── Profile.jsx
│   │   ├── ManagerDashboard.jsx
│   │   ├── CreateRoom.jsx
│   │   ├── EditRoom.jsx
│   │
│   ├── services/
│   │   ├── authService.js
│   │   ├── bookingService.js
│   │   ├── roomService.js
│   │   ├── notificationService.js
│   │
│   ├── context/
│   │   ├── AuthContext.jsx
│   │
│   ├── utils/
│   │   ├── slotGenerator.js
│   │
│   ├── App.jsx
│   ├── routes.jsx
│   ├── main.jsx
│
└── package.json

```

## Server
```
server/
│
├── config/
│   ├── db.js
│   ├── jwt.js
│   ├── mailer.js
│
├── models/
│   ├── user.model.js
│   ├── room.model.js
│   ├── booking.model.js
│   ├── notification.model.js
│
├── controllers/
│   ├── auth.controller.js
│   ├── room.controller.js
│   ├── booking.controller.js
│   ├── notification.controller.js
│
├── services/
│   ├── email.service.js
│   ├── booking.service.js
│   ├── notification.service.js
│
├── middlewares/
│   ├── auth.middleware.js
│   ├── role.middleware.js
│   ├── error.middleware.js
│
├── routes/
│   ├── auth.routes.js
│   ├── room.routes.js
│   ├── booking.routes.js
│   ├── notification.routes.js
│
├── utils/
│   ├── generateSlots.js
│
├── uploads/
│   └── rooms/
│
├── app.js
├── server.js
│
└── package.json
```


## 🔐 AUTH FLOW
### Files involved:

- auth.routes.js

- auth.controller.js

- user.model.js

- jwt.js

- auth.middleware.js

### Flow:

> Login → Controller → Validate → Generate JWT → Return Token

### Middleware:

> authMiddleware → verify token → attach user to req roleMiddleware → check EMPLOYEE or MANAGER
