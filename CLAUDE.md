# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Server (Express/Node backend - port 3001)
```bash
cd server
npm run dev          # Start with nodemon (auto-reload)
npm start            # Production server
npm run db:generate  # Generate Prisma client after schema changes
npm run db:push      # Apply schema changes to SQLite database
npm run db:seed      # Seed database with initial data
```

### Client (Vite/React frontend - port 3000)
```bash
cd client
npm run dev      # Start dev server with API proxy to :3001
npm run build    # Build for production
npm run preview  # Preview production build
```

### Running Both
Start server first (port 3001), then client (port 3000). Client proxies `/api` requests to server.

## Architecture Overview

**Orient Insight** is a tour management platform with a client-server architecture.

### Tech Stack
- **Frontend**: React 18, Vite, Tailwind CSS, React Router, Axios, Recharts
- **Backend**: Express.js, Prisma ORM, SQLite
- **Auth**: JWT (7-day expiry), bcryptjs for password hashing

### Project Structure
```
orient-insight/
├── client/src/
│   ├── components/         # React components
│   │   ├── booking/        # Booking-specific (ParticipantsList, RoomingList, etc.)
│   │   └── layout/         # Layout components (Header, Sidebar)
│   ├── pages/              # Route pages (Dashboard, Bookings, Hotels, etc.)
│   ├── services/api.js     # Axios API client with organized methods
│   ├── store/AuthContext.jsx  # Global auth state (Context API)
│   └── App.jsx             # Router setup
├── server/src/
│   ├── routes/             # Express route handlers (bookings, guides, hotels, etc.)
│   ├── middleware/auth.middleware.js  # JWT auth & role-based access
│   ├── utils/crypto.js     # AES-256-CBC encryption for sensitive data
│   └── index.js            # Express app setup
└── server/prisma/
    └── schema.prisma       # Database schema
```

### Database Models (Prisma/SQLite)
Core entities: User, Booking, TourType, Guide, GuidePayment
Hotels: City, Hotel, HotelImage, RoomType, RoomSeasonalPrice
Participants: TourParticipant, ParticipantRoomAssignment
Accommodations: Accommodation, AccommodationRoom, AccommodationRoomType

### API Routes
All under `/api` prefix, JWT-protected:
- `/auth` - Login, register, user management
- `/bookings` - Tour booking CRUD, room management, cost summaries
- `/participants` - Participant CRUD, rooming assignments, Excel/PDF export
- `/guides` - Guide management with encrypted sensitive data
- `/hotels` - Hotels, room types, seasonal pricing, images
- `/cities`, `/tour-types` - Reference data
- `/dashboard` - Analytics and statistics
- `/import` - Excel bulk import

### Key Patterns

**Authentication**: JWT Bearer token in `Authorization` header. Roles: ADMIN, MANAGER. Admin-only routes use `requireAdmin` middleware.

**Sensitive Data Encryption**: Guide passport numbers, bank accounts, and card numbers are encrypted with AES-256-CBC (`server/src/utils/crypto.js`). Admins see decrypted data; managers see masked values.

**File Uploads**: Multer handles uploads to `/uploads/` directory. Hotel images support reordering.

**API Client**: `client/src/services/api.js` exports organized API objects: `bookingsApi`, `participantsApi`, `guidesApi`, `hotelsApi`, etc.

**State Management**: React Context for auth only. Component-level state for most features.

**Error Messages**: Backend returns errors in Russian (Cyrillic).

### Environment Variables (server/.env)
```
DATABASE_URL=file:../database/orient-insight.db
JWT_SECRET=<your-secret>
PORT=3001
ENCRYPTION_KEY=<32-char-key>
```
