// functions/api/days.js
// PUT: Rename day across all items
// DELETE: Delete all items for a day

export async function onRequestPut(context) {
  try {
    const db = context.env.DB;
    if (!db) {
      return new Response(JSON.stringify({ success: false, error: "D1 database binding 'DB' not found." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await context.request.json();
    const { old_day, new_day } = body;
    if (!old_day || !new_day) {
      return new Response(JSON.stringify({ success: false, error: "old_day and new_day are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    await db.prepare(`
      UPDATE routes_data 
      SET day = ?, 
          sheet_name = REPLACE(sheet_name, ?, ?), 
          updated_at = CURRENT_TIMESTAMP 
      WHERE day = ?
    `).bind(new_day, old_day, new_day, old_day).run();

    return new Response(JSON.stringify({
      success: true,
      message: `Renamed day '${old_day}' to '${new_day}'`
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message || String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function onRequestDelete(context) {
  try {
    const db = context.env.DB;
    if (!db) {
      return new Response(JSON.stringify({ success: false, error: "D1 database binding 'DB' not found." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const url = new URL(context.request.url);
    const day = url.searchParams.get("day");
    if (!day) {
      return new Response(JSON.stringify({ success: false, error: "day parameter required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    await db.prepare("DELETE FROM routes_data WHERE day = ?").bind(day).run();

    return new Response(JSON.stringify({
      success: true,
      message: `Deleted all items for day '${day}'`
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message || String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
