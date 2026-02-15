# ER-01 Rooms Module Analysis

## 🔍 Current State

### Database Status (2026-02-14)

#### ✅ Tourist Room Assignments (Working)
```
Tourist table has roomNumber field populated:
- Biebel, Alexandra: SNGL-6 (Turkmenistan)
- Frenkler, Peter: DBL-1 (Uzbekistan)
- Jöns, Thomas: TWN-1 (Uzbekistan)
- Kugler, Michaela: TWN-2 (Uzbekistan)
- Maier, Heinz: DBL-2 (Turkmenistan)
- Maier, Andrea: DBL-2 (Turkmenistan)
- Maier, Nadja: SNGL-5 (Turkmenistan)
- Mauersberger, Bärbel: SNGL-2 (Uzbekistan)
- Mensendieck, Detlef: SNGL-4 (Uzbekistan)
- Neuper, Dorothea: SNGL-3 (Uzbekistan)
- Niemann, Andreas: TWN-1 (Uzbekistan)
- Romstoeck, Ilse: SNGL-1 (Uzbekistan)
- Schenck, Cornelia: TWN-2 (Uzbekistan)
- Simon, Carmen: DBL-1 (Uzbekistan)
```

**Total**: 14 tourists with room assignments
- **Uzbekistan group**: 10 tourists (2 DBL, 2 TWN pairs, 4 SNGL)
- **Turkmenistan group**: 4 tourists (1 DBL pair, 2 SNGL)

#### ❌ Accommodation Rooming List (EMPTY)
```sql
SELECT * FROM accommodationRoomingList WHERE accommodation.bookingId = 1;
-- Result: 0 entries found
```

**Problem**: `accommodationRoomingList` table is empty despite tourists having room assignments.

---

## 🏗️ Architecture

### 1. Tourist Room Assignments
**Location**: `tourist` table
**Field**: `roomNumber` (VARCHAR)
**Purpose**: Global room assignment (e.g., "DBL-1", "TWN-2", "SNGL-3")
**Status**: ✅ Working - Data exists in database

### 2. Accommodation Rooming List
**Location**: `accommodationRoomingList` table
**Fields**:
- `accommodationId` (FK to accommodation)
- `touristId` (FK to tourist)
- `checkInDate` (DATE) - Hotel-specific check-in
- `checkOutDate` (DATE) - Hotel-specific check-out
- `roomNumber` (VARCHAR) - Optional room number assignment

**Purpose**: Many-to-many relationship tracking which tourists stay at which specific hotel
**Status**: ❌ EMPTY - Not being populated

**Why it matters**:
- ER tours have MIXED groups (Uzbekistan + Turkmenistan)
- Turkmenistan tourists don't stay at all Uzbekistan hotels
- Need to track which tourists are actually in each hotel
- Need hotel-specific check-in/check-out dates (different from booking dates)

---

## 🔧 Backend API Status

### ✅ API Endpoints Exist

1. **GET /api/bookings/:id/accommodations/:accId/rooming-list**
   - File: `server/src/routes/booking.routes.js` line 1602
   - Returns tourists for specific accommodation
   - Handles special cases:
     - Mixed groups (UZ + TM)
     - Second visit to same Tashkent hotel (only UZ tourists return)
     - Turkmenistan/Khiva hotels (-1 day checkout for UZ tourists)
   - Status: ✅ Working (reads from `accommodationRoomingList` table)

2. **PUT /api/bookings/:id/accommodations/:accId/rooming-list/:touristId**
   - File: `server/src/routes/booking.routes.js` line 1835
   - Updates/creates rooming list entry for tourist
   - Uses upsert (create if doesn't exist, update if exists)
   - Fields: `checkInDate`, `checkOutDate`, `roomPreference`
   - Status: ✅ Working (not being called from frontend)

---

## 🖥️ Frontend Status

### ✅ Rooming List Loading
**Location**: `client/src/pages/BookingDetail.jsx`
- Line 479: `const [accommodationRoomingLists, setAccommodationRoomingLists] = useState({})`
- Line 926-929: Auto-loads rooming lists for all accommodations
- Line 1298-1308: Loads rooming lists when accommodations change (for ER tours)
- Line 1863-1872: Loads accommodation-specific rooming list

**Status**: ✅ Reading works

### ❌ Rooming List Saving
**Search Results**:
```
Pattern: "PUT.*rooming-list|api/bookings.*rooming-list.*touristId"
Result: No matches found
```

**Search Results**:
```
Pattern: "updateTouristRoom|handleRoomChange|assignRoom"
Result: No matches found
```

**Conclusion**: Frontend READS rooming list data but NEVER SAVES it

---

## 💡 How It Should Work

### Correct Workflow:
```
1. User imports Final Rooming List PDF
   ↓
2. Tourist.roomNumber populated (e.g., "DBL-1", "SNGL-3")
   ↓
3. User opens Rooms module for each hotel
   ↓
4. System auto-assigns tourists to hotel based on:
   - Hotel name match
   - Date overlap
   - Accommodation group (UZ vs TM)
   ↓
5. User can manually adjust assignments
   ↓
6. ⚠️ MISSING: Save assignments to accommodationRoomingList table
   ↓
7. Rooming list persists across page reloads
```

### Current Workflow:
```
1. User imports Final Rooming List PDF
   ↓
2. Tourist.roomNumber populated ✅
   ↓
3. User opens Rooms module
   ↓
4. System filters tourists by hotel name/dates ✅
   ↓
5. Calculations work (room counts, costs) ✅
   ↓
6. ❌ NO SAVE FUNCTION - assignments lost on reload
   ↓
7. Every time page reloads → recalculates from scratch
```

---

## 🐛 Known Issues

### Issue #1: Rooming List Not Persisted
**Symptom**: Tourist-hotel assignments not saved to database
**Impact**:
- System recalculates on every page load
- Manual adjustments lost
- Cannot track which tourists stayed at which hotels
- PDF generation relies on fallback logic (hotel name matching)

**Root Cause**: No frontend save function for PUT endpoint

---

### Issue #2: Fallback Logic Instead of DB Data
**Location**: `BookingDetail.jsx` line 14603-14629

```javascript
// Fallback: filter tourists by hotel name and date overlap if rooming list not loaded
if (!accTourists || accTourists.length === 0) {
  console.log(`  → Using fallback filtering`);
  accTourists = tourists.filter(t => {
    // Check hotel name match
    const hotelFirstWord = acc.hotel.name.toLowerCase().split(' ')[0];
    if (!t.hotelName.toLowerCase().includes(hotelFirstWord)) return false;

    // Check date overlap
    // ...
  });
}
```

**Problem**: Always using fallback because `accommodationRoomingList` is empty

---

### Issue #3: No UI for Manual Room Assignment
**Symptom**: Cannot manually move tourists between hotels
**Impact**: If auto-matching fails, no way to fix it manually
**Root Cause**: No drag-and-drop or click-to-assign UI

---

## 📋 Rooms Module UI Features

### Current Features (based on code):

1. **Hotel Cards** (line ~14550-14563)
   - Shows: Hotel name, city, dates, nights count
   - Status: ✅ Working

2. **Summary Card** (line ~14565-14750)
   - Calculates: Total rooms, guests, cost
   - Uses: Rooming list tourists OR fallback filtering
   - Status: ⚠️ Working but using fallback

3. **Room Type Breakdown** (line ~14646-14698)
   - Calculates: DBL, TWN, SNGL, PAX room counts
   - Separates: By accommodation group (UZ vs TM)
   - Status: ✅ Working (calculations correct)

4. **Tourist List Display** (need to check)
   - Shows: Tourists assigned to this hotel
   - Indicates: Room numbers (if assigned)
   - Status: ❓ Need to verify

---

## 🎯 What Needs to Be Fixed

### Priority 1: Save Rooming List Assignments
**Task**: Create save function that calls PUT endpoint
**Endpoint**: `PUT /api/bookings/:id/accommodations/:accId/rooming-list/:touristId`
**When**: After auto-calculation OR manual changes
**Data**: `checkInDate`, `checkOutDate`, `roomPreference`

### Priority 2: Auto-Populate on First Load
**Task**: When accommodations created, auto-populate `accommodationRoomingList`
**Logic**:
- Filter tourists by hotel name match
- Filter by date overlap
- Filter by accommodation group (ER tours)
- Save to database immediately

### Priority 3: Manual Assignment UI
**Task**: Add UI for manual tourist assignment
**Features**:
- Drag-and-drop tourists between hotels
- Click to toggle tourist assignment
- Visual indicator of assigned/unassigned tourists

---

## 🔍 Next Steps

### Immediate Investigation Needed:
1. ✅ Check if rooming list table is empty → CONFIRMED: 0 entries
2. ✅ Check if tourist.roomNumber is populated → CONFIRMED: All assigned
3. ⬜ Check production UI - what does user see in Rooms module?
4. ⬜ Check if there's a "Save" button that's not working
5. ⬜ Check console logs for errors when loading Rooms module

### Questions for User:
1. What specific problem are you experiencing in ER-01 Rooms module?
   - Is the issue with:
     - Room calculations showing wrong numbers?
     - Tourists not showing up in correct hotels?
     - Changes not being saved?
     - PDF generation issues?
     - Something else?

2. Have you manually assigned tourists to hotels in the Rooms module?
   - If yes, do changes persist after page reload?

3. Are there any error messages in the browser console?

---

## 📝 Related Files

### Backend:
- `server/src/routes/booking.routes.js` (lines 1602-1871)
- `server/src/routes/tourist.routes.js` (roomNumber handling)

### Frontend:
- `client/src/pages/BookingDetail.jsx` (lines 14550+)
  - Line 479: `accommodationRoomingLists` state
  - Line 926: Load rooming lists function
  - Line 14587: Rooming list usage in room calculations

### Database:
- Table: `tourist` (has `roomNumber` field)
- Table: `accommodationRoomingList` (many-to-many with dates)

### Debug Scripts:
- `server/check-booking-1.js` - Full booking overview
- `server/check-tourist-rooms.js` - Tourist room assignments
- `server/check-rooming-list-table.js` - Rooming list entries

---

## 🚨 Critical Findings

1. **Backend API exists but frontend doesn't use it**
   - PUT endpoint ready for saving
   - No frontend code calling it

2. **System relies on fallback filtering**
   - Works for simple cases
   - Fails for complex scenarios (mixed groups, multiple visits)

3. **Data loss on reload**
   - Manual changes not persisted
   - Recalculates from scratch every time

---

**Status**: Waiting for user to specify exact issue to fix
