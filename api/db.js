import { neon } from '@neondatabase/serverless'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

const sql = neon(connectionString)

let initialized = false

export async function ensureSchema() {
  if (initialized) return
  await sql`
    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      court TEXT,
      note TEXT,
      match_id TEXT
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      schedule_id TEXT NOT NULL,
      date TEXT NOT NULL,
      sets JSONB NOT NULL DEFAULT '[]'::jsonb,
      comment_sungho TEXT,
      comment_yunhee TEXT
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS booking_sites (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT,
      sport TEXT,
      club_name TEXT,
      course_name TEXT,
      side TEXT
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS golf_course_templates (
      club_name TEXT NOT NULL DEFAULT '',
      course_name TEXT NOT NULL DEFAULT '',
      side TEXT NOT NULL DEFAULT 'OUT',
      holes JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`ALTER TABLE schedules ADD COLUMN IF NOT EXISTS sport TEXT`
  await sql`ALTER TABLE schedules ADD COLUMN IF NOT EXISTS title TEXT`
  await sql`ALTER TABLE schedules ADD COLUMN IF NOT EXISTS detail_json JSONB`
  await sql`UPDATE schedules SET sport = COALESCE(sport, 'tennis')`
  await sql`UPDATE schedules SET title = COALESCE(title, court, '테니스 일정')`
  await sql`UPDATE schedules SET detail_json = COALESCE(detail_json, '{}'::jsonb)`
  await sql`ALTER TABLE booking_sites ADD COLUMN IF NOT EXISTS sport TEXT`
  await sql`ALTER TABLE booking_sites ADD COLUMN IF NOT EXISTS club_name TEXT`
  await sql`ALTER TABLE booking_sites ADD COLUMN IF NOT EXISTS course_name TEXT`
  await sql`ALTER TABLE booking_sites ADD COLUMN IF NOT EXISTS side TEXT`
  await sql`ALTER TABLE booking_sites ALTER COLUMN url DROP NOT NULL`
  await sql`UPDATE booking_sites SET sport = COALESCE(sport, 'tennis')`
  await sql`UPDATE booking_sites SET side = COALESCE(side, 'OUT')`
  await sql`UPDATE booking_sites SET club_name = COALESCE(club_name, '')`
  await sql`UPDATE booking_sites SET course_name = COALESCE(course_name, '')`
  await sql`ALTER TABLE golf_course_templates ADD COLUMN IF NOT EXISTS club_name TEXT DEFAULT ''`
  await sql`ALTER TABLE golf_course_templates ADD COLUMN IF NOT EXISTS side TEXT DEFAULT 'OUT'`
  await sql`ALTER TABLE golf_course_templates ALTER COLUMN club_name SET NOT NULL`
  await sql`ALTER TABLE golf_course_templates ALTER COLUMN course_name SET NOT NULL`
  await sql`ALTER TABLE golf_course_templates ALTER COLUMN side SET NOT NULL`
  await sql`ALTER TABLE golf_course_templates DROP CONSTRAINT IF EXISTS golf_course_templates_pkey`
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS golf_course_templates_key ON golf_course_templates (club_name, course_name, side)`
  initialized = true
}

export { sql }
