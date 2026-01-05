# Orient Insight

Tour management platform for organizing group tours, bookings, guides, and accommodations.

## Features

- **Booking Management** - Create and manage tour bookings with dates, participants, and guides
- **Participant Rooming** - Assign participants to rooms, manage rooming lists
- **Hotel & Accommodation** - Manage hotels, room types, seasonal pricing, and images
- **Guide Management** - Track guides with encrypted sensitive data (passports, bank details)
- **Excel Import/Export** - Bulk import bookings and export participant lists
- **PDF Export** - Generate participant lists as PDF documents
- **Dashboard Analytics** - View statistics, upcoming tours, and charts
- **Role-Based Access** - Admin and Manager roles with different permissions

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, Tailwind CSS, React Router |
| Backend | Express.js, Node.js |
| Database | SQLite with Prisma ORM |
| Auth | JWT, bcryptjs |
| Export | XLSX, PDFKit |

## Prerequisites

- Node.js 18+
- npm

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd orient-insight
```

2. Install server dependencies:
```bash
cd server
npm install
```

3. Configure environment variables:
```bash
# server/.env
DATABASE_URL=file:../database/orient-insight.db
JWT_SECRET=your-secret-key
PORT=3001
ENCRYPTION_KEY=your-32-character-encryption-key
```

4. Initialize the database:
```bash
npm run db:generate
npm run db:push
npm run db:seed  # Optional: seed with sample data
```

5. Install client dependencies:
```bash
cd ../client
npm install
```

## Running the Application

Start the backend server:
```bash
cd server
npm run dev
```

In a separate terminal, start the frontend:
```bash
cd client
npm run dev
```

Access the application at **http://localhost:3000**

## Project Structure

```
orient-insight/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Route pages
│   │   ├── services/       # API client
│   │   └── store/          # Auth context
│   └── package.json
├── server/                 # Express backend
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Auth middleware
│   │   └── utils/          # Helpers (encryption, etc.)
│   ├── prisma/
│   │   └── schema.prisma   # Database schema
│   └── package.json
└── uploads/                # File uploads
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/login` | User authentication |
| `GET /api/bookings` | List bookings |
| `GET /api/bookings/:id` | Booking details |
| `GET /api/bookings/:id/participants` | Booking participants |
| `GET /api/guides` | List guides |
| `GET /api/hotels` | List hotels |
| `GET /api/dashboard/stats` | Dashboard statistics |

All endpoints except `/api/auth/login` require JWT authentication via `Authorization: Bearer <token>` header.

## License

Private
