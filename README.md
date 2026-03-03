
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


