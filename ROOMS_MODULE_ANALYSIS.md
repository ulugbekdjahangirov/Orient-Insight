# 🏨 Rooms Moduli va Hotel Narxlarini Hisoblash - To'liq Tahlil

## 📍 Joylashuv
**Fayl**: `client/src/pages/BookingDetail.jsx`
**Qatorlar**: 14354 - 16000+ (Rooms tab section)

---

## 🎯 Umumiy Tuzilma

### 1. Rooms Tab Tarkibi
- **Statistika kartochalari**: Total guests, DBL/TWN/SNGL xonalar soni
- **Hotel kartochalari**: Har bir hotel uchun alohida karta
- **Narx hisoblash**: Avtomatik va manual narxlar
- **PDF generatsiya**: Rooming List va Hotel Request PDFlari

### 2. Turli Tur Tiplari uchun Avtomatik Hotel Yaratish

#### ER Hotels (Eurasia Route)
- **Rang**: Yashil gradient (green-500 to emerald-600)
- **Boshlang'ich sana**: `booking.arrivalDate` (Germaniyadan kelish +1 kun)
- **3 ta ssenari**:
  - **Only TM**: Faqat Turkmaniston turistlari (oxirgi Tashkent hoteli o'tkazib yuboriladi)
  - **Only UZ**: Faqat O'zbekiston turistlari (Malika Khorazm 2 kecha)
  - **Mixed**: UZ + TM turistlari (Malika Khorazm 3 kecha TM, 2 kecha UZ)
- **6-chi hotel**: Agar oxirgi hotel Tashkentda bo'lmasa, Arien Plaza qo'shiladi (UZ qaytish uchun)

#### CO Hotels (Combination)
- **Rang**: Binafsha gradient (purple-500 to violet-600)
- **Boshlang'ich sana**: `booking.arrivalDate` (Germaniyadan kelish +1 kun)
- **Xususiyat**: Khiva hotellari **har doim 2 kecha** (3 kecha emas!)
- **Lokatsiya**: `BookingDetail.jsx:4568-4578` - Khiva checkout +1 qo'shilmaydi

#### KAS Hotels (Kazakhstan, Kyrgyzstan, Uzbekistan)
- **Rang**: Amber gradient (amber-500 to orange-600)
- **Boshlang'ich sana**: O'zbekistonga kelish = `departureDate + (firstUzbekistanHotelDay - 1)`
- **Misol**: Tur 01.09 boshlanadi, birinchi UZ hotel 15-kun → kelish = 01.09 + 14 = 15.09
- **Lokatsiya**: `BookingDetail.jsx:4647-4687` - Uzbekiston hotellar filtrlash
- **Turistlarni yangilash**: Barcha turistlarning `checkInDate` O'zbekistonga kelish sanasiga o'zgartiriladi

#### ZA Hotels (Zentralasian - Tajikistan orqali)
- **Rang**: Ko'k-yashil gradient (teal-500 to cyan-600)
- **Boshlang'ich sana**: `departureDate + 4 kun` (Tajikistonda 4 kun)
- **Itinerary**: 11 kun (Days 6-9: Tajikistan - hotel yo'q)
  - Days 1-3: Dargoh Hotel (Bukhara) - 3 kecha
  - Days 4-5: Jahongir (Samarkand) - 2 kecha
  - Days 6-9: Tajikistan - 4 kun (hotel yo'q)
  - Day 10: Arien Plaza (Tashkent) - 1 kecha
  - Day 11: Qozog'iston (hotel yo'q)
- **Turistlarni yangilash**: Barcha turistlarning `checkInDate` O'zbekistonga kelish sanasiga o'zgartiriladi (departureDate + 4)

---

## 💰 Narx Hisoblash Algoritmi

### Uch Daraja Narx Manbai (Prioritet Tartibida)

#### 1. Saqlangan Database Narxi (Eng Yuqori Prioritet)
```javascript
if (acc.totalCost && acc.totalCost > 0) {
  totalCost = parseFloat(acc.totalCost) || 0;
  totalRooms = acc.totalRooms || 0;
  totalGuests = acc.totalGuests || 0;
}
```
**Sabab**: Qo'lda o'zgartirilgan narxlarni saqlash
**Lokatsiya**: `BookingDetail.jsx:14755-14760`

#### 2. Rooming List dan Hisoblash (O'rta Prioritet)
```javascript
else if (accTourists.length > 0 && acc.checkInDate && acc.checkOutDate) {
  // Har bir tourist uchun:
  // 1. checkInDate/checkOutDate ni aniqlash
  // 2. nights = (checkOut - checkIn) / (1000*60*60*24)
  // 3. guest-nights ni xona tipiga qarab hisoblash
}
```
**Formula**:
- **Guest-nights**: Har bir mehmon uchun kechalar soni
- **Room-nights**: Guest-nights / guests_per_room
  - DBL/TWN: guest-nights / 2
  - SNGL: guest-nights / 1
  - PAX: guest-nights / 1
- **Cost**: room-nights × pricePerNight

**Lokatsiya**: `BookingDetail.jsx:14761-14910`

#### 3. Rooms Data dan Hisoblash (Fallback)
```javascript
else if (acc.rooms?.length > 0) {
  acc.rooms.forEach(room => {
    totalCost += roomCount × pricePerNight × nights;
  });
}
```
**Lokatsiya**: `BookingDetail.jsx:14914-14938`

### Narx Formula Tafsilotlari

#### A. Oddiy Hotel Narxi
```javascript
const basePrice = roomType.pricePerNight;
const vatAmount = roomType.vatIncluded ? basePrice × 0.12 : 0;
const priceWithVat = basePrice + vatAmount;
```

#### B. Tourist Tax Hisoblash
```javascript
if (roomType.touristTaxEnabled && roomType.brvValue > 0) {
  const totalRooms = hotel.totalRooms || 0;

  // Hotel o'lchami bo'yicha foiz
  let percentage = totalRooms <= 10 ? 0.05 :    // 5% (kichik)
                   totalRooms <= 40 ? 0.10 :    // 10% (o'rta)
                   0.15;                         // 15% (katta)

  // UZS da hisoblash
  let touristTaxUZS = brvValue × percentage × guestsPerRoom;

  // Valyutaga o'girish
  if (currency === 'USD') touristTax = touristTaxUZS / 12700;
  else if (currency === 'EUR') touristTax = touristTaxUZS / 13500;
  else touristTax = touristTaxUZS;
}

finalPrice = priceWithVat + touristTax;
```
**Lokatsiya**: `BookingDetail.jsx:4772-4797`

#### C. PAX Pricing (Guesthouse/Yurta)
```javascript
if (hotel.stars === 'Guesthouse' || hotel.stars === 'Yurta') {
  totalCost = guestNights × paxPricePerNight;
  // Xonalar emas, mehmonlar soni hisoblanadi
}
```

---

## 📊 Hisoblash Breakdown Namoyish

### Detalizatsiya Elementi
```javascript
calculationBreakdown = [
  {
    roomType: 'DBL',
    roomNights: 5.5,              // 11 guest-nights / 2
    pricePerNight: 45.00,
    totalCost: 247.50,            // 5.5 × 45.00
    guestNights: 11,
    details: [
      { name: 'Schmidt', nights: 6, checkIn: '12.10', checkOut: '18.10' },
      { name: 'Mueller', nights: 5, checkIn: '13.10', checkOut: '18.10' }
    ]
  },
  // ... boshqa xona tiplari
]
```

### Display Format
```
📊 Hisob-kitob tafsilotlari (dropdown)
  DBL: 5.5 room-nights × $45.00 ......... $247.50
    • Schmidt: 6 nights (12.10 - 18.10)
    • Mueller: 5 nights (13.10 - 18.10)

  TWN: 3.0 room-nights × $45.00 ......... $135.00
  SNGL: 2.0 room-nights × $65.00 ........ $130.00
  ────────────────────────────────────────────────
  Umumiy: ................................ $512.50
```

**Lokatsiya**: `BookingDetail.jsx:15058-15116`

---

## 🔍 Debug Console Logs

### Hotel Card da Console Output
```javascript
console.groupCollapsed(`💰 ${hotelName} - TOTAL: ${displayCost} ${currency}`);
console.log('Hotel dates:', { checkIn, checkOut, nights });
console.log('Summary:', {
  totalCost,
  currency,
  totalRooms,
  totalGuests,
  usedRoomingList: 'YES ✓' / 'NO ✗'
});

// Har bir mehmon uchun
console.log(`📋 Individual tourists (${count}):`);
tourists.forEach((t, idx) => {
  console.log(`  ${idx+1}. ${t.lastName} (${t.roomPreference}):`);
  console.log(`     Check-in:  ${checkIn}`);
  console.log(`     Check-out: ${checkOut}`);
  console.log(`     Nights: ${nights}`);
});

// Xona tipi bo'yicha
console.log(`💵 Cost calculation by room type:`);
breakdown.forEach(item => {
  console.log(`  ${item.roomType}:`);
  console.log(`    Guest-nights: ${item.guestNights}`);
  console.log(`    Room-nights: ${item.roomNights}`);
  console.log(`    Price/night: ${item.pricePerNight} ${currency}`);
  console.log(`    Subtotal: ${item.totalCost} ${currency}`);
});
console.groupEnd();
```

**Lokatsiya**: `BookingDetail.jsx:14948-14997`

---

## 🎨 UI Display Komponentlari

### 1. Statistika Kartochkalari (Top)
```jsx
{/* Total Guests */}
<div className="bg-gradient-to-br from-primary-50 to-primary-100">
  <Users /> {totalGuests} guests
</div>

{/* DBL Rooms */}
<div className="bg-gradient-to-br from-blue-50 to-blue-100">
  <Bed /> {roomCounts.DBL} rooms
</div>

{/* TWN Rooms */}
<div className="bg-gradient-to-br from-emerald-50 to-emerald-100">
  <Bed /> {roomCounts.TWN} rooms
</div>

{/* SNGL Rooms */}
<div className="bg-gradient-to-br from-violet-50 to-violet-100">
  <User /> {roomCounts.SNGL} rooms
</div>
```
**Lokatsiya**: `BookingDetail.jsx:14554-14632`

### 2. Hotel Card Summary
```jsx
<div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50">
  {/* Rooms Count */}
  <div className="bg-orange-100">
    <Bed /> {totalRooms} Rooms
  </div>

  {/* Guests Count */}
  <div className="bg-green-100">
    <Users /> {totalGuests} Guests
  </div>

  {/* Total Cost */}
  <div className="text-3xl font-black text-blue-700">
    {displayCost} {currencySymbol}
  </div>
</div>
```
**Lokatsiya**: `BookingDetail.jsx:15007-15055`

### 3. Xona Tiplari Display
```jsx
{/* Regular rooms */}
<span className="bg-blue-100 border-blue-400">
  DBL × {dblCount} | TWN × {twnCount} | SNGL × {snglCount}
</span>

{/* PAX display */}
<span className="bg-gradient-to-br from-purple-50 to-violet-100">
  PAX: {totalGuests} guests ({paxPrice} {currency}/person/night)
</span>
```
**Lokatsiya**: `BookingDetail.jsx:15121-15148`

---

## 🔧 Kritik Funktsiyalar

### 1. `autoFillAccommodationsFromItinerary()`
**Vazifasi**: Tur dasturidan avtomatik hotellar yaratish
**Lokatsiya**: `BookingDetail.jsx:4313-4900`

**Jarayon**:
1. Mavjud hotellarni o'chirish (tasdiqlash so'raladi)
2. Tur dasturini yuklash (`tourTypesApi.getItinerary()`)
3. Turistlarni yuklash (`touristsApi.getAll()`)
4. Turistlarni UZ/TM bo'yicha ajratish
5. Ketma-ket kunlarni hotel bo'yicha guruhlash
6. Har bir hotel uchun:
   - Check-in/check-out sanalarini hisoblash
   - Xonalar sonini hisoblash (roomPreference dan)
   - Narxni hisoblash (VAT + tourist tax)
7. Database ga saqlash
8. Turistlarning checkInDate ni yangilash (KAS/ZA uchun)

### 2. Room Counts Calculation
**Lokatsiya**: `BookingDetail.jsx:14473-14541`

```javascript
// Unique rooms by type
tourists.forEach(t => {
  const roomType = getRoomType(t.roomNumber || t.roomPreference);

  if (t.roomNumber && !seenRooms[roomType].has(t.roomNumber)) {
    roomCounts[roomType]++;
    seenRooms[roomType].add(t.roomNumber);
  } else if (!t.roomNumber) {
    touristsWithoutRoom[roomType]++;
  }
});

// Xona raqamisiz turistlar uchun
roomCounts.DBL += Math.ceil(touristsWithoutRoom.DBL / 2);
roomCounts.TWN += Math.ceil(touristsWithoutRoom.TWN / 2);
roomCounts.SNGL += touristsWithoutRoom.SNGL;
```

### 3. Tourist Check-in Date Calculation
**ER Tours - Individual Dates**:
```javascript
// Har bir tourist o'z sanasiga ega (Mrs. Baetgen: 09.10)
// Boshqalar booking.departureDate dan foydalanadi (12.10)
if (tourist.checkInDate && tourist.checkOutDate) {
  checkIn = new Date(tourist.checkInDate);
  checkOut = new Date(tourist.checkOutDate);
} else {
  checkIn = new Date(acc.checkInDate);
  checkOut = new Date(acc.checkOutDate);
}
```
**Lokatsiya**: `BookingDetail.jsx:14776-14786`

**KAS Tours - Uzbekistan Arrival**:
```javascript
// Birinchi Uzbekiston hotelini topish
const firstUzHotelDay = 15; // Masalan
baseDate = departureDate + (firstUzHotelDay - 1);
// 01.09 + 14 = 15.09 ✓
```
**Lokatsiya**: `BookingDetail.jsx:14647-4687`

**ZA Tours - After Tajikistan**:
```javascript
baseDate = departureDate + 4 days;
// Tajikistonda 4 kun o'tkazilgandan keyin
```
**Lokatsiya**: `BookingDetail.jsx:4408-4412`

---

## 🐛 Ma'lum Muammolar va Yechimlar

### 1. CO Tours - Khiva 3 Kecha Muammosi ✅ FIXED
**Muammo**: Khiva hotellari 3 kecha yaratilardi (2 kecha bo'lishi kerak)
**Sabab**: checkout = endDay + 1 (standart formula)
**Yechim**: CO + Khiva uchun +1 qo'shilmaydi
```javascript
if (isCOTour && isKhivaHotel) {
  checkOutDate = baseDate + (endDay - firstHotelDay); // +1 yo'q!
}
```
**Lokatsiya**: `BookingDetail.jsx:4699-4711`
**Commit**: 2026-02-13

### 2. KAS Tours - Arrivaldate Muammosi ✅ FIXED
**Muammo**: Hotel check-in tur boshlanish sanasidan boshlanardi
**Sabab**: `booking.arrivalDate` ishonchsiz KAS uchun
**Yechim**: O'zbekiston kelishini dasturdan hisoblash
```javascript
const uzbekistanArrival = departureDate + (firstUzHotelDay - 1);
```
**Lokatsiya**: `BookingDetail.jsx:4647-4687`
**Commits**: 7a8b561, 700b0ab
**Date**: 2026-02-13

### 3. ER Tours - Booking Date Override ✅ FIXED
**Muammo**: booking.departureDate eng erta tourist sanasiga o'rnatilardi
**Sabab**: PDF import logic
**Yechim**: PDF dan asosiy tur sanalarini ajratib olish va override qilish
```javascript
// PDF: "Tour: ... 12.10.2025 – 31.10.2025"
booking.departureDate = '2025-10-12'; // Override
booking.endDate = '2025-10-31';
```
**Lokatsiya**: `server/src/routes/tourist.routes.js:3529-3564`
**Commits**: 0b09637, 983a178
**Date**: 2026-02-12

---

## 📄 PDF Generatsiya

### 1. Rooming List
**Route**: `GET /:bookingId/rooming-list-preview`
**Lokatsiya**: `server/src/routes/tourist.routes.js:4400-4800`
**Xususiyatlari**:
- Barcha hotellar bitta PDFda
- Hotel visit numbering (Birinchi zaezd, Vtoroy zaezd, etc.)
- Guide ma'lumotlari (ism + telefon)

### 2. Single Hotel Request
**Route**: `GET /:bookingId/hotel-request-preview/:accommodationId`
**Lokatsiya**: `server/src/routes/tourist.routes.js:5000-5400`
**Xususiyatlari**:
- Bitta hotel uchun
- Filename: `ЗАЯВКА ${bookingNumber} - ${hotelName}.pdf`
- Guide ma'lumotlari

### 3. Combined Hotel Request
**Route**: `GET /:bookingId/hotel-request-combined/:hotelId`
**Lokatsiya**: `server/src/routes/tourist.routes.js:5800-6200`
**Xususiyatlari**:
- Bir xil hoteldagi barcha tashrif uchun
- Visit numbering

---

## 🎯 Asosiy Takliflar

1. **Console Logs**: Har doim brauzer konsolini tekshiring - juda batafsil ma'lumot
2. **Database Priority**: Saqlangan narxlar eng yuqori prioritet (manual o'zgarishlar)
3. **Rooming List**: Eng aniq hisoblash - har bir mehmon uchun individual sanalar
4. **Tour Type Logic**: Har bir tur tipi uchun o'ziga xos qoidalar
5. **Currency Auto-detect**: Agar totalCost > 10000 → UZS

---

## 📞 Keyingi Qadamlar

Agar qo'shimcha savollar bo'lsa:
1. Qaysi tur tipi? (ER, CO, KAS, ZA)
2. Qaysi hotel?
3. Qaysi muammo? (Narx, sanalar, xonalar soni?)
4. Browser console da qanday xabar?

**Muhim**: Har doim brauzer console loglarini tekshiring - u yerda barcha hisoblashlar batafsil ko'rsatiladi!
