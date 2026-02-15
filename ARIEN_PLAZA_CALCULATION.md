# Arien Plaza Hotel - To'g'ri Hisoblash

## 📍 Hotel Ma'lumotlari
- **Hotel**: Arien Plaza, Tashkent
- **Accommodation Dates**: 13.10.2025 - 15.10.2025 (2 kecha)
- **Booking**: ER-01 (yoki boshqa)

## 🚨 Muammo
- **Database**: totalCost = 9,506,400 so'm (8 guests, 8 rooms)
- **Roaming List**: 11 tourists
- **Natija**: Tizim database narxini ishlatmoqda, Roaming List ni ignore qilmoqda

## 👥 Turistlar (Console Log dan)

### SNGL Guests (5 ta):
```
1. Baetgen (SNGL):
   Check-in:  10.10.2025  ← ERTA KELISH!
   Check-out: 15.10.2025
   Nights: 5 | Placement: Turkmenistan

2. Hahlbrock (SNGL):
   Check-in:  13.10.2025
   Check-out: 15.10.2025
   Nights: 2 | Placement: Turkmenistan

3. Neubauer (SNGL):
   Check-in:  13.10.2025
   Check-out: 15.10.2025
   Nights: 2 | Placement: Turkmenistan

4. Pflster (SNGL):
   Check-in:  13.10.2025
   Check-out: 15.10.2025
   Nights: 2 | Placement: Uzbekistan

5. Reiher (SNGL):
   Check-in:  13.10.2025
   Check-out: 15.10.2025
   Nights: 2 | Placement: Turkmenistan
```

### TWN Guests (3 ta - 1.5 rooms):
```
6. Diermeier (TWN):
   Check-in:  13.10.2025
   Check-out: 15.10.2025
   Nights: 2 | Placement: Turkmenistan

7. Diermeier (TWN):
   Check-in:  13.10.2025
   Check-out: 15.10.2025
   Nights: 2 | Placement: Turkmenistan

8. Haumann (TWN):
   Check-in:  13.10.2025
   Check-out: 15.10.2025
   Nights: 2 | Placement: Turkmenistan
```

### Qolgan Turistlar (3 ta - console da to'liq ko'rinmayapti):
```
9. ? - ehtimol TWN yoki SNGL
10. ? - ehtimol TWN yoki SNGL
11. ? - ehtimol TWN yoki SNGL
```

**Jami**: 11 tourists

---

## 💰 To'g'ri Narx Hisoblash

### Narxlar (Screenshot dan):
- **TWN**: 682,400 so'm/kecha (incl. tax)
- **SNGL**: 541,200 so'm/kecha (incl. tax)

### Guest-nights Hisoblash:

#### SNGL Tourist-nights:
```
1. Baetgen:    5 nights × 541,200 = 2,706,000 so'm
2. Hahlbrock:  2 nights × 541,200 = 1,082,400 so'm
3. Neubauer:   2 nights × 541,200 = 1,082,400 so'm
4. Pflster:    2 nights × 541,200 = 1,082,400 so'm
5. Reiher:     2 nights × 541,200 = 1,082,400 so'm
───────────────────────────────────────────────────
Jami SNGL (5 ta):  13 nights = 7,035,600 so'm
```

#### TWN Tourist-nights → Room-nights:
```
Guest-nights:
6. Diermeier:  2 nights
7. Diermeier:  2 nights
8. Haumann:    2 nights
───────────────────────
Jami: 6 guest-nights → 3 room-nights (6 / 2 = 3)

Cost: 3 room-nights × 682,400 = 2,047,200 so'm
```

### Qolgan 3 Turistni Taxmin Qilish:

**Variant A**: Agar 3 ta TWN bo'lsa (1.5 room):
```
3 guest-nights → 1.5 room-nights
1.5 × 682,400 = 1,023,600 so'm
```

**Variant B**: Agar 2 TWN + 1 SNGL bo'lsa:
```
TWN: 2 guests → 1 room × 682,400 = 682,400 so'm
SNGL: 1 guest × 2 nights × 541,200 = 1,082,400 so'm
Jami: 1,764,800 so'm
```

**Variant C**: Agar 3 ta SNGL bo'lsa:
```
3 guests × 2 nights × 541,200 = 3,247,200 so'm
```

---

## 📊 To'g'ri Total (Minimal Variant A):

```
SNGL (5 ta):           7,035,600 so'm
TWN (3 ta - 1.5 room): 2,047,200 so'm
Qolgan (3 ta TWN):     1,023,600 so'm
─────────────────────────────────────
JAMI:                 10,106,400 so'm ✓
```

**Database ko'rsatyapti**: 9,506,400 so'm ❌
**Farq**: **-600,000 so'm** (kam!)

---

## 🔍 Xulosa

### Nima bo'ldi?
1. Database da **eski narx saqlangan** (9,506,400 so'm)
2. Roaming List da **yangi turistlar qo'shilgan** yoki **sanalar o'zgargan**
3. Tizim **database narxini ishlatmoqda**, Roaming List ni ignore qilmoqda
4. Natija: **Kam narx ko'rsatilmoqda** (600k so'm kam)

### Nega Console da 11 ta turist bor lekin 8 ta deyapti?
```javascript
// Code line 14755-14760
if (acc.totalCost > 0) {
  totalGuests = acc.totalGuests || 0;  // Database: 8 (ESKI)
  usedRoomingList = false;              // Roaming List ignore!
}
```

Console:
- **Individual tourists**: 11 ta ko'rsatiladi (har doim)
- **Summary totalGuests**: 8 ko'rsatiladi (database dan)
- **usedRoomingList**: NO ✗ (database ishlatilmoqda)

---

## ✅ Yechim

### Tavsiya: Accommodation ni Edit qiling

1. **Arien Plaza** kartasida **Edit** (✏️) tugmasini bosing
2. Modal ochilganda:
   - **Total Cost** ni **0** ga yoki **bo'sh** qoldiring
   - **Total Rooms** ni **0** ga yoki **bo'sh** qoldiring
   - **Total Guests** ni **0** ga yoki **bo'sh** qoldiring
3. **Save** bosing
4. Sahifa reload bo'ladi
5. Console da ko'ring:
   ```
   ✓ Used rooming list - Total: 10,106,400 (11 guests, 8 rooms)
   usedRoomingList: 'YES ✓'
   ```

### Yoki: Backend SQL (Direct)

```sql
-- Accommodation ID ni toping (masalan, 123)
UPDATE accommodations
SET totalCost = NULL,
    totalRooms = NULL,
    totalGuests = NULL
WHERE id = 123;
```

---

## 🎯 Tekshirish

Yechimdan keyin:
1. Console da `usedRoomingList: 'YES ✓'` bo'lishi kerak
2. `totalGuests: 11` bo'lishi kerak
3. Total cost: **~10,000,000 so'm** atrofida (qolgan 3 ta mehmon tipiga qarab)
4. Roaming List va Summary bir xil bo'lishi kerak

---

## 📞 Keyingi Qadam

Agar muammo hal bo'lmasa:
1. Browser console da to'liq log ni ko'rsating
2. Qolgan 3 ta mehmon kim ekanligini aniqlang (roaming list jadvalida scroll qiling)
3. Backend accommodation ma'lumotlarini tekshiring
