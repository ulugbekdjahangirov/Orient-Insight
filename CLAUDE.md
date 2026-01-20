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
Tourists: Tourist, TouristRoomAssignment, RoomingListEntry
Accommodations: Accommodation, AccommodationRoom, AccommodationRoomType
Flights: Flight, FlightSection (raw PDF content)
Future modules: Request, Invoice, Payment

### API Routes
All under `/api` prefix, JWT-protected:
- `/auth` - Login, register, user management
- `/bookings` - Tour booking CRUD, accommodations, cost summaries
- `/bookings/:id/tourists` - Tourist/participant CRUD, rooming assignments, Excel/PDF export (also aliased as `participantsApi`)
- `/bookings/:id/flights` - Flight information, flight sections from PDF
- `/bookings/:id/rooming-list` - Rooming list import from PDF
- `/guides` - Guide management with encrypted sensitive data
- `/hotels` - Hotels, room types, seasonal pricing, images
- `/cities`, `/tour-types` - Reference data
- `/dashboard` - Analytics and statistics
- `/import` - Excel bulk import
- `/health` - Health check (unauthenticated)

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

## Important Business Logic

### Dynamic Status Calculation
Booking statuses are **calculated dynamically** based on PAX count and dates, NOT stored in database:
- **COMPLETED**: Tour end date has passed (`endDate < today`)
- **CANCELLED**: PAX < 4 AND less than 30 days until departure
- **CONFIRMED**: PAX ≥ 6
- **IN_PROGRESS**: PAX = 4 or 5
- **PENDING**: PAX < 4 (and ≥30 days until departure)

This logic is implemented in:
- Frontend: `getStatusByPax(pax, departureDate, endDate)` in `Updates.jsx` and `Bookings.jsx`
- Backend: `calculateStatus(pax, departureDate, endDate)` in `booking.routes.js` and `dashboard.routes.js`

Status filtering happens **on the frontend** after fetching data, not via database queries.

### Room Count Calculation
Room counts are stored as `Float` (not Int) to support fractional rooms:
- **DBL rooms**: Pairs of DZ (double) preference tourists
- **TWN rooms**: Pairs of TWN preference tourists + 0.5 for single DZ tourist
- **SNGL rooms**: Count of EZ (single) preference tourists

**Single DZ Logic**: If odd number of DZ tourists (1, 3, 5...), the unpaired tourist counts as **0.5 TWN room**.
- Example: 7 DZ → 3 DBL + 0.5 TWN
- Example: 1 DZ → 0 DBL + 0.5 TWN

Room calculation functions:
- `updateBookingPaxCount()` in `tourist.routes.js`
- `calculateRoomCountsFromTourists()` in `booking.routes.js`

### Excel Import Flow
Tourist import in `Updates.jsx` uses `parseExcelFileOnly()` which:

1. **Detects tour type** from Excel "Reise:" field (ER, CO, KAS, ZA)
2. **Matches existing bookings** by dates:
   - **ER/CO**: Match by `departureDate` (arrival in Uzbekistan)
   - **KAS**: Match by `endDate` (departure from region)
   - **ZA**: Match by `departureDate + 4 days` (Excel shows entry date, actual arrival is 4 days later)
3. **Turkmenistan detection**: Tours with "Verlängerung Turkmenistan" in name
4. **Room number extraction**: Parses "DZ-1", "EZ-2" format from Rm column
5. **Gender extraction**: From "Mr./Mrs." prefix in Name column
6. **Birthday detection**: Checks if DoB falls within tour dates
7. **Full replace mode**: Deletes existing tourists before importing new ones

After import, runs `updateBookingPaxCount()` to recalculate PAX and room counts.

### PAX Split (Uzbekistan/Turkmenistan)
Tours can have tourists in two regions:
- `paxUzbekistan`: Tourists staying only in Uzbekistan
- `paxTurkmenistan`: Tourists with Turkmenistan extension
- `pax`: Total (auto-calculated as sum of both)

Turkmenistan tourists are identified by:
- Tour name contains "Turkmenistan" + ("Verlängerung" OR "extension")
- OR tour name has "Turkmenistan" without "Usbekistan"

The `accommodation` field on Tourist model stores "Uzbekistan" or "Turkmenistan".

### Database Schema Updates
After modifying `schema.prisma`:
```bash
cd server
npx prisma db push --accept-data-loss  # Apply schema changes
npm run db:generate                     # Regenerate Prisma Client
```

If Prisma Client generation fails with "EPERM" (file locked by server):
1. Stop the server (Ctrl+C)
2. Delete Prisma cache: `rmdir /s /q node_modules\.prisma` (Windows) or `rm -rf node_modules/.prisma` (Unix)
3. Run `npm run db:generate`
4. Restart server with `npm run dev`

## UI/UX Patterns

### Tour Type Modules
Four tour types with color coding:
- **ER** (Erlebnisreisen): Blue `#3B82F6`
- **CO** (Comfort): Green `#10B981`
- **KAS** (Karawanen Seidenstrasse): Orange `#F59E0B`
- **ZA** (Zentralasien): Purple `#8B5CF6`

Updates page shows tabs for each type. Status colors consistent across all views:
- Pending: Yellow
- Confirmed: Green
- In Progress: Purple
- Completed: Blue
- Cancelled: Red

### Number Formatting
Room counts support decimals (0.5). Format for display:
```javascript
// Show integer as-is, decimals with .toFixed(1)
{booking.roomsTwn > 0 ? (Number(booking.roomsTwn) % 1 === 0 ? booking.roomsTwn : booking.roomsTwn.toFixed(1)) : '-'}
```

### Language
- UI labels: Russian (Cyrillic)
- Backend error messages: Russian
- Code comments: Mix of English and Russian
- Tourist data: German names/fields from Excel
