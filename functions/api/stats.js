// functions/api/stats.js
// Summary statistics across routes, days, and remarks

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    if (!db) {
      return new Response(JSON.stringify({ success: false, error: "D1 database binding 'DB' not found." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const totalCount = await db.prepare("SELECT COUNT(*) as total FROM routes_data").first();
    const transferCount = await db.prepare("SELECT COUNT(*) as transfers FROM routes_data WHERE remark LIKE '%โอน%'").first();
    const cashCount = (totalCount ? totalCount.total : 0) - (transferCount ? transferCount.transfers : 0);

    const routesBreakdown = await db.prepare(`
      SELECT day, route_name, COUNT(*) as count 
      FROM routes_data 
      GROUP BY day, route_name 
      ORDER BY 
        CASE day 
          WHEN 'จันทร์' THEN 1 
          WHEN 'อังคาร' THEN 2 
          WHEN 'พุธ' THEN 3 
          WHEN 'พฤหัสบดี' THEN 4 
          WHEN 'ศุกร์' THEN 5 
          WHEN 'เสาร์' THEN 6 
          ELSE 7 
        END, route_name ASC
    `).all();

    return new Response(JSON.stringify({
      success: true,
      data: {
        total: totalCount ? totalCount.total : 0,
        transfers: transferCount ? transferCount.transfers : 0,
        cash: cashCount,
        routes: routesBreakdown.results || []
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
