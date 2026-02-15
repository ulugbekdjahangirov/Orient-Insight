# Fix "From Rooming List" Button - Extra Nights Support

## Problem

The "From Rooming List" button only counts the NUMBER of tourists, not their INDIVIDUAL nights.

Example:
- Baetgen: 10.10 - 15.10 = 5 nights
- Others: 13.10 - 15.10 = 2 nights
- Accommodation: 13.10 - 15.10 = 2 nights

Current calculation:
```javascript
roomCounts.SNGL = 5; // 5 tourists
totalCost = 5 × 2 nights × 541,200 = 5,412,000 ❌
```

Correct calculation:
```javascript
guestNights = 13; // Baetgen 5 + others 8
totalCost = 13 guest-nights × 541,200 = 7,035,600 ✓
```

---

## Solution

Add EXTRA NIGHTS detection and create separate room entries for early arrivals.

### File: `client/src/components/booking/HotelAccommodationForm.jsx`

### Change 1: Detect Extra Nights (After Line 894)

```javascript
// Calculate room counts
roomCounts.DBL = Math.ceil(touristsByRoomType.DBL.length / 2);
roomCounts.TWN = Math.ceil(touristsByRoomType.TWN.length / 2);
roomCounts.SNGL = touristsByRoomType.SNGL.length;

// NEW: Calculate extra nights for early arrivals
const extraNightsByRoomType = { DBL: 0, TWN: 0, SNGL: 0 };

if (formData.checkInDate && formData.checkOutDate) {
  const accCheckIn = new Date(formData.checkInDate);
  accCheckIn.setHours(0, 0, 0, 0);
  const accCheckOut = new Date(formData.checkOutDate);
  accCheckOut.setHours(0, 0, 0, 0);
  const accNights = Math.max(0, Math.round((accCheckOut - accCheckIn) / (1000 * 60 * 60 * 24)));

  ['DBL', 'TWN', 'SNGL'].forEach(roomType => {
    touristsByRoomType[roomType].forEach(tourist => {
      // Get tourist's individual dates
      const touristCheckIn = tourist.checkInDate ? new Date(tourist.checkInDate) : accCheckIn;
      const touristCheckOut = tourist.checkOutDate ? new Date(tourist.checkOutDate) : accCheckOut;
      touristCheckIn.setHours(0, 0, 0, 0);
      touristCheckOut.setHours(0, 0, 0, 0);

      const touristNights = Math.max(0, Math.round((touristCheckOut - touristCheckIn) / (1000 * 60 * 60 * 24)));

      // If tourist has extra nights (early arrival or late departure)
      if (touristNights > accNights) {
        const extraNights = touristNights - accNights;
        extraNightsByRoomType[roomType] += extraNights;
        console.log(`  Extra nights for ${tourist.lastName}: ${extraNights} (${touristNights} - ${accNights})`);
      }
    });
  });
}
```

### Change 2: Add Extra Night Rooms (After Line 943)

```javascript
      // Add SNGL rooms
      if (roomCounts.SNGL > 0) {
        const hotelRoomType = selectedHotelRoomTypes.find(rt => rt.name === 'SNGL');
        newRooms.push({
          roomTypeCode: 'SNGL',
          roomsCount: roomCounts.SNGL,
          pricePerNight: calculateTotalPrice(hotelRoomType, hotelTotalRooms)
        });
      }

      // NEW: Add extra nights as separate entries
      if (extraNightsByRoomType.DBL > 0) {
        const hotelRoomType = selectedHotelRoomTypes.find(rt => rt.name === 'DBL');
        newRooms.push({
          roomTypeCode: 'DBL',
          roomsCount: Math.ceil(extraNightsByRoomType.DBL / 2), // Convert guest-nights to room-nights
          pricePerNight: calculateTotalPrice(hotelRoomType, hotelTotalRooms)
        });
      }

      if (extraNightsByRoomType.TWN > 0) {
        const hotelRoomType = selectedHotelRoomTypes.find(rt => rt.name === 'TWN');
        newRooms.push({
          roomTypeCode: 'TWN',
          roomsCount: Math.ceil(extraNightsByRoomType.TWN / 2),
          pricePerNight: calculateTotalPrice(hotelRoomType, hotelTotalRooms)
        });
      }

      if (extraNightsByRoomType.SNGL > 0) {
        const hotelRoomType = selectedHotelRoomTypes.find(rt => rt.name === 'SNGL');
        newRooms.push({
          roomTypeCode: 'SNGL',
          roomsCount: extraNightsByRoomType.SNGL, // Guest-nights = room-nights for SNGL
          pricePerNight: calculateTotalPrice(hotelRoomType, hotelTotalRooms)
        });
      }
    }
```

### Result

After clicking "From Rooming List", the modal will show:
```
TWN × 3: 3,824,400 UZS (regular nights)
SNGL × 5: 5,412,000 UZS (regular nights)
SNGL × 3: 1,623,600 UZS (Baetgen extra nights) ← NEW!
──────────────────────────────────────────────
TOTAL: 10,860,000 UZS ✓
```

---

## Alternative: Simpler Fix

Instead of automatic detection, add a manual button:

```jsx
<button onClick={() => {
  // Add manual extra nights row
  const hotelRoomType = selectedHotelRoomTypes.find(rt => rt.name === 'SNGL');
  setRooms([...rooms, {
    roomTypeCode: 'SNGL',
    roomsCount: 3, // Baetgen's extra nights
    pricePerNight: calculateTotalPrice(hotelRoomType, hotelTotalRooms)
  }]);
}}>
  Add Extra Nights
</button>
```

But this requires user to manually know how many extra nights to add.
