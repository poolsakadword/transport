// functions/api/items/reorder.js
// Batch update sequence of items in a route

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
    const items = body.items; // Array of { id, sequence }

    if (!Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Invalid items array" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Update sequences in batches
    const chunkSize = 50;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const stmts = chunk.map(item => 
        db.prepare("UPDATE routes_data SET sequence = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
          .bind(item.sequence, item.id)
      );
      await db.batch(stmts);
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Updated sequence for ${items.length} items.`
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
