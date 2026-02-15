-- Arien Plaza accommodation uchun saqlangan narxni reset qilish
-- Bu tizimni Rooming List dan qayta hisoblashga majbur qiladi

UPDATE accommodations 
SET totalCost = NULL, 
    totalRooms = NULL, 
    totalGuests = NULL
WHERE hotelId IN (SELECT id FROM hotels WHERE name LIKE '%Arien Plaza%')
  AND bookingId = ?;  -- Bu yerga booking ID kiriting

-- Yoki aniq accommodation ID bo'yicha:
-- UPDATE accommodations SET totalCost = NULL WHERE id = ?;
