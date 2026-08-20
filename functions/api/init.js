// functions/api/init.js
// Initialize Cloudflare D1 database table and seed data

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    if (!db) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "D1 database binding 'DB' not found. Please bind D1 in Cloudflare Pages Settings." 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 1. Create table and indexes if not exists
    await db.exec(`
      CREATE TABLE IF NOT EXISTS routes_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day TEXT NOT NULL,
        route_name TEXT NOT NULL,
        sheet_name TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        customer_name TEXT NOT NULL,
        remark TEXT,
        customer_code TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_day_route ON routes_data (day, route_name);
      CREATE INDEX IF NOT EXISTS idx_customer_code ON routes_data (customer_code);
      CREATE INDEX IF NOT EXISTS idx_customer_name ON routes_data (customer_name);
    `);

    // 2. Check if table has data
    const countResult = await db.prepare("SELECT COUNT(*) as count FROM routes_data").first();
    const currentCount = countResult ? countResult.count : 0;

    const requestBody = await context.request.json().catch(() => ({}));
    const forceSeed = requestBody.force === true;

    if (currentCount > 0 && !forceSeed) {
      return new Response(JSON.stringify({
        success: true,
        message: "Database already initialized and contains data.",
        count: currentCount
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. Seed data from payload or request
    const items = requestBody.items || [];
    if (items.length > 0) {
      if (forceSeed) {
        await db.prepare("DELETE FROM routes_data").run();
      }

      // Batch insert in chunks of 50 for Cloudflare D1 performance
      const chunkSize = 50;
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const stmts = chunk.map(item => 
          db.prepare(`
            INSERT INTO routes_data (id, day, route_name, sheet_name, sequence, customer_name, remark, customer_code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            item.id,
            item.day,
            item.route_name,
            item.sheet_name,
            item.sequence,
            item.customer_name,
            item.remark || "",
            item.customer_code
          )
        );
        await db.batch(stmts);
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Successfully seeded ${items.length} records into Cloudflare D1.`,
        count: items.length
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Database table created. Ready for data.",
      count: 0
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
