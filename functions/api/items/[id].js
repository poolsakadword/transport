// functions/api/items/[id].js
// GET, PUT, DELETE single delivery item by ID

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    const id = context.params.id;

    const item = await db.prepare("SELECT * FROM routes_data WHERE id = ?").bind(id).first();
    if (!item) {
      return new Response(JSON.stringify({ success: false, error: "Item not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ success: true, data: item }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message || String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function onRequestPut(context) {
  try {
    const db = context.env.DB;
    const id = context.params.id;
    const body = await context.request.json();

    const { day, route_name, customer_name, customer_code, remark, sequence } = body;

    const existing = await db.prepare("SELECT * FROM routes_data WHERE id = ?").bind(id).first();
    if (!existing) {
      return new Response(JSON.stringify({ success: false, error: "Item not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const updatedDay = day || existing.day;
    const updatedRoute = route_name || existing.route_name;
    const updatedName = customer_name !== undefined ? customer_name.trim() : existing.customer_name;
    const updatedCode = customer_code !== undefined ? String(customer_code).trim() : existing.customer_code;
    const updatedRemark = remark !== undefined ? remark.trim() : existing.remark;
    const updatedSeq = sequence !== undefined ? Number(sequence) : existing.sequence;
    const updatedSheet = body.sheet_name || existing.sheet_name;

    await db.prepare(`
      UPDATE routes_data 
      SET day = ?, route_name = ?, sheet_name = ?, sequence = ?, customer_name = ?, remark = ?, customer_code = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      updatedDay,
      updatedRoute,
      updatedSheet,
      updatedSeq,
      updatedName,
      updatedRemark,
      updatedCode,
      id
    ).run();

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: Number(id),
        day: updatedDay,
        route_name: updatedRoute,
        sheet_name: updatedSheet,
        sequence: updatedSeq,
        customer_name: updatedName,
        remark: updatedRemark,
        customer_code: updatedCode
      }
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
    const id = context.params.id;

    const existing = await db.prepare("SELECT * FROM routes_data WHERE id = ?").bind(id).first();
    if (!existing) {
      return new Response(JSON.stringify({ success: false, error: "Item not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    await db.prepare("DELETE FROM routes_data WHERE id = ?").bind(id).run();

    return new Response(JSON.stringify({
      success: true,
      message: "Item deleted successfully",
      id: Number(id)
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
