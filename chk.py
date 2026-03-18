import sqlite3
db = sqlite3.connect('/var/www/booking-calendar/server/database/orient-insight.db')
c = db.cursor()
c.execute("SELECT COUNT(*) FROM Tourist t JOIN Booking b ON t.bookingId=b.id WHERE b.bookingNumber='ER-01'")
print('Total tourists:', c.fetchone()[0])
c.execute("SELECT t.firstName, t.lastName, t.remarks FROM Tourist t JOIN Booking b ON t.bookingId=b.id WHERE b.bookingNumber='ER-01' AND t.remarks IS NOT NULL")
rows = c.fetchall()
print('With remarks:', len(rows))
for r in rows:
    print(' -', r[0], r[1], ':', r[2][:60] if r[2] else '')
db.close()
