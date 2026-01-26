# Gmail Integration - Automatic Booking Import

This document explains how to set up and use the Gmail integration feature that automatically imports booking schedules from email screenshots.

## Overview

The system polls Gmail every 5 minutes for new emails with screenshot attachments from whitelisted senders. It uses Claude AI Vision to parse the booking table and automatically creates or updates bookings in the database.

**Flow:**
1. Email arrives with booking screenshot attachment
2. System detects new email from whitelisted sender
3. Screenshot is downloaded and analyzed by Claude AI
4. Booking data is extracted and validated
5. Bookings are created/updated in database
6. Email notification sent to admin

## Prerequisites

1. **Google Cloud Project** with Gmail API enabled
2. **OAuth 2.0 Credentials** (Client ID and Secret)
3. **Anthropic API Key** for Claude AI
4. **Gmail Account** for sending notifications

## Setup Instructions

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Gmail API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click "Enable"

### 2. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client ID"
3. Configure OAuth consent screen:
   - User Type: Internal or External
   - App name: Orient Insight
   - Scopes: Add `https://www.googleapis.com/auth/gmail.readonly` and `https://www.googleapis.com/auth/gmail.modify`
4. Create OAuth Client ID:
   - Application type: Web application
   - Name: Orient Insight Gmail Integration
   - Authorized redirect URIs:
     - Development: `http://localhost:3001/api/gmail/callback`
     - Production: `https://booking-calendar.uz/api/gmail/callback`
5. Copy the Client ID and Client Secret

### 3. Get Anthropic API Key

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to API Keys
4. Create a new API key
5. Copy the key (starts with `sk-ant-`)

### 4. Configure Gmail App Password (for notifications)

1. Enable 2-Step Verification on your Google Account
2. Go to Google Account > Security > App passwords
3. Generate app password for "Mail"
4. Copy the 16-character password

### 5. Update Environment Variables

Add the following to `server/.env`:

```env
# Gmail API Credentials
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REDIRECT_URI=http://localhost:3001/api/gmail/callback

# Gmail Polling
GMAIL_POLL_ENABLED=true
GMAIL_POLL_INTERVAL=5

# Email Notifications
GMAIL_USER=noreply@orient-insight.com
GMAIL_APP_PASSWORD=your-16-char-app-password
GMAIL_NOTIFY_EMAIL=admin@orient-insight.com

# Claude AI
ANTHROPIC_API_KEY=sk-ant-your-api-key

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

### 6. Authorize Gmail Access

1. Start the server: `cd server && npm run dev`
2. Log in as Admin
3. Navigate to **Gmail Settings** page
4. Click **"Подключить Gmail"** button
5. Sign in with your Google account
6. Grant permissions
7. You'll be redirected back with success message

## Usage

### Configure Email Whitelist

1. Go to **Gmail Settings** page
2. Add email addresses or domains to whitelist:
   - Individual email: `booking@example.com`
   - Entire domain: `@orient-tours.de`
3. Click **"Сохранить настройки"**

### Manual Polling

To check for new emails immediately:
1. Go to **Gmail Settings**
2. Click **"Проверить сейчас"** button

### View Import History

1. Navigate to **Email Imports** page
2. View all import attempts with status
3. Filter by status (Success, Failed, etc.)
4. Click **"Детали"** to view:
   - Raw parsed data from Claude AI
   - Error messages (if failed)
   - Screenshot preview
5. Retry failed imports with **"Повторить"** button

## Email Format Requirements

The system expects emails with:
- **Attachment**: PNG, JPG, or PDF screenshot
- **Content**: Table with booking schedule data

### Expected Table Format

The screenshot should contain a table with these columns:
- **Reise**: Booking code (e.g., "26CO-USB01")
- **Abflugtag DEP**: Departure day
- **DEP FRA**: Departure date from Frankfurt
- **ARR TAS**: Arrival date in Tashkent
- **UGC-TAS**: Return date from Urgench to Tashkent
- **DEP TAS**: Departure date from Tashkent
- **ARR FRA**: Arrival date in Frankfurt
- Flight numbers in column headers (e.g., "TK368")

### Example Table

```
Reise      | Abflugtag | DEP FRA  | ARR TAS  | UGC-TAS  | DEP TAS  | ARR FRA
-----------+-----------+----------+----------+----------+----------+----------
26CO-USB01 | Sonntag   | 15.03.26 | 16.03.26 | 27.03.26 | 28.03.26 | 28.03.26
26CO-USB02 | Montag    | 16.03.26 | 17.03.26 | 28.03.26 | 29.03.26 | 29.03.26
```

## Troubleshooting

### Import Failed with "Not a booking table"

- **Cause**: Screenshot doesn't contain recognizable table
- **Solution**: Ensure screenshot clearly shows booking schedule table

### Import Status: MANUAL_REVIEW

- **Cause**: Import failed 3 times automatically
- **Solution**:
  1. Click "Детали" to view error
  2. Fix underlying issue (e.g., invalid tour type)
  3. Click "Повторить" to retry

### No New Emails Detected

- **Causes**:
  - Email not from whitelisted sender
  - No image/PDF attachment
  - Email already processed
- **Solution**: Check email whitelist and ensure email has attachment

### Gmail Authentication Expired

- **Symptom**: "Gmail not authenticated" in logs
- **Solution**: Re-authorize Gmail from Settings page

### Claude API Rate Limit

- **Symptom**: "Rate limit exceeded" errors
- **Solution**: Wait for rate limit reset or upgrade Anthropic plan

## API Endpoints

### OAuth
- `POST /api/gmail/authorize` - Get OAuth URL
- `GET /api/gmail/callback` - OAuth callback
- `GET /api/gmail/status` - Check connection status
- `POST /api/gmail/disconnect` - Disconnect Gmail

### Polling
- `POST /api/gmail/poll` - Manually trigger polling (Admin only)

### Imports
- `GET /api/gmail/imports` - List all imports (paginated)
- `GET /api/gmail/imports/:id` - Get import details
- `POST /api/gmail/imports/:id/retry` - Retry failed import (Admin only)
- `DELETE /api/gmail/imports/:id` - Delete import (Admin only)

### Settings
- `GET /api/gmail/settings` - Get whitelist
- `POST /api/gmail/settings` - Update whitelist (Admin only)

## Cron Job

The Gmail polling job runs automatically:
- **Interval**: Every 5 minutes (configurable via `GMAIL_POLL_INTERVAL`)
- **Enable/Disable**: Set `GMAIL_POLL_ENABLED=false` to disable
- **Logs**: Check server console for polling activity

## Database Schema

### EmailImport Table

```prisma
model EmailImport {
  id              Int       @id @default(autoincrement())
  gmailMessageId  String    @unique
  emailSubject    String?
  emailFrom       String
  emailDate       DateTime
  attachmentName  String?
  attachmentUrl   String?
  attachmentType  String?
  status          String    @default("PENDING")
  rawParsedData   String?
  errorMessage    String?
  bookingsCreated Int       @default(0)
  bookingsUpdated Int       @default(0)
  bookingIds      String?
  processedAt     DateTime?
  processedBy     String?   @default("SYSTEM")
  retryCount      Int       @default(0)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

### SystemSetting Table

```prisma
model SystemSetting {
  id        Int      @id @default(autoincrement())
  key       String   @unique
  value     String
  encrypted Boolean  @default(false)
  updatedAt DateTime @updatedAt
}
```

## Cost Estimate

- **Claude API**: ~$0.02 per email × 50 emails/month = **$1/month**
- **Gmail API**: Free (within quota: 1 billion quota units/day)
- **Total**: ~$1/month

## Security Considerations

1. **OAuth Tokens**: Stored encrypted in database
2. **Whitelist**: Only emails from approved senders are processed
3. **File Storage**: Attachments saved to `/uploads/gmail/` directory
4. **Admin Only**: OAuth setup and settings require admin role
5. **Email Privacy**: Processed emails marked as read and labeled "PROCESSED"

## Support

For issues or questions:
- Check server logs: `cd server && npm run dev`
- View import details in Email Imports page
- Contact system administrator

---

**Last Updated**: January 2026
**Version**: 1.0.0
