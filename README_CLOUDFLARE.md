# คู่มือการนำ Web Application ขึ้น Cloudflare Pages และเชื่อมต่อฐานข้อมูล Cloudflare D1 (ฟรี 100%)

ระบบจัดการสายส่งสินค้านี้ถูกออกแบบมาให้รองรับทั้งการใช้งานแบบ **Local/Offline** ทันที และสามารถ Deploy ขึ้น **Cloudflare Pages** พร้อมเชื่อมต่อฐานข้อมูล **Cloudflare D1 (Serverless SQLite SQL)** ได้อย่างสมบูรณ์แบบ

---

## 🌟 วิธีที่ 1: Deploy ผ่านหน้าเว็บ Cloudflare Dashboard (ง่ายที่สุด ไม่ต้องลงโปรแกรม)

### ขั้นตอนที่ 1: สร้างฐานข้อมูล Cloudflare D1
1. เข้าสู่ระบบ [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. ที่เมนูด้านซ้าย เลือก **Storage & Databases** > **D1 SQL Database**
3. กดปุ่ม **Create Database**
4. ตั้งชื่อฐานข้อมูล เช่น `routes_db` แล้วกด **Create**
5. เมื่อสร้างเสร็จ ให้คลิกเข้าไปที่แท็บ **Console** ในหน้า D1 แล้วคัดลอกคำสั่งจากไฟล์ [`schema.sql`](file:///g:/My%20Drive/WEBAPP/schema.sql) และ [`seed.sql`](file:///g:/My%20Drive/WEBAPP/seed.sql) ไปวางแล้วกด **Execute** (หรือจะไปกดปุ่ม Seed ผ่านหน้าเว็บแอปหลังจากเชื่อมต่อก็ได้)

---

### ขั้นตอนที่ 2: นำโค้ดขึ้น Cloudflare Pages
1. นำโฟลเดอร์ `g:\My Drive\WEBAPP` ไปฝากไว้ที่ **GitHub** (หรือ GitLab) ใน Repository ของคุณ
2. ในหน้า Cloudflare Dashboard เมนูด้านซ้าย เลือก **Workers & Pages** > **Create application** > เลือกแท็บ **Pages**
3. เลือก **Connect to Git** แล้วเลือก Repository ที่คุณสร้างไว้
4. ตั้งค่า Build Settings:
   - **Framework preset**: `None`
   - **Build output directory**: `.` (จุดเดียว)
5. กด **Save and Deploy** รอประมาณ 1-2 นาที คุณจะได้ URL ประจำเว็บ เช่น `https://delivery-routes-xxx.pages.dev`

---

### ขั้นตอนที่ 3: ผูกฐานข้อมูล D1 เข้ากับ Cloudflare Pages
1. ในหน้าโปรเจกต์ Pages ที่เพิ่งสร้าง ไปที่แท็บ **Settings** > **Functions**
2. เลื่อนลงมาที่หัวข้อ **D1 database bindings** แล้วกด **Add binding**
3. กรอกข้อมูล:
   - **Variable name**: `DB` *(ต้องพิมพ์ตัวพิมพ์ใหญ่ `DB` ตามที่โค้ดระบบเรียกใช้)*
   - **D1 database**: เลือก `routes_db` ที่สร้างไว้ในขั้นตอนที่ 1
4. กด **Save**
5. ไปที่แท็บ **Deployments** แล้วกด **Retry deployment** หรือสั่ง Redeploy 1 ครั้ง เพื่อให้การผูก Database มีผล

---

### ขั้นตอนที่ 4: เริ่มต้นใช้งานและทดสอบ
1. เปิด URL เว็บแอปของคุณ
2. กดปุ่ม **Cloudflare DB** (ไอคอนฐานข้อมูลสีเขียวที่มุมขวาบน)
3. หากยังไม่มีข้อมูล สามารถกดปุ่ม **"Seed ข้อมูลขึ้น Cloudflare D1"** ระบบจะทำการอัปโหลดข้อมูล 1,148 รายการขึ้นสู่ D1 ให้ทันทีในคลิกเดียว

---

## 💻 วิธีที่ 2: Deploy ผ่าน Wrangler CLI (สำหรับ Developer)

หากคุณมี Node.js และ Wrangler CLI ติดตั้งอยู่ในเครื่อง สามารถทำตามขั้นตอนต่อไปนี้ได้ทันที:

```bash
# 1. Login Cloudflare
npx wrangler login

# 2. สร้าง D1 Database
npx wrangler d1 create routes_db

# 3. นำ database_id ที่ได้ มาใส่ในไฟล์ wrangler.toml

# 4. สร้างตารางและใส่ข้อมูล 1,148 รายการ
npx wrangler d1 execute routes_db --local --file=./schema.sql
npx wrangler d1 execute routes_db --local --file=./seed.sql

# 5. รันและทดสอบระบบบนเครื่องแบบจำลอง Cloudflare
npx wrangler pages dev . --d1=DB=routes_db

# 6. Deploy ขึ้น Cloudflare Pages Production
npx wrangler pages deploy . --project-name=delivery-routes-webapp
```

---

## 📂 โครงสร้างไฟล์ในโปรเจกต์

| ชื่อไฟล์ | คำอธิบาย |
|---|---|
| `index.html` | หน้าจอหลักของ Web Application (Responsive, Modern Tailwind CSS) |
| `app.js` | Business Logic ทั้งหมด: CRUD, Search, Filter, Reorder, Print, Sync API |
| `styles.css` | สไตล์ตกแต่งเพิ่มเติม และ `@media print` สำหรับจัดหน้ากระดาษ A4 |
| `initial_data.js` | ข้อมูล 1,148 รายการจากไฟล์ Excel ต้นฉบับ สำหรับโหมด Offline & Seed |
| `functions/api/items/index.js` | Cloudflare Pages Function (GET รายการพร้อม Search/Filter, POST เพิ่มร้านค้า) |
| `functions/api/items/[id].js` | Cloudflare Pages Function (PUT แก้ไขข้อมูล, DELETE ลบร้านค้า) |
| `functions/api/items/reorder.js` | Cloudflare Pages Function (POST อัปเดตลำดับสายส่งแบบ Batch) |
| `functions/api/init.js` | Cloudflare Pages Function (Seed ข้อมูล 1,148 รายการใน 1 คลิก) |
| `functions/api/stats.js` | Cloudflare Pages Function (ดึงสรุปยอดร้านค้า/การโอน/สถิติสายส่ง) |
| `schema.sql` | SQL Schema สำหรับ Cloudflare D1 Database |
| `seed.sql` | ข้อมูลเริ่มต้น SQL 1,148 รายการสำหรับรันใน Cloudflare D1 |
| `wrangler.toml` | ไฟล์คอนฟิก Cloudflare Pages & D1 Binding |
