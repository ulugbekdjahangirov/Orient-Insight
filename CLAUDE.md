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

### Hotel Accommodation Cost Calculation

**CRITICAL: This logic must remain stable for ER tours. Do NOT modify without careful consideration.**

Hotel costs are calculated using **individual tourist dates** from the rooming list, not just accommodation dates. This handles special cases like:

1. **Early arrivals** (e.g., Baetgen arriving 3 days before group)
2. **Uzbekistan/Turkmenistan splits** in Khiva region
3. **Per-hotel guest-specific dates**

#### Date Priority (MUST be followed in this order):

**Backend** (`server/src/routes/booking.routes.js`, line 1625-1692):
1. **AccommodationRoomingList** table (explicitly saved hotel-specific dates)
2. **Tourist.checkInDate/checkOutDate** (for first accommodation only - handles early arrivals)
3. **Accommodation.checkInDate/checkOutDate** (default for all guests)

**Special Rule - Khiva/Turkmenistan Hotels**:
- If hotel city contains "Хива", "Khiva", "Туркмен", or "Turkmen"
- AND tourist.accommodation = "Uzbekistan" or "Uz"
- THEN checkout date is **reduced by 1 day** (UZ tourists leave earlier)
- Backend log: `🟢 UZ tourist in TM hotel: [name]`
- Example: Malika Khorazm (22.10-25.10): TM tourists stay 3 nights, UZ tourists stay 2 nights

**Frontend - Form Calculation** (`client/src/components/booking/HotelAccommodationForm.jsx`, line 222-256 & 493-516):
1. **tourist.checkInDate/checkOutDate** from rooming list API (already adjusted by backend)
2. **AccommodationRoomingList** table (if manually saved)
3. **formData.checkInDate/checkOutDate** (accommodation default)

**Frontend - Card View** (`client/src/pages/BookingDetail.jsx`, line 4310-4338):
1. **tourist.checkInDate/checkOutDate** from `accommodationRoomingLists` state (loaded from API)
2. **Fallback to accommodation dates**

#### Implementation Files:

**Backend:**
- `server/src/routes/booking.routes.js`:
  - Line 1625-1692: Khiva/TM hotel detection & UZ tourist adjustment
  - Line 1553-1710: GET `/api/bookings/:id/accommodations/:accId/rooming-list`
  - Line 773-920: Cost calculation using individual tourist nights

**Frontend:**
- `client/src/components/booking/HotelAccommodationForm.jsx`:
  - Line 222-256: Total cost calculation (uses rooming list dates)
  - Line 493-607: Display calculation & rooming list details
  - Line 89-106: `loadRoomingList()` - loads backend-adjusted dates
- `client/src/pages/BookingDetail.jsx`:
  - Line 4310-4450: Card view guest-nights calculation
  - Line 783-803: Auto-load all rooming lists on page load (CRITICAL for correct display)
  - Line 1237-1247: `loadAccommodationRoomingList()` function

#### Testing Checklist:

When modifying hotel calculation logic, ALWAYS test with **ER-03** booking:
1. **Arien Plaza (first hotel, 13.10-15.10)**: Baetgen early arrival (10.10-15.10) = 5 nights, others 2 nights
2. **Malika Khorazm (22.10-25.10)**: UZ tourists 2 nights, TM tourists 3 nights
3. Verify **card view** and **edit modal** show same total cost
4. Check server logs for `🟢 UZ tourist in TM hotel` messages
5. Open "Hisob-kitob tafsilotlari" dropdown to verify individual guest nights

#### Common Mistakes to Avoid:

❌ Using `tourist.checkInDate/checkOutDate` (global tour dates) instead of rooming list dates
❌ Applying early arrival logic to ALL hotels (should only apply to first hotel)
❌ Not loading `accommodationRoomingLists` state on page load
❌ Hardcoding nights = accommodation.nights for all guests
❌ Ignoring backend-adjusted dates in frontend calculations

✅ Always use rooming list API response dates (backend already handles all adjustments)
✅ Load all rooming lists on page load for correct card display
✅ Check date priority order: rooming list → accommodationRoomingList → accommodation dates

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

### Marshrutiy (Itinerary) Tab - Route Template & Auto-loading

**CRITICAL: ER Template System**

The ER tour type uses a **template system** stored in the `RouteTemplate` table. This ensures ALL ER groups have consistent itineraries.

**Template Auto-Save (Database Persistence):**
- When opening an ER booking without saved routes, the system first checks for templates in the database
- If no database template exists, the hardcoded `defaultERRoutesTemplate` is automatically saved to the database
- This happens once per tour type (ER, CO, KAS, ZA) and ensures templates persist across sessions
- **File**: `client/src/pages/BookingDetail.jsx` (lines ~1277-1315)
- **API**: `routesApi.saveTemplate(tourTypeCode, routes)` → `PUT /api/routes/templates/:tourTypeCode`
- **Important**: This auto-save ensures ER logic remains stable when adding CO/KAS/ZA templates in the future

**Default ER Template (16 days):**
1. Istanbul -Tashkent
2. Tashkent - Chimgan - Tashkent
3. Hotel-Toshkent sevemiy vokzali
4. Samarqand vokzali
5. Samarqand
6. Samarqand
7. Samarkand - Asraf
8. Asraf - Buxoro
9. Buxoro
10. Buxoro
11. Buxoro-Xiva
12. Xiva
13. Xiva-Urgench
14. Xiva-Shovot
15. Tashkent mahalliy Aeroporti-Hotel
16. Hotel-Tashkent xalqoro aeroporti

**Auto-loading Behavior:**
- When opening Marshrutiy tab, if routes are empty or incomplete (less than expected days - 2), routes are automatically loaded from template
- **CRITICAL: Route dates are calculated from Final List (tourists' check-in/out dates), NOT from booking.departureDate/endDate**
- Earliest check-in date becomes Day 1, latest check-out date becomes last day
- If no tourists with dates exist, falls back to booking dates
- This ensures routes match actual group travel dates from Final List
- Template routes are mapped to these calculated dates in order (Day 1 = template route 1, Day 2 = template route 2, etc.)

**Template Storage:**
- Templates stored in `RouteTemplate` table with `tourTypeCode = 'ER'`
- Each template has: dayNumber, dayOffset, routeName (Yo'nalish), city (Sayohat dasturi), provider, sortOrder
- **routeName**: Short route name (e.g., "Istanbul -Tashkent")
- **city**: Detailed program description (e.g., "Toshkentga tashrif. Aeroportda kutib olish...")
- Frontend: `client/src/components/booking/ItineraryPreview.jsx` - `loadItineraryData()` function
- Backend: `server/src/routes/route.routes.js` - GET/PUT `/api/routes/templates/:tourTypeCode`

**Display Mapping:**
- "Yo'nalish" column → `route.routeName`
- "Sayohat dasturi" column → `route.city`

**DO NOT:**
- ❌ Delete or modify ER template without backing up
- ❌ Change auto-loading logic without testing on ER-03
- ❌ Override route dates manually - they sync with booking.departureDate/endDate

**Marshrutiy Route Sorting**

**CRITICAL: DO NOT MODIFY THIS SORTING LOGIC**

The Marshrutiy tab uses **custom sorting logic** for route display. This is used for **ALL ER groups** and must remain stable.

**File**: `client/src/components/booking/ItineraryPreview.jsx`

**Custom Sorting Rules**:
Routes are sorted chronologically by date, EXCEPT for specific routes that need interleaved ordering:

1. **24.10 and 25.10 routes** (interleaved):
   - Row 13: 24.10 Xiva-Urganch (index 1)
   - Row 14: 25.10 Xiva-Shovot (index 2)
   - Row 15: 24.10 Mahalliy Aeroport-Hotel (index 3)
   - Row 16: 25.10 Hotel-Xalqoro Aeroport (index 4)

2. **15.10 and 16.10 routes** (swapped order):
   - Row 14: 16.10 Xiva-Shovot (displayed BEFORE 15.10)
   - Row 15: 15.10 Tashkent mahalliy Aeroporti-Hotel (displayed AFTER 16.10)

**Implementation**: The `getCustomIndex()` function in the sorting logic assigns specific index values to these routes, overriding chronological order. Pattern matching is case-insensitive.

**Why This Matters**: This sorting reflects the actual tour logistics where certain routes need to be viewed in a specific order regardless of their dates.

**PDF Export**: The PDF export function uses the same sorting logic, so the printed itinerary matches the on-screen display.

### Marshrutiy PDF Export Features

**File**: `client/src/components/booking/ItineraryPreview.jsx`

The "Скачать PDF" button exports the itinerary with the following features:

**1. Cyrillic to Latin Transliteration**:
- All Cyrillic text (city names, route names, contact info) is automatically transliterated to Latin for PDF compatibility
- Uses comprehensive transliteration map including Uzbek-specific characters (Ғ, Қ, Ў, Ҳ)
- Example: Тошкент → Toshkent, Самарқанд → Samarqand

**2. Color Coding** (preserved in PDF):
- **Toshkent routes**: Yellow background (RGB: 254, 243, 199) for all routes containing "Tashkent" or "Toshkent"
- **Xayrulla contact row**: Yellow background in header table
- Matches the on-screen display colors

**3. Content Sections**:
- Header table: Transport contacts (Nosir, Sevil, Xayrulla) + Group info (Gruppa, Davlat, Turistlar soni, gid)
- Main routes table: Date, Direction, Time, Travel program
- Poyezd bileti: Railway tickets with hotel info
- Ichki aviareys: Domestic flights with hotel info
- Xalqaro aviareys: International flights (no hotel info)
- Hotels: Unique list of all hotels (Shahar, Hotel, Telefon)

**4. Formatting**:
- Font sizes: Title 14px, Section headers 10px, Table content 7-8px
- Cell padding: 1.5mm for readability
- Grid theme with borders
- Optimized to fit on single A4 page (portrait)

**5. Data Sources**:
- Routes from `Route` table
- Railways from `Railway` table
- Flights from `Flight` table (filtered by type: DOMESTIC/INTERNATIONAL)
- Hotels from `Accommodation` table (via bookingRooms)
- Tourists count from `Tourist` table

**Important**: This PDF export is used for ALL ER groups. Do not modify the layout, colors, or content structure without testing with actual ER tour data.

### Route Module - "Fix Vehicles" Auto-Calculation

**CRITICAL: ER Route Auto-Fix Logic**

The Route tab has a "Fix Vehicles" button that automatically generates/fixes all routes for ER groups based on the template system.

**File**: `client/src/pages/BookingDetail.jsx` - `autoFixAllRoutes()` function (lines ~4418-4620)

**What it does:**
1. Calculates UZB and TKM tourist counts from `tourist.accommodation` field
2. Generates routes from ER template with dates calculated from `departureDate + 1` (arrival date)
3. Auto-selects vehicles and prices based on PAX count and provider
4. Handles special cases: Chimgan routes, UZB/TKM route splitting
5. Filters out routes with 0 PAX
6. Saves routes to database via bulk update

**PAX Calculation:**
```javascript
// UZB tourists: accommodation contains "uzbek", "узбек", or equals "uz"
const paxUzb = tourists.filter(t => {
  const placement = (t.accommodation || '').toLowerCase().trim();
  return placement.includes('uzbek') || placement.includes('узбек') || placement === 'uz';
}).length;

// TKM tourists: accommodation contains "turkmen", "туркмен", "tm", "tkm", or "turkmeni"
const paxTkm = tourists.filter(t => {
  const placement = (t.accommodation || '').toLowerCase().trim();
  return placement.includes('turkmen') || placement.includes('туркмен') ||
         placement === 'tm' || placement === 'tkm' || placement.includes('turkmeni');
}).length;
```

**Chimgan Route - Special Vehicle Logic:**
- **5-8 people**: Joylong
- **9+ people**: Sprinter
- Chimgan routes always use Xayrulla provider with 'chimgan' rate

**UZB/TKM Route Splitting (3 Variants):**

**Variant 1 - All UZB (TKM = 0):**
- Khiva-Urgench → paxUzb (to Urgench airport)
- Mahalliy Aeroport-Hotel → paxUzb (domestic flight to Tashkent)
- Hotel-Xalqaro Aeroport → paxUzb (international departure)
- Khiva-Shovot → Skipped (0 PAX)

**Variant 2 - Mixed (UZB > 0 AND TKM > 0):**
- Khiva-Urgench → paxUzb (UZB to airport)
- Mahalliy Aeroport-Hotel → paxUzb (UZB domestic flight)
- Hotel-Xalqaro Aeroport → paxUzb (UZB international departure)
- Khiva-Shovot → paxTkm (TKM to border)

**Variant 3 - All TKM (UZB = 0):**
- Khiva-Urgench → Skipped (0 PAX) - TKM don't go to Urgench airport
- Khiva-Shovot → paxTkm (TKM go directly to border)
- Mahalliy Aeroport-Hotel → Skipped (0 PAX)
- Hotel-Xalqaro Aeroport → Skipped (0 PAX)

**Route Name Matching:**
Uses `.includes()` for flexible matching to handle spacing/formatting variations:
- Khiva-Urgench: `routeName.includes('Khiva') && routeName.includes('Urgench')`
- Khiva-Shovot: `routeName.includes('Shovot') || routeName.includes('Shoʻvot') || routeName.includes('Shavat')`
- Mahalliy Aeroport: `routeName.includes('Mahalliy') && routeName.includes('Aeroport')`
- Xalqaro Aeroport: `routeName.includes('Xalqaro') && routeName.includes('Aeroport')`

**Safety Check - Khiva-Shovot Auto-Add:**
If TKM tourists exist but Khiva-Shovot route is missing after template processing, it's automatically added with:
- Date: Same as Hotel-Xalqaro Aeroport route (day 13)
- PAX: paxTkm
- Provider: sevil
- Vehicle: Auto-selected based on PAX count
- Rate: shovotRate
- Price: Auto-calculated

**Console Logging:**
- `🔧 Auto-fixing routes: PAX Total=X, UZB=Y, TKM=Z`
- `📋 Tourist accommodations: [array of tourist names and accommodation values]`
- `✅ Route N: [routeName] → Date=DD.MM.YYYY, PAX=X, Vehicle=Y, Price=$Z`
- `⏭️ Route N: [routeName] → Skipped (PAX = 0)`
- `🟣 TKM border route found: [routeName], TKM PAX = X, routePax = Y`
- `⚠️ TKM tourists exist (X) but Khiva-Shovot route missing. Adding it...`

**DO NOT:**
- ❌ Modify UZB/TKM counting logic without testing with real ER groups
- ❌ Change Chimgan vehicle selection logic (9-16 people use Sprinter, NOT Yutong)
- ❌ Remove safety check for Khiva-Shovot auto-add
- ❌ Use exact string matching instead of `.includes()` for route names

**Testing:**
Always test with ER groups that have:
1. All UZB tourists (Variant 1)
2. Mixed UZB+TKM tourists (Variant 2)
3. All TKM tourists (Variant 3)
4. Various PAX counts for Chimgan (5-8 for Joylong, 9+ for Sprinter)

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
