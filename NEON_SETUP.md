# Neon Setup

## 1) Vercel environment variable

Set this in Vercel project settings:

- `DATABASE_URL`

Use your Neon connection string (pooled or direct URL, SSL required).

## 2) First request auto-creates tables

The API initializes schema automatically on first request:

- `schedules`
- `matches`
- `booking_sites`

## 3) Optional: move old Supabase data

If you want to migrate existing data manually, export from Supabase and run SQL inserts into Neon.
The app no longer uses Supabase directly.
