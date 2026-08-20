-- Cloudflare D1 Database Schema for Delivery Routes WebApp
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
