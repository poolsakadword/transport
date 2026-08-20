// functions/api/items/index.js
// GET: Fetch items with day, route, and search filter
// POST: Create a new delivery item

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    if (!db) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "D1 database binding 'DB' not found." 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const url = new URL(context.request.url);
    const day = url.searchParams.get("day");
    const route_name = url.searchParams.get("route_name");
    const search = url.searchParams.get("search");
    const sort_by = url.searchParams.get("sort_by") || "sequence";
    const sort_dir = url.searchParams.get("sort_dir") || "ASC";

    let query = "SELECT * FROM routes_data WHERE 1=1";
    const params = [];

    if (day && day !== "all") {
      query += " AND day = ?";
      params.push(day);
    }

    if (route_name && route_name !== "all") {
      query += " AND route_name = ?";
      params.push(route_name);
    }

    if (search && search.trim() !== "") {
      const s = `%${search.trim()}%`;
      query += " AND (customer_name LIKE ? OR customer_code LIKE ? OR remark LIKE ?)";
      params.push(s, s, s);
    }

    // Sorting
    const validSortCols = ["sequence", "customer_name", "customer_code", "remark", "id"];
    const sortCol = validSortCols.includes(sort_by) ? sort_by : "sequence";
    const sortDirection = sort_dir.toUpperCase() === "DESC" ? "DESC" : "ASC";

    query += ` ORDER BY day ASC, route_name ASC, ${sortCol} ${sortDirection}`;

    const stmt = db.prepare(query).bind(...params);
    const { results } = await stmt.all();

    return new Response(JSON.stringify({
      success: true,
      data: results,
      count: results.length
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: err.message || String(err) 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    if (!db) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "D1 database binding 'DB' not found." 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await context.request.json();
    const { day, route_name, customer_name, customer_code, remark, sequence } = body;

    if (!day || !route_name || !customer_name || !customer_code) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Missing required fields: day, route_name, customer_name, customer_code" 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Calculate sequence if not provided
    let finalSeq = sequence;
    if (finalSeq === undefined || finalSeq === null || isNaN(finalSeq)) {
      const maxSeqResult = await db.prepare(
        "SELECT MAX(sequence) as max_seq FROM routes_data WHERE day = ? AND route_name = ?"
      ).bind(day, route_name).first();
      finalSeq = (maxSeqResult && maxSeqResult.max_seq ? maxSeqResult.max_seq : 0) + 1;
    }

    const sheet_name = body.sheet_name || `${day}${route_name.replace("สาย ", "").replace("สำรอง", "สำรอง")}`;

    const insertResult = await db.prepare(`
      INSERT INTO routes_data (day, route_name, sheet_name, sequence, customer_name, remark, customer_code, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      day,
      route_name,
      sheet_name,
      finalSeq,
      customer_name.trim(),
      remark ? remark.trim() : "",
      String(customer_code).trim()
    ).run();

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: insertResult.meta.last_row_id,
        day,
        route_name,
        sheet_name,
        sequence: finalSeq,
        customer_name,
        remark: remark || "",
        customer_code
      }
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: err.message || String(err) 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
