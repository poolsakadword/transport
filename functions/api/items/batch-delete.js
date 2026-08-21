// functions/api/items/batch-delete.js
// POST: Batch delete multiple items by ID array

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    if (!db) {
      return new Response(JSON.stringify({ success: false, error: "D1 database binding 'DB' not found." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await context.request.json();
    const ids = body.ids || [];

    if (!Array.isArray(ids) || ids.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "No IDs provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const chunkSize = 50;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const stmts = chunk.map(id => 
        db.prepare("DELETE FROM routes_data WHERE id = ?").bind(id)
      );
      await db.batch(stmts);
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Deleted ${ids.length} items.`,
      count: ids.length
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
