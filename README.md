# Iron Log

Web app ส่วนตัวสำหรับคุมวินัยการฝึก Kettlebell / Dumbbell กฎและเหตุผลของการออกแบบอยู่ใน [DESIGN.md](DESIGN.md)

ไม่มีขั้นตอน build: HTML/CSS/JS ล้วน ข้อมูลเก็บใน localStorage ของเครื่อง

## รันบนเครื่อง
```bash
python -m http.server 8765
```
แล้วเปิด http://localhost:8765

## เทสต์
```bash
node --test tests/logic.test.mjs
```

## ปล่อยเวอร์ชันใหม่
1. แก้ `VERSION` ใน `sw.js` (เช่น `iron-log-v2`) ไม่อย่างนั้นมือถือจะใช้ไฟล์เก่าจาก cache
2. commit แล้ว push ไปที่ `main` จากนั้น GitHub Pages จะ deploy เอง
3. บน iPhone: ปิด app แล้วเปิดใหม่ 2 ครั้ง (ครั้งแรกโหลดของใหม่ ครั้งที่สองจะใช้ของใหม่)

## ไฟล์
- `js/logic.js`: กฎวันที่, สัปดาห์, streak, ใบผ่อนผัน, progression (ไม่มี DOM, ทดสอบด้วย Node ได้)
- `js/store.js`: ค่าเริ่มต้น (อุปกรณ์, คลังท่า, template), การบันทึก, export/import
- `js/anim.js`: ท่าทางของ animation รูปคนแบบเส้น
- `js/app.js`: หน้าจอและ event ทั้งหมด
- `sw.js`: cache สำหรับใช้งาน offline
