// _worker.js - Cloudflare Pages Advanced Mode Worker
// Handles all API endpoints (/api/*) with Cloudflare D1 database and serves static assets via env.ASSETS

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ==================== API ROUTING ====================
    if (url.pathname.startsWith("/api/")) {
      const db = env.DB;
      const jsonHeader = { "Content-Type": "application/json" };

      // Helper to respond with JSON
      const json = (data, status = 200) => 
        new Response(JSON.stringify(data), { status, headers: jsonHeader });

      // 1. GET /api/stats
      if (url.pathname === "/api/stats" && request.method === "GET") {
        if (!db) return json({ success: false, error: "D1 database binding 'DB' not found." }, 500);
        try {
          const totalCount = await db.prepare("SELECT COUNT(*) as total FROM routes_data").first();
          const transferCount = await db.prepare("SELECT COUNT(*) as transfers FROM routes_data WHERE remark LIKE '%โอน%'").first();
          const total = totalCount ? totalCount.total : 0;
          const transfers = transferCount ? transferCount.transfers : 0;
          const cash = total - transfers;

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

          return json({
            success: true,
            data: {
              total,
              transfers,
              cash,
              routes: routesBreakdown.results || []
            }
          });
        } catch (err) {
          return json({ success: false, error: err.message || String(err) }, 500);
        }
      }

      // 2. POST /api/init (Seed database)
      if (url.pathname === "/api/init" && request.method === "POST") {
        if (!db) return json({ success: false, error: "D1 database binding 'DB' not found." }, 500);
        try {
          await db.prepare(`
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
            )
          `).run();
          await db.prepare("CREATE INDEX IF NOT EXISTS idx_day_route ON routes_data (day, route_name)").run();
          await db.prepare("CREATE INDEX IF NOT EXISTS idx_customer_code ON routes_data (customer_code)").run();
          await db.prepare("CREATE INDEX IF NOT EXISTS idx_customer_name ON routes_data (customer_name)").run();

          const body = await request.json().catch(() => ({}));
          const items = body.items || [];
          const force = body.force === true;

          if (items.length > 0) {
            if (force) {
              await db.prepare("DELETE FROM routes_data").run();
            }
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
            return json({ success: true, message: `Seeded ${items.length} items to D1`, count: items.length });
          }
          return json({ success: true, message: "Schema initialized." });
        } catch (err) {
          return json({ success: false, error: err.message || String(err) }, 500);
        }
      }

      // 3. POST /api/items/reorder
      if (url.pathname === "/api/items/reorder" && request.method === "POST") {
        if (!db) return json({ success: false, error: "D1 database binding 'DB' not found." }, 500);
        try {
          const body = await request.json();
          const items = body.items || [];
          const chunkSize = 50;
          for (let i = 0; i < items.length; i += chunkSize) {
            const chunk = items.slice(i, i + chunkSize);
            const stmts = chunk.map(item => 
              db.prepare("UPDATE routes_data SET sequence = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                .bind(item.sequence, item.id)
            );
            await db.batch(stmts);
          }
          return json({ success: true, message: `Updated sequence for ${items.length} items.` });
        } catch (err) {
          return json({ success: false, error: err.message || String(err) }, 500);
        }
      }

      // 4. GET /api/items & POST /api/items
      if (url.pathname === "/api/items") {
        if (!db) return json({ success: false, error: "D1 database binding 'DB' not found." }, 500);

        if (request.method === "GET") {
          try {
            const day = url.searchParams.get("day");
            const route_name = url.searchParams.get("route_name");
            const search = url.searchParams.get("search");
            const sort_by = url.searchParams.get("sort_by") || "sequence";
            const sort_dir = url.searchParams.get("sort_dir") || "ASC";

            let q = "SELECT * FROM routes_data WHERE 1=1";
            const params = [];

            if (day && day !== "all") {
              q += " AND day = ?";
              params.push(day);
            }
            if (route_name && route_name !== "all") {
              q += " AND route_name = ?";
              params.push(route_name);
            }
            if (search && search.trim() !== "") {
              const s = `%${search.trim()}%`;
              q += " AND (customer_name LIKE ? OR customer_code LIKE ? OR remark LIKE ?)";
              params.push(s, s, s);
            }

            const validSortCols = ["sequence", "customer_name", "customer_code", "remark", "id"];
            const sortCol = validSortCols.includes(sort_by) ? sort_by : "sequence";
            const sortDirection = sort_dir.toUpperCase() === "DESC" ? "DESC" : "ASC";
            q += ` ORDER BY day ASC, route_name ASC, ${sortCol} ${sortDirection}`;

            const { results } = await db.prepare(q).bind(...params).all();
            return json({ success: true, data: results, count: results.length });
          } catch (err) {
            return json({ success: false, error: err.message || String(err) }, 500);
          }
        }

        if (request.method === "POST") {
          try {
            const body = await request.json();
            const { day, route_name, customer_name, customer_code, remark, sequence } = body;
            if (!day || !route_name || !customer_name || !customer_code) {
              return json({ success: false, error: "Missing required fields" }, 400);
            }

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

            return json({
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
            }, 201);
          } catch (err) {
            return json({ success: false, error: err.message || String(err) }, 500);
          }
        }
      }

      // 5. /api/items/:id (GET, PUT, DELETE)
      const itemMatch = url.pathname.match(/^\/api\/items\/(\d+)$/);
      if (itemMatch) {
        if (!db) return json({ success: false, error: "D1 database binding 'DB' not found." }, 500);
        const id = itemMatch[1];

        if (request.method === "GET") {
          const item = await db.prepare("SELECT * FROM routes_data WHERE id = ?").bind(id).first();
          if (!item) return json({ success: false, error: "Item not found" }, 404);
          return json({ success: true, data: item });
        }

        if (request.method === "PUT") {
          const body = await request.json();
          const { day, route_name, customer_name, customer_code, remark, sequence } = body;
          const existing = await db.prepare("SELECT * FROM routes_data WHERE id = ?").bind(id).first();
          if (!existing) return json({ success: false, error: "Item not found" }, 404);

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
          `).bind(updatedDay, updatedRoute, updatedSheet, updatedSeq, updatedName, updatedRemark, updatedCode, id).run();

          return json({
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
          });
        }

        if (request.method === "DELETE") {
          const existing = await db.prepare("SELECT * FROM routes_data WHERE id = ?").bind(id).first();
          if (!existing) return json({ success: false, error: "Item not found" }, 404);
          await db.prepare("DELETE FROM routes_data WHERE id = ?").bind(id).run();
          return json({ success: true, message: "Item deleted", id: Number(id) });
        }
      }

      return json({ success: false, error: "Not Found" }, 404);
    }

    // ==================== STATIC ASSETS FALLBACK ====================
    return env.ASSETS.fetch(request);
  }
};
