# Testimony Parish — Backend API
### New Testament Assembly Worldwide

A RESTful API built with **Node.js**, **Express**, and **MongoDB** to power the Testimony Parish website, including event management and public registration.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```
Edit `.env` and fill in your values:
- `MONGODB_URI` — your MongoDB Atlas connection string
- `JWT_SECRET` — a long random secret (use a password generator)
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — credentials for the first admin account
- `FRONTEND_URL` — your deployed frontend URL (for CORS)

### 3. Create the First Admin (run ONCE)
```bash
node seed.js
```
> ⚠️ After running this, **remove** `ADMIN_EMAIL` and `ADMIN_PASSWORD` from your `.env` file.

### 4. Start the Server
```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

---

## 📡 API Reference

### Base URL
```
http://localhost:5000/api
```

### Health Check
```
GET /api/health
```

---

### 🌐 Public Endpoints

#### Get All Upcoming Events
```
GET /api/events
```
Query params: `?category=Bible Study`, `?featured=true`

#### Get Single Event
```
GET /api/events/:id
```

#### Register for an Event
```
POST /api/events/:id/register
```
Body:
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "+234...",
  "numberOfGuests": 2,
  "isMember": true,
  "notes": "Optional notes"
}
```

---

### 🔐 Admin Endpoints (Protected)

All admin routes require a `Bearer <token>` in the `Authorization` header.

#### Login
```
POST /api/admin/login
```
Body: `{ "email": "...", "password": "..." }`
Returns: JWT token

#### Get My Profile
```
GET /api/admin/me
```

#### Dashboard Stats
```
GET /api/admin/dashboard
```

#### Events Management
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin/events` | List all events (incl. past/unpublished) |
| POST | `/api/admin/events` | Create new event |
| PUT | `/api/admin/events/:id` | Update event |
| DELETE | `/api/admin/events/:id` | Delete event + registrations |

#### Registration Management
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin/registrations` | All registrations (latest 100) |
| GET | `/api/admin/registrations/:eventId` | Registrations for specific event + stats |
| PATCH | `/api/admin/registrations/:id/status` | Update registration status |

#### Admin User Management (Superadmin only)
```
POST /api/admin/create
```
Body: `{ "name": "...", "email": "...", "password": "...", "role": "admin" }`

---

## 🗂️ Event Categories
- `Sunday Service`
- `Prayer Meeting`
- `Bible Study`
- `Youth Program`
- `Special Event`
- `Conference`
- `Outreach`
- `Other`

---

## 🌍 Deploying to Render (Recommended Free Option)

1. Push this code to a GitHub repo
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your repo
4. Set environment variables in Render dashboard
5. Build command: `npm install`
6. Start command: `npm start`

> Your backend URL will be: `https://your-app-name.onrender.com`

---

## 🛡️ Security Features
- JWT authentication with 7-day expiry
- Password hashing with bcrypt (12 rounds)
- Rate limiting on all routes
- Strict rate limiting on login and registration
- Input validation on all POST/PUT routes
- Duplicate registration prevention (unique email per event)
- Confirmation codes for each registration
