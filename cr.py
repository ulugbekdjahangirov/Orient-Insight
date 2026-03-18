import sqlite3
db = sqlite3.connect('/var/www/booking-calendar/server/database/orient-insight.db')
c = db.cursor()
c.execute("SELECT id, bookingYear FROM Booking WHERE bookingNumber='ER-01'")
rows = c.fetchall()
print("Bookings found:", rows)
for row in rows:
    bid, year = row
    c.execute("UPDATE Tourist SET remarks = NULL WHERE bookingId = " + str(bid))
    print("Year", year, "- Cleared:", c.rowcount, "tourists")
db.commit()
db.close()
