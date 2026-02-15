# Hisob-kitob Tafsilotlari Avtomatik Ochilish - Yechim

## 🐛 Muammo

"Hisob-kitob tafsilotlari" `<details>` elementi avtomatik ochiladi (birozdan keyin).

## 🔍 Sabab

HTML `<details>` elementi **state saqlamaydi** React re-render bo'lganda.

## ✅ Yechim

`<details>` ni **controlled component** qilish - `open` state bilan boshqarish.

---

## 📝 Kod O'zgarishi

### Fayl: `client/src/pages/BookingDetail.jsx`

### Qadam 1: State Qo'shish

Find the component state section (top of the component, around line 470-480), add:

```javascript
// Find existing useState declarations, add this:
const [openCalculationBreakdowns, setOpenCalculationBreakdowns] = useState({});
// Object format: { [accommodationId]: true/false }
```

### Qadam 2: `<details>` ni O'zgartirish

**OLDIN (Line 15059):**
```jsx
<details className="group">
  <summary className="cursor-pointer px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center justify-between">
    <span className="text-sm font-medium text-gray-700">📊 Hisob-kitob tafsilotlari</span>
    <ChevronDown className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" />
  </summary>
  <div className="mt-2 p-4 bg-white border border-gray-200 rounded-lg space-y-3">
    {/* ... */}
  </div>
</details>
```

**KEYIN:**
```jsx
<details
  className="group"
  open={openCalculationBreakdowns[acc.id] || false}
  onToggle={(e) => {
    setOpenCalculationBreakdowns(prev => ({
      ...prev,
      [acc.id]: e.target.open
    }));
  }}
>
  <summary className="cursor-pointer px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center justify-between">
    <span className="text-sm font-medium text-gray-700">📊 Hisob-kitob tafsilotlari</span>
    <ChevronDown className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" />
  </summary>
  <div className="mt-2 p-4 bg-white border border-gray-200 rounded-lg space-y-3">
    {/* ... */}
  </div>
</details>
```

---

## 📋 Qisqacha O'zgarishlar

1. **State qo'shish**: `openCalculationBreakdowns` object (har bir accommodation uchun)
2. **`open` attribute**: State dan o'qiladi
3. **`onToggle` event**: Foydalanuvchi ochganda/yopganda state yangilanadi

---

## 🎯 Natija

- ✅ Foydalanuvchi "Hisob-kitob tafsilotlari" ochsa, **ochiq qoladi**
- ✅ Foydalanuvchi yopsa, **yopiq qoladi**
- ✅ React re-render bo'lsa ham, **state saqlanadi**
- ✅ Har bir accommodation **alohida state** ga ega (bittasi ochiq, boshqasi yopiq bo'lishi mumkin)

---

## 🔧 Qo'lda O'zgartirish (Agar Kerak Bo'lsa)

Agar siz faqat **default yopiq** holatini xohlasangiz (state kerak emas):

```jsx
<details className="group" open={false}>
  {/* ... */}
</details>
```

Lekin bu **controlled** emas - foydalanuvchi ochsa ham, re-render bo'lganda yana yopiladi.

---

## 💡 Tavsiya

**Controlled component** (state bilan) afzalroq, chunki:
- Foydalanuvchi preferensasi saqlanadi
- Re-render muammosi yo'qoladi
- Har bir accommodation alohida boshqariladi
