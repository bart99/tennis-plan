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
      url TEXT NOT NULL
    )
  `
  initialized = true
}

export { sql }
