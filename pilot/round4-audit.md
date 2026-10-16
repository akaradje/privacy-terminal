# round 4 — comp re-grade · S citations · history 6 pillars

เป้าหมายรอบนี้ (จากคำขอของผู้ใช้): เก็บกวาด `comp` ให้หมดคะแนนฟรี 50%, เติม Citation ของ Pillar S
สำหรับ XMR/FIRO/RAIL/AZTEC, และอัปเกรด `scripts/snapshot_history.py` ให้บันทึกคะแนนทั้ง 6 Pillars ลง History.

ผลลัพธ์: `scoring_version = 2.7.0-preview`, `validate.py` **0 error / 16 warning** (warning ทุกตัวคือช่องว่างที่ตั้งชื่อไว้ ไม่ใช่บั๊ก).

---

## 1. กำจัดคะแนนฟรี 50% ใน `comp`

**ปัญหา (artifact):** รอบก่อน `comp=1` ถูกนิยามเป็น "ไม่มีหลักฐาน" (not evidenced) → ได้ 50 คะแนนใน Pillar R.
ผลคือเหรียญที่ **ไม่มี** หลักฐาน compliance เลย ได้คะแนนเท่ากับเหรียญที่มีเครื่องมือบางส่วน
(เช่น XMR view key) และ **มากกว่า** เหรียญที่พิสูจน์แล้วว่า "ไม่มีเครื่องมือ" (comp=0 → 0 คะแนน) — ผิด monotonicity อย่างชัดเจน.

**นิยามใหม่ (engine 2.7.0):**
`comp ∈ {0, 1, 2, null}`
- `2` = มีการเปิดเผยแบบเลือกได้ / viewing keys / proof-of-innocence ปรากฏในเอกสาร (Zcash, Secret, Railgun, SCRT)
- `1` = บางส่วน / พื้นฐาน (XMR native view key, ตระกูล CryptoNote=1, AZTEC docs ระบุ selective disclosure แต่ยังไม่สมบูรณ์)
- `0` = ไม่มีความเป็นส่วนตัวให้เปิดเผย + ไม่มีเครื่องมือ compliance เลย
- `null` = **ไม่มีหลักฐาน** → engine ปัดเป็น 0 **แต่ยังเก็บน้ำหนัก 0.45 ไว้** (ไม่หายไป)

**พิสูจน์ monotonicity:** `R with comp=0: 55` = `R with comp=null: 55` → ไม่มีหลักฐาน ไม่ควรได้ดีกว่า "พิสูจน์แล้วว่าไม่มี" ✓

---

## 2. เติม Citation ของ Pillar S (XMR / FIRO / RAIL / AZTEC)

ทุกค่าเป็น evidence object `{v, conf, src, asof}` และ `src` ทุกตัวถูก probe HTTP ก่อนรับเข้า
(ตาย = บันทึกใน note, ไม่เข้ารหัสเป็นคะแนน)

| Symbol | brk | audit | comp | แหล่งอ้างอิงที่ใช้จริง (HTTP 200) |
|--------|-----|-------|------|-----------------------------------|
| XMR | `0.5` HIGH | `1` med | `1` med | getmonero.org 2017 disclosure (ยืนยันคีย์เวิร์ด "key image"/"double-spend") · monero-project/research-lab |
| FIRO | `0` med | `1` med | `null` | repo README ยืนยัน tl=2 ("high anonymity sets without trusted setup") |
| RAIL | `0` med | `0` med | `2` med | railgun.org |
| AZTEC | `null` (ช่องว่างตั้งชื่อ) | `1` med | `2` med | docs.aztec.network · SECURITY.md ("under internal and external review" + Cantina bounty → audit=1 ไม่ใช่ 2) |

**ลิงก์ตายที่ผู้ใช้ส่งมา (บันทึกไว้ ไม่นำมาคิดคะแนน):**
- firo.org 2019 post-mortem → 404 (ทั้งชุด)
- Railgun-Community/contract → 404
- railgun.org/audits → SPA shell (ไม่มีเนื้อหา)

ใช้ทางเลือก: XMR disclosure (200), Firo repo README (200), AZTEC SECURITY.md (200) แทน.

**ช่องว่างที่ยังตั้งชื่อไว้ (brk=null):** AZTEC (สถานะแพตช์ V5 ยังไม่ยืนยัน) — ไม่เดา ไม่เข้ารหัส.

---

## 3. อัปเกรด `scripts/snapshot_history.py` → 6 Pillars

รอบก่อนบันทึกแค่ composite + บางคอลัมน์。ตอนนี้เรียก `pillarsOf()` / `compositeOf()` จาก engine
โดยตรงเพื่อบันทึก **P, D, L, T, S, R + composite** ต่อเหรียญ:

```jsonc
"pillars": { "P":49, "D":55, "L":79, "T":87, "S":84, "R":100, "P_v1":45, "composite":68 }
```

- เพิ่ม `_asof()` ให้ค่า D อ่านได้เปรียบเทียบรายวัน (diffable)
- แก้ bug 2 จุด: (1) `_asof()` ถูกเขียนทับจนเรียกตัวเอง → RecursionError (กู้คืนเนื้อหา + ลบ dup ใน main)
  (2) escape sequence ผิด `\.` → `\\d`
- ผลลัพธ์: `history/2026-10-16.json.gz` — 51 เหรียญ, `scoring_version: 2.7.0-preview`

---

## 4. ผล validate + ลีดเดอร์บอร์ด

`validate.py`: **0 error, 16 warning** (warning = ช่องว่างที่ตั้งชื่อ: 12 เหรียญ comp=null + AZTEC brk=null
+ DUSK/P2P repo ถูก archive + MWC market cap=0 ที่ build.py  impute ไว้)

**Composite leaderboard (preset `privacy_investor`, risk-adjusted):**

```
XMR 81 > BDX 78 > GRIN 77 > ZANO 74 > BEAM 73 > EPIC 72 > ARRR 70 >
ZEC 68 > XTM 67 > AZTEC 66 > FIRO 65 > PIVX 64   (TORN #44, ZAMA #22, ZEPH #33, IRON #42)
```

XMR ยังคง rank 1: band ถูก floor ที่ ±2 (ไม่มี "ความไม่แน่นอน = 0" แล้ว), และ brk=0.5 ปรากฏในแผง S ของ XMR ("S 64").
