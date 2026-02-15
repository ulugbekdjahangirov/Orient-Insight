# Price.jsx - Narxlar Qanday Set Qilinadi

## 📊 Umumiy Tuzilma

Price sahifasi 5 ta tour type uchun narxlarni boshqaradi:
- **ER** (Usbekistan und Turkmanistan)
- **CO** (ComfortPlus)
- **KAS** (Kazakhstan)
- **ZA** (Zentralasian)
- **Preis 2026** (2026 narxlari)

Har bir tour type uchun 10 ta sub-tab bor:
1. **Hotels** - Mehmonxona narxlari
2. **Transport** - Transport marshrutlari
3. **Railway** - Temir yo'l
4. **Fly** - Aviachiptalar
5. **Meal** - Ovqatlanish
6. **Sightseing** - Ekskursiyalar
7. **Guide** - Gid xizmatlari
8. **Shou** - Shou dasturlari
9. **Zusatzkosten** - Qo'shimcha xarajatlar
10. **Total** - Jami narx (avtomatik hisob)

---

## 🔄 Narxlar Qanday Hisoblanadi va Saqlanadi

### Step 1: Har bir sub-tab uchun narxlar to'ldiriladi

```
Hotels tab:
- Tashkent: 3 kun × $X = Total
- Samarkand: 3 kun × $Y = Total
- Asraf: 1 kun × $Z = Total
- Buchara: 3 kun × $A = Total
- Chiwa: 2 kun × $B = Total
```

User "Сохранить" tugmasini bosadi → `saveHotelPrices()` localStorage ga saqlanadi

### Step 2: Barcha sub-tablar to'ldirilgandan keyin

User **Total** tabga o'tadi → Avtomatik hisoblash boshlanadi:

```javascript
// Line 3458-3462: ER Total Price Calculation
const transportPPP = calculateTransportTotals().grandTotal / tier.count;
const price = hotelTotal + transportPPP + railwayTotal + (flyTotal / tier.count) +
              mealTotal + sightseingTotal + (guideTotal / tier.count) + shouTotal;
const commissionPercent = commissionValues[tier.id] || 0;
const commissionAmount = (price * commissionPercent) / 100;
const totalPrice = price + commissionAmount;
```

### Step 3: Har bir PAX tier uchun narx hisoblanadi

```
4 PAX: $2500
5 PAX: $2300
6-7 PAX: $2100
8-9 PAX: $1950
10-11 PAX: $1850
12-13 PAX: $1750
14-15 PAX: $1650  ← ER-01 bu yerda (14 turistlar)
16 PAX: $1550
```

### Step 4: Natijalar `calculatedTotalPrices` ga saqlanadi

```javascript
// Line 3465-3468
calculatedTotalPrices.current[tier.id] = {
  totalPrice: Math.round(totalPrice),    // Asosiy narx
  ezZuschlag: Math.round(ezZuschlag)     // Single room qo'shimcha to'lov
};
```

### Step 5: User "Сохранить" tugmasini bosadi (Total tab da)

```javascript
// Line 2087-2110: saveTotalPrices()
const storageKey = `${selectedTour.id.toLowerCase()}-total-prices`;
// ER uchun: 'er-total-prices'
// CO uchun: 'co-total-prices'
// KAS uchun: 'kas-total-prices'
// ZA uchun: 'za-total-prices'

localStorage.setItem(storageKey, JSON.stringify(calculatedTotalPrices.current));
```

---

## 💾 localStorage da Saqlanadigan Format

### ER Total Prices:
```javascript
localStorage.setItem('er-total-prices', JSON.stringify({
  "4": { "totalPrice": 2500, "ezZuschlag": 350 },
  "5": { "totalPrice": 2300, "ezZuschlag": 320 },
  "6-7": { "totalPrice": 2100, "ezZuschlag": 300 },
  "8-9": { "totalPrice": 1950, "ezZuschlag": 290 },
  "10-11": { "totalPrice": 1850, "ezZuschlag": 295 },
  "12-13": { "totalPrice": 1750, "ezZuschlag": 285 },
  "14-15": { "totalPrice": 1650, "ezZuschlag": 280 },  // ER-01 bu yerdan o'qiydi
  "16": { "totalPrice": 1550, "ezZuschlag": 270 }
}));
```

### ER Zusatzkosten (Qo'shimcha xarajatlar):
```javascript
localStorage.setItem('er_zusatzkosten', JSON.stringify([
  { "name": "Zusatznacht EZ", "price": 60, "pax": false },
  { "name": "Zusatznacht DZ", "price": 80, "pax": false },
  { "name": "Geburtstagsgeschenk", "price": 10, "pax": false },
  { "name": "Extra Transfer in Taschkent", "price": 25, "pax": false }
]));
```

---

## 🔍 Rechnung Qanday O'qiydi

```javascript
// RechnungDocument.jsx line 113
const savedTotalPrices = JSON.parse(
  localStorage.getItem('er-total-prices') || '{}'
);

// ER-01 uchun: 14 turistlar → "14-15" tier
const tierPrices = savedTotalPrices["14-15"] || { totalPrice: 0, ezZuschlag: 0 };

// Invoice items yaratish:
items = [
  {
    id: 1,
    description: 'Usbekistan Teil',
    einzelpreis: tierPrices.totalPrice,  // 1650 (agar set qilingan bo'lsa)
    anzahl: 14,                           // Turistlar soni
    currency: 'USD'
  },
  {
    id: 2,
    description: 'EZ Zuschlag',
    einzelpreis: tierPrices.ezZuschlag,  // 280 (agar set qilingan bo'lsa)
    anzahl: 6,                            // Single room turistlar soni
    currency: 'USD'
  }
];
```

---

## ⚠️ MUAMMO: Narxlar 0 USD

### Sabab 1: localStorage bo'sh
```javascript
localStorage.getItem('er-total-prices')  // null yoki "{}"
```

**Yechim**: Price sahifasiga o'tib, barcha tablarni to'ldirish va Total tabda "Сохранить" bosish

### Sabab 2: Total tab ko'rilmagan
```javascript
if (Object.keys(pricesToSave).length === 0) {
  toast.error('Avval Total tabni oching va ko\'ring!');
  return;
}
```

**Yechim**: Total tabga o'tish (avtomatik hisoblash uchun), keyin "Сохранить"

### Sabab 3: Sub-tablar to'ldirilmagan
Agar Hotels, Transport, va boshqa tablar to'ldirilmagan bo'lsa → Total = 0

**Yechim**: Har bir sub-tabni to'ldirish va saqlash

---

## 📝 TO'G'RI KETMA-KETLIK (ER uchun)

1. **Hotels tab** → Narxlarni to'ldirish → **Сохранить**
   - Tashkent: 3 kun × 60$ = 180$
   - Samarkand: 3 kun × 50$ = 150$
   - Asraf: 1 kun × 30$ = 30$
   - Buchara: 3 kun × 50$ = 150$
   - Chiwa: 2 kun × 55$ = 110$

2. **Transport tab** → Marshrutlarni to'ldirish → **Сохранить**
   - Taschkent: 1 kun × 220$ = 220$
   - Taschkent-Chimgan: 1 kun × 220$ = 220$
   - Va hokazo...

3. **Railway tab** → Narxlarni to'ldirish → **Сохранить**
   - Taschkent-Samarkand: 15$
   - Samarkand-Taschkent: 15$

4. **Fly tab** → Narxlarni to'ldirish → **Сохранить**
   - Istanbul-Taschkent: 350$
   - Taschkent-Istanbul: 350$

5. **Meal tab** → Narxlarni to'ldirish → **Сохранить**
   - Breakfast: 10 kun × 5$ = 50$
   - Lunch: 8 kun × 10$ = 80$
   - Dinner: 8 kun × 15$ = 120$

6. **Sightseing tab** → Narxlarni to'ldirish → **Сохранить**
   - Museum Entry: 20$
   - Guide Service: 30$

7. **Guide tab** → Narxlarni to'ldirish → **Сохранить**
   - Main Guide: 13 kun × 50$ = 650$
   - Local Guide: 5 kun × 30$ = 150$

8. **Shou tab** → Narxlarni to'ldirish → **Сохранить**
   - Show: 2 kun × 20$ = 40$

9. **Zusatzkosten tab** → Qo'shimcha xarajatlarni to'ldirish → **Сохранить**
   - Zusatznacht EZ: 60$
   - Zusatznacht DZ: 80$
   - Geburtstagsgeschenk: 10$
   - Extra Transfer: 25$

10. **Total tab** → Ko'rish (avtomatik hisoblash) → **Сохранить**
    - Bu yerda barcha narxlar jamlanadi
    - Har bir PAX tier uchun total price hisoblanadi
    - "Сохранить" bosganda localStorage ga saqlanadi

11. **Commission** (ixtiyoriy)
    - Har bir PAX tier uchun commission % qo'shish mumkin
    - Masalan: 10% commission → narx 10% oshadi

---

## ✅ TEKSHIRISH (Browser Console)

```javascript
// 1. localStorage da narxlar bormi?
JSON.parse(localStorage.getItem('er-total-prices'))

// Kutilgan natija:
// {
//   "14-15": { "totalPrice": 1650, "ezZuschlag": 280 }
// }

// 2. Zusatzkosten bormi?
JSON.parse(localStorage.getItem('er_zusatzkosten'))

// Kutilgan natija:
// [
//   { "name": "Zusatznacht EZ", "price": 60, "pax": false },
//   { "name": "Zusatznacht DZ", "price": 80, "pax": false }
// ]

// 3. Agar bo'sh bo'lsa:
localStorage.getItem('er-total-prices')  // → null yoki "{}"
```

---

## 🎯 YECHIM (ER-01 uchun)

### Variant 1: Price sahifasida to'ldirish
1. Navigate to: https://booking-calendar.uz/price
2. Select **ER** tab
3. Fill in all sub-tabs (Hotels, Transport, Railway, etc.)
4. Go to **Total** tab
5. Review calculated prices
6. Click **Сохранить** (Save)
7. Go back to ER-01 booking → Documents → Rechnung
8. Refresh page
9. Prices should now show correctly

### Variant 2: Manual localStorage (tezkor test uchun)
```javascript
// Browser console da:
localStorage.setItem('er-total-prices', JSON.stringify({
  "14-15": { "totalPrice": 1650, "ezZuschlag": 280 }
}));

localStorage.setItem('er_zusatzkosten', JSON.stringify([
  { "name": "Zusatznacht EZ", "price": 60, "pax": false },
  { "name": "Zusatznacht DZ", "price": 80, "pax": false },
  { "name": "Geburtstagsgeschenk", "price": 10, "pax": false }
]));

// Keyin Rechnung sahifasini refresh qilish
```

---

## 🚨 MUHIM ESLATMALAR

1. **localStorage browser-ga bog'liq**
   - Har bir kompyuter uchun alohida
   - Agar boshqa kompyuterda ochsangiz → narxlar yo'q
   - Browser cache tozalansa → narxlar yo'qoladi

2. **Total tab ko'rish SHART**
   - Total tabni ochmasangiz → `calculatedTotalPrices` bo'sh
   - "Сохранить" bosganda xatolik: "Avval Total tabni oching!"

3. **Har bir tour type alohida**
   - ER narxlari → `er-total-prices`
   - CO narxlari → `co-total-prices`
   - KAS narxlari → `kas-total-prices`
   - ZA narxlari → `za-total-prices`

4. **PAX tier mos kelishi kerak**
   - ER-01: 14 turistlar → "14-15" tier
   - Agar "14-15" localStorage da yo'q bo'lsa → 0 USD

---

## 📞 Keyingi Qadam

Qaysi yo'nalishda davom etamiz?

1. **Test qilish**: Browser console da localStorage tekshirish
2. **Price sahifasida to'ldirish**: Step-by-step narxlarni to'ldirish
3. **Database ga o'tkazish**: localStorage o'rniga database ishlatish (uzoq muddatli yechim)
4. **Unlock mexanizmi**: Locked invoice larni ochish funksiyasini qo'shish

