# ER Tour Hotel Calculation - Test Plan

**IMPORTANT**: This test plan MUST be followed before deploying any changes to hotel calculation logic.

## Test Booking: ER-03

### Prerequisites
1. Server running on port 3001
2. Client running on port 3000
3. Browser: Chrome/Edge with DevTools open (Console tab)
4. User logged in as ADMIN or MANAGER

### Test Cases

#### 1. Arien Plaza (First Hotel) - Early Arrival Test
**Location**: ER-03 → Rooms Module → Arien Plaza (13.10.25 — 15.10.25)

**Expected Behavior**:
- **Card Display**:
  - Total Cost: ~10,860,000 UZS
  - ROOMS: 8
  - GUESTS: 11
  - 3 nights badge

- **Edit Modal → Hisob-kitob tafsilotlari**:
  - Mrs. Baetgen: **5 nights** (22.10 - 25.10) - Early arrival
  - All other tourists: **2 nights** (22.10 - 25.10)
  - TWN: 3.0 room-nights × $50.00 = $150.00
  - SNGL: 5.0 room-nights × $33.00 = $165.00

**Console Logs to Check**:
```
🏨 [Arien Plaza ID:xxx]
   Rooming list tourists: 11
```

**Pass Criteria**:
✅ Card total matches Edit modal total
✅ Baetgen shows 5 nights in Hisob-kitob
✅ Other tourists show 2 nights
✅ Total cost ~10,860,000 UZS

#### 2. Malika Khorazm - UZ/TM Split Test
**Location**: ER-03 → Rooms Module → Malika Khorazm (22.10.25 — 25.10.25)

**Expected Behavior**:
- **Card Display**:
  - Total Cost: $945.00
  - ROOMS: 8
  - GUESTS: 11
  - 3 nights badge

- **Edit Modal → Rooming List - Nights Calculation**:
  - **UZ tourists** (Mr. Pfister): **2 nights** (22.10 - 24.10)
  - **TM tourists** (others): **3 nights** (22.10 - 25.10)

- **Backend Console Logs**:
```
🟢 UZ tourist in TM hotel: Mr. Pfister, Peter Günter
   Adjusted checkout: Sat Oct 25 2025 → 2025-10-24
   Nights: 2, Remarks: "2 Nights | ..."
```

**Calculation**:
- TWN: (3 tourists × 3 nights + 3 tourists × 3 nights) / 2 = 9.0 room-nights × $50.00 = $450.00
- SNGL: (5 TM tourists × 3 nights + 1 UZ tourist × 2 nights) = 17.0 room-nights × $33.00 = $561.00? (verify exact numbers)

**Pass Criteria**:
✅ Card total = $945.00
✅ Backend logs show "🟢 UZ tourist in TM hotel"
✅ Mr. Pfister shows 2 nights in rooming list
✅ Other tourists show 3 nights
✅ Edit modal matches card total

#### 3. Jahongir - Normal Hotel Test
**Location**: ER-03 → Rooms Module → Jahongir (15.10.25 — 18.10.25)

**Expected Behavior**:
- **Card Display**:
  - Total Cost: $1,050.00
  - ROOMS: 8
  - GUESTS: 11
  - 3 nights badge

- **Edit Modal**:
  - ALL tourists: **3 nights** (15.10 - 18.10)
  - No UZ/TM adjustments
  - No early arrivals

**Pass Criteria**:
✅ All tourists show 3 nights
✅ No backend "UZ tourist" logs for this hotel
✅ Card total matches edit modal

#### 4. "Из программы тура" Button Test
**Location**: ER-03 → Rooms Module → "Из программы тура" button

**Steps**:
1. Delete all existing accommodations (confirm when prompted)
2. Click "Из программы тура" button
3. Wait 2 seconds (auto-recalculation delay)
4. Check all hotel cards

**Expected Console Logs**:
```
🔄 Recalculating totals for all accommodations...
✅ Updated Arien Plaza: 10,860,000 UZS
✅ Updated Jahongir: 1,050 UZS
✅ Updated Malika Khorazm: 945 UZS
✅ All totals updated
```

**Pass Criteria**:
✅ Arien Plaza shows correct total immediately (not after Edit)
✅ Malika Khorazm shows correct total immediately
✅ All hotels show correct costs without opening Edit modal

### Regression Tests

After any modification to hotel calculation logic, verify:

1. **Other Tour Types** (CO, KAS, ZA):
   - Check CO-01, KAS-01, ZA-01 bookings still calculate correctly
   - No UZ/TM split logic should apply (unless they have such splits)

2. **PAX Hotels** (Guesthouses, Yurta):
   - Yaxshigul's Guesthouse still shows PAX calculation
   - Price per person, not per room

3. **Auto-fill from Rooming List**:
   - Open any hotel Edit modal
   - Room types should auto-populate from rooming list
   - Totals should match immediately

### Troubleshooting

**Issue**: Card total ≠ Edit modal total
- **Check**: `accommodationRoomingLists` state loaded on page load (BookingDetail.jsx:783-803)
- **Fix**: Ensure `loadData()` calls `getAccommodationRoomingList()` for all accommodations

**Issue**: UZ tourist shows 3 nights instead of 2 in Malika Khorazm
- **Check**: Tourist `accommodation` field = "Uzbekistan" or "Uz" in Participants module
- **Check**: Backend logs show "🟢 UZ tourist in TM hotel"
- **Fix**: Set tourist.accommodation field correctly

**Issue**: Baetgen shows 2 nights instead of 5 in Arien Plaza
- **Check**: Tourist `checkInDate` = 2025-10-10 (3 days before group)
- **Check**: Arien Plaza is first accommodation (earliest checkInDate)
- **Fix**: Verify early arrival detection logic (daysDiff >= 2)

**Issue**: Auto-recalculation not working after "Из программы тура"
- **Check**: Console shows "🔄 Recalculating totals..."
- **Check**: setTimeout delay = 1500ms
- **Fix**: Verify tourist filtering by date overlap

## Code Locations Reference

### Backend
- `server/src/routes/booking.routes.js`:
  - Line 1625-1692: UZ tourist in TM hotel adjustment
  - Line 1553-1710: Rooming list API endpoint
  - Line 773-920: Cost calculation

### Frontend
- `client/src/components/booking/HotelAccommodationForm.jsx`:
  - Line 222-256: Total cost calculation
  - Line 493-607: Display calculation
- `client/src/pages/BookingDetail.jsx`:
  - Line 4310-4450: Card view calculation
  - Line 783-803: Auto-load rooming lists
  - Line 1674-1796: Auto-recalculation after itinerary import

## Version Control

When committing changes to hotel calculation:

**Commit Message Format**:
```
[ER-CRITICAL] Brief description

- What changed
- Why it changed
- Test results (ER-03 verification)

Tested:
✅ ER-03 Arien Plaza early arrival
✅ ER-03 Malika Khorazm UZ/TM split
✅ ER-03 auto-fill from itinerary
```

**Example**:
```
[ER-CRITICAL] Fix Malika Khorazm UZ tourist calculation

- Use rooming list dates from backend API instead of accommodation dates
- Backend already adjusts UZ tourist checkout -1 day for Khiva hotels
- Frontend now respects backend-calculated dates

Tested:
✅ ER-03 Malika Khorazm: UZ tourists 2 nights, TM tourists 3 nights
✅ Card total = $945.00 matches edit modal
✅ Backend logs show "UZ tourist in TM hotel" for Mr. Pfister
```
