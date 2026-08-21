// functions/api/routes.js
// PUT: Rename route for a specific day
// DELETE: Delete all items in a route for a specific day

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
    const { day, old_route, new_route } = body;
    if (!day || !old_route || !new_route) {
      return new Response(JSON.stringify({ success: false, error: "day, old_route, and new_route are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    await db.prepare(`
      UPDATE routes_data 
      SET route_name = ?, 
          updated_at = CURRENT_TIMESTAMP 
      WHERE day = ? AND route_name = ?
    `).bind(new_route, day, old_route).run();

    return new Response(JSON.stringify({
      success: true,
      message: `Renamed route in '${day}' from '${old_route}' to '${new_route}'`
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
    const route_name = url.searchParams.get("route_name");
    if (!day || !route_name) {
      return new Response(JSON.stringify({ success: false, error: "day and route_name parameters required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    await db.prepare("DELETE FROM routes_data WHERE day = ? AND route_name = ?").bind(day, route_name).run();

    return new Response(JSON.stringify({
      success: true,
      message: `Deleted all items for route '${route_name}' in '${day}'`
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
