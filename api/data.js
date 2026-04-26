import { ensureSchema, sql } from './db.js'

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

export default async function handler(req, res) {
  try {
    await ensureSchema()

    if (req.method === 'GET') {
      const [schedules, matches, bookingSites, golfTemplates] = await Promise.all([
        sql`SELECT * FROM schedules ORDER BY date ASC`,
        sql`SELECT * FROM matches ORDER BY date ASC`,
        sql`SELECT * FROM booking_sites ORDER BY name ASC`,
        sql`SELECT * FROM golf_course_templates ORDER BY course_name ASC`,
      ])
      return json(res, 200, { schedules, matches, bookingSites, golfTemplates })
    }

    if (req.method !== 'POST') {
      return json(res, 405, { error: 'Method not allowed' })
    }

    const { entity, action, payload } = req.body ?? {}

    if (entity === 'schedules' && action === 'upsert') {
      const row = payload
      const rows = await sql`
        INSERT INTO schedules (id, date, start_time, end_time, court, note, match_id, sport, title, detail_json)
        VALUES (${row.id}, ${row.date}, ${row.start_time ?? null}, ${row.end_time ?? null}, ${row.court ?? null}, ${row.note ?? null}, ${row.match_id ?? null}, ${row.sport ?? 'tennis'}, ${row.title ?? null}, ${JSON.stringify(row.detail_json ?? {})}::jsonb)
        ON CONFLICT (id) DO UPDATE SET
          date = EXCLUDED.date,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          court = EXCLUDED.court,
          note = EXCLUDED.note,
          match_id = EXCLUDED.match_id,
          sport = EXCLUDED.sport,
          title = EXCLUDED.title,
          detail_json = EXCLUDED.detail_json
        RETURNING *
      `
      return json(res, 200, { row: rows[0] })
    }

    if (entity === 'schedules' && action === 'delete') {
      const { id } = payload
      await sql`DELETE FROM matches WHERE schedule_id = ${id}`
      await sql`DELETE FROM schedules WHERE id = ${id}`
      return json(res, 200, { ok: true })
    }

    if (entity === 'schedules' && action === 'setMatchId') {
      const { id, match_id } = payload
      const rows = await sql`UPDATE schedules SET match_id = ${match_id ?? null} WHERE id = ${id} RETURNING *`
      return json(res, 200, { row: rows[0] })
    }

    if (entity === 'matches' && action === 'upsert') {
      const row = payload
      const rows = await sql`
        INSERT INTO matches (id, schedule_id, date, sets, comment_sungho, comment_yunhee)
        VALUES (${row.id}, ${row.schedule_id}, ${row.date}, ${JSON.stringify(row.sets ?? [])}::jsonb, ${row.comment_sungho ?? null}, ${row.comment_yunhee ?? null})
        ON CONFLICT (id) DO UPDATE SET
          schedule_id = EXCLUDED.schedule_id,
          date = EXCLUDED.date,
          sets = EXCLUDED.sets,
          comment_sungho = EXCLUDED.comment_sungho,
          comment_yunhee = EXCLUDED.comment_yunhee
        RETURNING *
      `
      return json(res, 200, { row: rows[0] })
    }

    if (entity === 'matches' && action === 'delete') {
      const { id } = payload
      await sql`DELETE FROM matches WHERE id = ${id}`
      return json(res, 200, { ok: true })
    }

    if (entity === 'booking_sites' && action === 'upsert') {
      const row = payload
      const rows = await sql`
        INSERT INTO booking_sites (id, name, url, sport, club_name, course_name, side)
        VALUES (${row.id}, ${row.name}, ${row.url ?? null}, ${row.sport ?? 'tennis'}, ${row.club_name ?? null}, ${row.course_name ?? null}, ${row.side ?? null})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          url = EXCLUDED.url,
          sport = EXCLUDED.sport,
          club_name = EXCLUDED.club_name,
          course_name = EXCLUDED.course_name,
          side = EXCLUDED.side
        RETURNING *
      `
      return json(res, 200, { row: rows[0] })
    }

    if (entity === 'booking_sites' && action === 'delete') {
      const { id } = payload
      await sql`DELETE FROM booking_sites WHERE id = ${id}`
      return json(res, 200, { ok: true })
    }

    if (entity === 'golf_templates' && action === 'upsert') {
      const row = payload
      const rows = await sql`
        INSERT INTO golf_course_templates (club_name, course_name, side, holes, updated_at)
        VALUES (${row.club_name ?? ''}, ${row.course_name}, ${row.side ?? 'OUT'}, ${JSON.stringify(row.holes ?? [])}::jsonb, NOW())
        ON CONFLICT (club_name, course_name, side) DO UPDATE SET
          holes = EXCLUDED.holes,
          updated_at = NOW()
        RETURNING *
      `
      return json(res, 200, { row: rows[0] })
    }

    if (entity === 'golf_templates' && action === 'bulkUpsert') {
      const rows = Array.isArray(payload?.rows) ? payload.rows : []
      for (const row of rows) {
        await sql`
          INSERT INTO golf_course_templates (club_name, course_name, side, holes, updated_at)
          VALUES (${row.club_name ?? ''}, ${row.course_name}, ${row.side ?? 'OUT'}, ${JSON.stringify(row.holes ?? [])}::jsonb, NOW())
          ON CONFLICT (club_name, course_name, side) DO UPDATE SET
            holes = EXCLUDED.holes,
            updated_at = NOW()
        `
      }
      return json(res, 200, { ok: true })
    }

    return json(res, 400, { error: 'Invalid action' })
  } catch (error) {
    console.error('[api/data]', error)
    return json(res, 500, { error: error instanceof Error ? error.message : 'Server error' })
  }
}
