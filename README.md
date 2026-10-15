# Ritual Mitra

Backend API and web admin/user panel for Ritual Mitra — a platform for booking home poojas, temple (online) poojas, astrology consultations, and shopping for pooja essentials.

## Structure

- `backend/` — Node.js/Express API, MongoDB (Mongoose) models, Razorpay payments
- `frontend/` — React (Vite) web app for users and admins
- `deploy.sh` / `ecosystem.config.js` / `nginx.conf` — production deployment (see [DEPLOYMENT.md](DEPLOYMENT.md))

The mobile app (React Native/Expo) lives in a separate repository.

## Local setup

```bash
# Backend
cd backend
npm install
cp .env.example .env   # fill in MONGO_URI, JWT_SECRET, SMTP_*, RAZORPAY_* etc.
npm start

# Frontend
cd frontend
npm install
npm run dev
```
