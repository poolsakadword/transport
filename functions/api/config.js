// functions/api/config.js
// Handles GET and POST/PUT for days and routes configuration

export async function onRequestGet(context) {
  const { env } = context;
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ success: false, error: "Database binding missing" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    const row = await db.prepare("SELECT value FROM app_config WHERE key = 'days_and_routes'").first();
    return new Response(JSON.stringify({
      success: true,
      data: row && row.value ? JSON.parse(row.value) : null
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ success: false, error: "Database binding missing" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    const body = await request.json();
    const valueStr = JSON.stringify(body);
    await db.prepare(`
      INSERT INTO app_config (key, value, updated_at) 
      VALUES ('days_and_routes', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).bind(valueStr).run();

    return new Response(JSON.stringify({ success: true, message: "Config saved" }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function onRequestPut(context) {
  return onRequestPost(context);
}
