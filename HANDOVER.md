# PRIVACY//TERMINAL — Project Handover

> เอกสารฉบับสมบูรณ์สำหรับนำไปพัฒนาต่อ · อัปเดต 2026-10-15 · build ล่าสุด commit `6fddff9`
> **Live:** https://akaradje.github.io/privacy-terminal/ · **Repo:** https://github.com/akaradje/privacy-terminal (public)

---

## 0. TL;DR สำหรับนักพัฒนาใหม่

เว็บ **หน้าเดียว (single-file HTML)** คัดกรองเหรียญคริปโตที่ *privacy เป็นแกนหลักของโปรโตคอล* **51 ตัว** พร้อม "DNA profile" เจาะลึกถึงชั้นคริปโต — ต่างจากเครื่องมือทั่วไปตรงที่ไม่นับ ZK-rollup infra / L1 ทั่วไป ที่แค่ "มี privacy features"

- **ไม่มี framework, ไม่มี build frontend, ไม่มี runtime dependency** — เปิดไฟล์เดียวใช้ได้ (works offline ยกเว้น LIVE refresh)
- **ข้อมูลแยกจากโค้ดชัดเจน**: `template.html` (โครง+CSS) + `app.js` (logic) + `data/*.json` (ข้อมูล) → `build.py` รวมเป็น `privacy-terminal.html` ตัวเดียว
- ** rebuild ข้อมูลได้หมด** จากสคริปต์ 3 ตัว (ดู§5)
- **QA แบบไม่ต้องเปิดเบราว์เซอร์**: `node --check` + DOM-stub harness (ดู§8)
- **Deploy** = git push ไป GitHub Pages (ดู§9)

---

## 1. โปรเจกต์คืออะไร / ทำไมออกแบบแบบนี้

| ประเด็น | คำตอบ |
|---|---|
| จุดเริ่ม | ผู้ใช้ถาม ZEC (mcap $600M→$28B ใน 1 ปี) vs AZTEC (Vitalik ร่วมลงทุน) จากนั้นต้องการเว็บเก็บเหรียญ "แบบเดียวกัน" ให้มากที่สุด |
| ขอบเขตที่เลือก | **Pure privacy only** — ตัด ZK-rollup infra (Starknet/ZKsync/Linea…), L1 ทั่วไป (LTC/NEAR/LINK…), infra สำรอง (KEEP/ARPA/COTI…) ออกทั้งหมด (200 ตัวจาก 251 ที่สำรวจ) เหตุผล: ของเหล่านั้นไม่ใช่ privacy โดยตัวมันเอง ทำให้ข้อมูลในเว็บมีสัญญาณสูง |
| กลุ่มที่เหลือ 51 ตัว | Privacy Coins (สกุลเงิน) · Privacy Protocols (เลเยอร์บนเชนอื่น) · Network Privacy (metadata/IP) · Confidential Compute (FHE·MPC·TEE) |
| ชั้น sauce สำคัญ | **DNA** — ไม่ใช่แค่ price/mcap แต่ "ซ้นอะไรจริง เชื่ออะไร/ใคร" |
| Audience | ผู้ใช้ (ไทย, สไตล์ trading terminal มืออาชีพ, คีย์บอร์ดใช้ได้, โหลดเร็ว) |

---

## 2. สถาปัตยกรรม

```
 CoinGecko API ─┐
 GitHub API ────┼─→  data/*.json ( curated + fetched )
 (docs/research)┘         │
                          ▼
 template.html ─┐    build.py ──→  privacy-terminal.html  ──→  site/index.html ──→ git push ──→ GitHub Pages
 app.js ────────┘    (merge)         (ไฟล์เดียว ~168KB)         (repo source dir)      (akaradje/privacy-terminal)
```

### แผนที่ไฟล์ (ทุกไฟล์ที่เกี่ยวข้อง)

| ไฟล์ | หน้าที่ | แก้แล้วต้องทำอะไร |
|---|---|---|
| `template.html` | โครง HTML + CSS ทั้งหมด + placeholder `__DATA__ __CUR__ __DNA__ __DETAIL__ __STATS__ __APPJS__ __SNAP__` | แก้แล้ว → rebuild |
| `app.js` | ทั้งหมดฝั่ง client: state, render ตาราง/matrix/panel/stats/sparkline, filter, sort, keyboard, LIVE refresh | แก้แล้ว → rebuild |
| `build.py` | อ่าน `data/*` → inline เข้า template → เขียน `privacy-terminal.html` | แก้แล้ว → รัน build |
| `data/tiers.json` | ลิสต์ `t1` = 51 เหรียญ pure privacy (จุดตัดสินตอนนี้มีที่เดียว) | แก้แล้ว → rebuild |
| `data/dna1.json` | DNA prose 20 เหรียญกลุ่มหลัก (prim/hides/trust/anonset/sec/comp/stage) | rebuild |
| `data/dna2.json` | DNA prose 32 เหรียญที่เหลือ | rebuild |
| `data/dna3.json` | **gene flags** (`hs hr ha hst man tl big nst yr g setup audit gov risk hist`) | rebuild |
| `data/curation.json` | `mech/model/access/note` สำหรับ 45 ตัว (ชั้นเดิม ยังใช้ต่อใน spotlight + panel) | rebuild |
| `data/ids.json` | map SYMBOL → CoinGecko id (51) | ใช้กับสคริปต์ refresh |
| `data/cat_*.json` | snapshot CoinGecko `/coins/markets` (7 category + parent) — **แหล่งของ c1y/24h/7d/30d** | rebuild |
| `data/detail/*.json` | dossier 51 โมดูล: desc, links ×9, genesis, algo, cats, GitHub stats, spark | rebuild |
| `data/fetch_detail.py` | สคริปต์ดึง `data/detail/*` (2 pass: dossier → sparkline) | รันสคริปต์ |
| `data/enrich_gh.py` | สคริปต์เติม GitHub dev stats (ผ่าน `gh api`) | รันสคริปต์ |
| `site/` | git repo (remote `akaradje/privacy-terminal`) — `index.html` คือตัว deploy | commit+push |
| `site/README.md` | README สาธารณะ (methodology, sources, limits) | แก้แล้ว push |
| `site/docs/logo.svg`, `favicon.svg`, `og-image.png` | โลโก้/ไอคอน/OG banner (og-image = AI-generated 1200×630) | แก้แล้ว push |
| `privacy-re-rating-zec-aztec-20261015.html` | รายงาน ZEC vs AZTEC เวอร์ชันแรกสุด (ยังมีภาษาจีนใน disclaimer — ต้นแบบ) | archive |
| `.workbuddy-ai/memory/2026-10-15.md` | session log ทุก commit/decision ของวันนี้ | append |

> **กฎเหล็ก:** `privacy-terminal.html` คือ *generated artifact* — ห้ามแก้มือ ถ้าแก้แล้วไม่ได้ตรวจสอบ จะหายตอน build รอบต่อไป (แก้ `template.html`/`app.js`/`data/*` แทน)

---

## 3. Data model (อ้างอิงเต็ม)

### 3.1 `DATA[]` — record 1 ตัวต่อเหรียญ (จาก CoinGecko `/coins/markets`)

| field | type | ความหมาย |
|---|---|---|
| `id` | str | CoinGecko id (เช่น `zcash`) — **ใช้แทน symbol ตอน lookup ทุกที่** |
| `s` | str | symbol ตัวพิมพ์ใหญ่ (แสดง) |
| `n` | str | ชื่อเต็ม |
| `p` | float | ราคา USD |
| `m` | float | market cap |
| `v` | float | volume 24h |
| `c24 / c7 / c30 / c1y` | float\|null | % เปลี่ยนราคา (CoinGecko `price_change_percentage_*`) |
| `cs / ms` | float\|null | circulating / max supply |
| `img` | str | ไอคอน (coin-images.coingecko.com) |
| `tags` | [str] | เก็บจาก category (ตกเก่า ไม่ได้ใช้แล้ว) |
| `priv` | bool | อยู่ใน parent `privacy` category |
| `tier` | str | `t1` = pure (ตอนนี้ทุกตัวเป็น t1 เพราะกรองไว้แล้ว) |
| `dna` | 0\|1 | มี DNA profile |
| `g` | str | กลุ่ม: `coin` / `proto` / `net` / `compute` |

### 3.2 `DNA{sym}` — จาก dna1+dna2+dna3 merge

| field | ชนิด | ความหมาย / ค่าที่ใช้ |
|---|---|---|
| `fam` | str | ตระกูลคริปโต: `ZK` `RingCT` `MW` `FHE` `MPC` `TEE` `Mix` `CT` `CoinJoin` `Selective` |
| `prim` | str | primitive แกนของโปรโตคอล |
| `hides` | str | ซ้นอะไรจริง (prose) |
| `trust` | str | เชื่ออะไร (prose) |
| **genes** | | |
| `hs` | 0/1/2 | ซ้นผู้ส่ง: 0=ไม่ · 1=opt-in · 2=always |
| `hr` | 0/1/2 | ซ้นผู้รับ |
| `ha` | 0/1/2 | ซ้นจำนวน |
| `hst` | 0/1/2 | ซ้น state (สำหรับ hypervisor smart contract) |
| `man` | 0/1 | บังคับใช้ทุกธุรกรรม (mandatory privacy) |
| `tl` | 0/1 | trustless (ไม่มี trusted setup / TEE / committee) |
| `big` | 0/1 | anonymity set = ทั้งเครือข่าย (ไม่ใช่ pool ย่อย) |
| `nst` | 0/1 | ไม่มี gene state (สกุลเงินล้วน) → **ใช้เป็นตัวหารรองในสูตรคะแนน** |
| **ข้อความเสริม** | | |
| `setup` `audit` `gov` `risk` `sec` `comp` `anonset` `stage` `yr` `hist` | str/int | trusted setup · audit · governance · ความเสี่ยงหลัก · ประวัติความปลอดภัย · compliance · stage · ปี mainnet · ไทม์ไลน์เหตุการณ์ |

### 3.3 `DETAIL[id]` — จาก `data/detail/*.json`

`desc` (≤1000 ตัว, html strip) · `home` `wp` `gh` `tw` `tg` `dc` `reddit` `forum` `explorer` (ลิงก์ 9 ช่องทาง) · `genesis` `alg o` `cats` · `stars` `forks` `gh_issues` `gh_lang` `gh_pushed` `gh_lic` `gh_watch` `gh_archived` (GitHub) · `gh_org_repo` / `gh_repo_used` (ระบุว่า repo ไหนถูกใช้วัด — สำคัญ! เพราะ org URL ต้อง resolve เป็น repo ดาวมากสุด) · `spark` ([float] 7 วัน, ~8 คู่) · `reddit_sub` (null = Reddit API บล็อก)

### 3.4 `STATS` — คำนวณตอน build

`n` (51) · `sector_mcap` · `median_1y` · `n_cur` · `n_dna` · `n_cut` (จำนวนที่ตัดออก) · `n_coin/proto/net/compute` · `snap` (UTC timestamp)

---

## 4. DNA framework (หัวใจของโปรเจกต์)

### 4.1 เกณฑ์อยู่ใน pure list (`data/tiers.json`)
privacy เป็นแกนหลักของโปรโตคอล **และ** มีเอกสารเทคนิคยืนยันกลไกได้ — ไม่มี "หวังว่าใกล้มา" เช่น `xVG` (IP-level) ก็ยังอยู่เพราะมีเอกสารชัดเจน แต่ถูก gene flags บอกให้เห็นว่า ha/hr/hs=0

### 4.2 สูตรคะแนน (คำนวณสดฝั่ง client, โปร่งใส)

```js
denom = 8 - (nst ? 2 : 0);                       // สกุลเงินล่วงไม่มี gene state → หารด้วย 6
cov   = (hs + hr + ha + hst) / denom;
score = round(cov*60 + man*15 + tl*15 + big*10); // เต็ม 100
// A+ ≥85 · A ≥70 · B ≥55 · C ≥40 · D <40
```

ผลจริง: XMR/GRIN/EPIC/MWC/XTM = 100 · AZTEC/ALEO/OCT = 90 · ZEC = 75 · DASH/TORN = 45 · MYST = 15
**หมายเหตุที่ฝังในหน้าเว็บ:** คะแนนวัด "ความแข็งของกลไก" ไม่ได้วัดมูลค่า/การลงทุน/ทีม

### 4.3 ข้อตกลงความซื่อตรงในการ curated (ทำตามสัญญาตลอดมา)
1. **ไม่เดา** — ไม่มีหลักฐาน → ทิ้งว่าง `—` หรือไม่ใส่ (ตัวอย่าง: 3 เหรียญไม่มี GitHub repo ที่มั่นใจ → ไม่มี dev stats)
2. **แสดงที่มาของ repo** — ถ้าดึงจากระดับ org การ์ดบอก "repo ดาวมากสุดใน org"
3. **ระบุถึงกรณีพิเศษ** — XVG (IP-level), TORN (sanctioned), AZTEC (alpha + vuln) ถูกทำเครื่องหมายชัดเจนในหน้าที่มี
4. **numeric เกี่ยวกับตลาดทุกตัวมี timestamp + แหลมา** (CoinGecko snapshot ใน stats bar)

---

## 5. Pipeline — refresh ข้อมูล (runbook)

```bash
cd "C:/Users/akara/WorkBuddy AI/privacy"

# A) snapshot ราคา/สกุลเงิน (7 category, โปรเจกต์ list ใน data/fetch_detail.py/ids.json)
for cat in privacy privacy-coins zero-knowledge-zk \
           privacy-infrastructure privacy-blockchain \
           privacy-focused-browser zero-network-ecosystem beamprivacy-ecosystem; do
  curl -s -m 30 "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=${cat}\
&order=market_cap_desc&per_page=250&page=1&price_change_percentage=24h,7d,30d,1y" \
       -o "data/cat_${cat}_p1.json"
  sleep 4
done

# B) dossier + sparkline (ใช้เวลา ~35-40 นาที เพราะโดน 429 ค่อนข้างบ่อย; script retry ให้)
python data/fetch_detail.py          # 51 dossiers + 50/51 sparkline (DERO มักพลาด)

# C) GitHub dev stats
python data/enrich_gh.py             # stars/forks/issues/lang/pushed/licence

# D) build single file
python build.py                      # → privacy-terminal.html

# E) QA (ดู§8) แล้ว deploy (ดู§9)
```

**หมายเหตุอัตรา CoinGecko (free tier):** `/coins/{id}` และ `/market_chart` โดน 429 บ่อย — สคริปต์ sleep 8s + backoff 75s แล้ว retry; `/coins/markets` ยังใช้ได้ ~4s/req; **community_data/developer_data ตัดศักย์ (คืน null)** — นั่นคือเหตุผลที่ dev stats มาจาก GitHub แทน

---

## 6. Frontend architecture (`app.js`)

```js
state = { view:'table'|'matrix', q, sortKey, dir, minMcap, minGrade, sel, expanded }
DATA / CUR / DNA / DETAIL / STATS / IDMAP / TIERMAP
```

**ลำดับ render ตอนโหลด:** `augment()` → `renderStats()` → `renderSpot()` (watchlist 11 ตัว) → `renderViewSwitch()` (ปุ่ม ตาราง/DNA Matrix) → `renderTable()` → `markSort()`

**ฟังก์ชันหลัก:**

| ฟังก์ชัน | หน้าที่ |
|---|---|
| `renderTable()` | ถ้า `state.view==='matrix'` → ซ่อนตาราง + `renderMatrix()`; ไม่งั้น render แถว 51 + แถว DNA panel ใต้แถวที่ expand + sparkline ในช่องชื่อ |
| `renderMatrix()` | ตาราง gene × 51 + rubric + เกรด (เรียงตามคะแนน) |
| `dnaPanel(c)` | head (กลุ่ม/family/badge/grade) + gene strip + grid: prim/hides/trust/setup/anonset/audit/gov/sec/comp/stage/ปี/ไทม์ไลน์/notes + `dossierHtml` |
| `dossierHtml(c)` | links ×9, desc, sparkline 7d, stats (genesis, algorithm, กระดานเทรด, GitHub repo/stars/last commit/license, หมวดหมู่) |
| `matchesQuery(c)` | mcap filter + grade filter + search ผ่าน `hayOf()` = symbol+name+กลุ่ม+CUR+**ทั้ง DNA text** (ค้น `sgx` `mimblewimble` `ringct` `ofac` จึงเจอ) |
| `gradeOf(d)` / `gradeLetter(s)` / `gradeCls(s)` | สูตรคะแนน§4.2 + ตัวอักษร + คลาสสี |
| `liveRefresh()` | ดึง 5 category จากเบราว์เซอร์ → merge by id → **filter กลับเหลือ pure id set (IDMAP)** → re-render ทั้งหมด (fail → คง snapshot) |
| `sparkSvg(arr,w,h,col)` / `sparkColor(arr)` | inline SVG polyline (ไม่มี chart lib) |

**Event/keys:** คลิก header th = sort (คลิกซ้ำ = reverse) · คลิกแถว = toggle DNA panel · `/` = โฟกัส search · `Esc` = ล้าง · `j/k`/`↑↓` = เลื่อนแถว · `Enter` = เปิดหน้า CoinGecko · เปลี่ยน mcap/grade select = กรองใหม่ · ปุ่ม LIVE = refresh

---

## 7. Design system

| ตัวแปร | ค่า | หมายเหตุ |
|---|---|---|
| `--bg/--panel/--line/--tx/--dim` | `#0b0f14` `#10161f` `#1e2936` `#c9d4e0` `#6b7a8d` | dark terminal |
| **`--up`** | **`#2ecc71` เขียว** | **ราคาขึ้น/ผลบวก** — international crypto convention (ผู้ใช้ขอสลับจากธรรมเนียมจีนในวันที่ 2026-10-15) |
| **`--down`** | **`#ff4d4f` แดง** | **ราคาลง/ผลลบ** |
| `--accent` | `#4cc2ff` ฟ้าจาง | โฮวเวอร์/โลโก้/family chip |
| gene chips | `g2` เขียว FULL · `g1` เหือง OPT · `g0` เทา — | ค่าของดีเอ็นเอ |
| grade colors | `gA` เขียวมแวดล้อม · `gC` เหือง | **ไม่ผูกกับราคา** (budget เอง) |
| font | monospace, `font-variant-numeric: tabular-nums` | ตัวเลขตรงคอลัมน์ |

**สัญญาสัญกรณ์อื่นๆ (ที่ไม่ใช่ราคา)** ใช้สีแดงกะทัดฝั้น (`#ff4d4f`) แยกจาก `--up/--down` — จริงทำให้ขั้นตอน swap สีครั้งแล้วกร`SANCTIONED` / ป้าย Mandatory ไม่กลายเป็นเขียว

---

## 8. QA & test harness (ต้องทำก่อนทุกครั้งที่ push)

```bash
# 1) JS syntax — ดึง inline script ออกมาก่อน แล้ว check
python -c "import re,io; h=io.open('privacy-terminal.html',encoding='utf-8').read(); \
  io.open('data/_check.js','w',encoding='utf-8').write(re.search(r'<script>(.*)</script>',h,re.S).group(1))"
node --check data/_check.js

# 2) DOM-stub smoke test (จับ runtime error โดยไม่ต้องเปิดเบราว์เซอร์)
node -e "
const fs=require('fs');const E={};
function el(id){ if(!E[id]) E[id]={id,innerHTML:'',textContent:'',value:'',checked:false,style:{},classList:{add(){},remove(){}},addEventListener(){},setAttribute(){},getAttribute(){return null;},querySelectorAll(){return[];},querySelector(){return null;},focus(){},blur(){},scrollInto(){},onclick:null}; return E[id]; }
global.document={getElementById:el,querySelectorAll(){return[];},addEventListener(){}};global.window={open(){}};
eval(fs.readFileSync('data/_check.js','utf8'));
// ทดสอบ: state.view, view.length, state.tab/st.expanded, แล้วตรวจ innerHTML ต้องมี marker
"
```

**ที่เจอบั๊กจริงจาก harness นี้ (และวิธีแก้):**
1. tab `all` ว่างทั้งตาราง → `hasTab` ไม่มี case `'all'`
2. symbol `ZKP` ชนกัน 2 เหรียญ (zkPass / Panther) → Panther ได้ DNA/tier ผิด → แก้ด้วย `ID_LOCK` (build.py) + lookup แบบ id-aware (`IDMAP`)
3. `DETAIL` key ด้วย symbol แต่โค้ด lookup ด้วย id → panel ทั้งหมดไม่โชว์ → แก้ key ด้วย id เท่านั้น (เคยลอง key ซ้ำสองแบบ = payload 2 เท่า)
4. สูตรคะแนนให้ XMR แค่ 85 (gene state ไม่ควรนับสกุลเงิน) → เพิ่ม flag `nst` = หารด้วย 6
5. repo ของ Dash จาก CoinGecko ชี้ไป `tenderdash` (31★) ไม่ใช่ repo หลัก → 오버라이ดเป็น `dashpay/dash`

**ตรวจก่อน push ทุกครั้ง:** grep marker บน live page (เช่น `og:image`, `PURE PRIVACY (T1)`, `โครงการ` ไม่ควรมี) + `curl -o /dev/null -w "%{http_code} %{size_download}B"` + ตรวจว่าไฟล์ static ใหม่ 200

---

## 9. Deploy (GitHub Pages)

```bash
cd "C:/Users/akara/WorkBuddy AI/privacy"
python build.py && cp privacy-terminal.html site/index.html
cd site && git add -A && git -c user.name="akaradje" \
    -c user.email="35655438+akaradje@users.noreply.github.com" \
    commit -m "<what changed>" && git push origin main
# Pages rebuild ~45-90s → เช็ค marker บน https://akaradje.github.io/privacy-terminal/
```

- **ที่มา:** `gh` CLI บนเครื่องล็อกอินบัญชี `akaradje` อยู่แล้ว (scopes `repo,workflow,gist,read:org`) → สร้าง repo + เปิด Pages ผ่าน `gh api -X POST repos/akaradje/privacy-terminal/pages -f "source[branch]=main" -f "source[path]=/"`
- **ข้อควรระวัง:** เครื่อง **ไม่มี git user.name/email** → ต้องส่ง `-c` ทุกคอมมิต (ไม่งั้นล้ม)
- เครื่อง **ไม่มี Vercel token/CLI** — ถ้าจะลง Vercel ต้องขอ token จากผู้ใช้ หรือ drag-drop ที่ vercel.com/new
- ระบบ publish ในตัวของ WorkBuddy (`workbuddy_sites_deploy`) **เสียอยู่** (2026-10-15 — deploy success แต่ลิงก์ `sg2.agentos-app.run` = ERR_CONNECTION_TIMED_OUT ทั้ง 2 ครั้ง) — ไม่ต้องลองซ้ำถ้าไม่ fix

---

## 10. Known gaps / หนี้ที่มีทั้ง aware (ไม่ใช่บั๊ก)

| ประเด็น | สถานะ | แนวทาง |
|---|---|---|
| DERO ไม่มี sparkline | แบ่ง 429 ตอนดึง | `python data/fetch_detail.py` รอบใหม่ หรือปล่อยว่าง |
| ABEL / CC / DARK ไม่มี GitHub stats | ไม่มั่นใจว่า repo ไหน | ไปดู whitepaper/official site แล้วเติม gh link ใน `data/detail/*.json` |
| community metrics (X followers, TG users, Reddit subs) | CoinGecko ตัด, Reddit API บล็อก | ดึงผ่านทางอื่นถ้าจำเป็น หรือตัดออกไปก่อน |
| OG banner ตัวเลขเป็น illustrative (ZEC 42.17) | AI-generated | ถ้าอยากให้ตรงของจริง → สร้าง SVG logo จากข้อมูล live แล้ว render |
| c1y บางตัว null (เหรียญTGE น้อยกว่า 1 ปี เช่น AZTEC) | ถูกต้องตามจริง | คอลัมน์โชว์ `n/a` |
| 251 coin ต้นทางถูกตัดเหลือ 51 | ตัดใจ | `data/tiers.json` เพิ่มกลับได้ (ต้องระวังว่ามี DNA ไหม) |
| README/HANDOVER เป็น Thai+English | ผู้ใช้ตัดภาษาจีนออก | คงไว้ |

---

## 11. Roadmap เสริม (เรียงตาม impact/effort)

> **อัปเดต 2026-10-15 (พัฒนาแล้วรอบนี้):** ข้อ 1 `validate.py` + clamp คะแนน · ข้อ 11 GitHub Actions refresh · ข้อ 12 LICENSE — **เสร็จแล้ว** และ repo ถูกปรับเป็น full project (มี pipeline + data อยู่ในตัว clone แล้ว build ได้เลย)
> สถานะ validate ล่าสุด: 51 assets · **0 error · 0 warning** · score band 15–100 · median 60 · A+ 15 ตัว

**ข้อมูล/ความลึก**
1. เพิ่ม gene: quantum-resistance, MEV exposure, anonymous-set size เป็นตัวเลข, supply/unlock schedule, TVL/ผู้้Сред
2. On-chain metrics: shielded % (ZEC มี ~29% ของ supply ใน pool), tx count, fee trajectory
3. ขอ API key CoinGecko (Pro) → ปลดล็้อก community/developer data + sparkline ย้อนหลังไกลขึ้น + ไม่โดน 429

**Product**
4. URL state (deep link ไป #coin=ZEC) + filter ตอนแชร์ลิงก์
5. Export CSV/JSON ของตาราง/matrix
6. Watchlist เก็บใน localStorage + การแจ้งเตือน (threshold ราคา / grade)
7. Time-travel: เก็บ snapshot ประวัติ → ดูประวัติคะแนน/ราคาย้อนหลัง
8. i18n (th/en) — ตอนนี้ UI th + README en

**วิศวกรรม**
9. ย้าย build.py → TypeScript/Node (เฉพาะ json stuffing) หรือ python เก็บไว้ก็ได้ (มีอยู่แล้ว แค่ 1 ไฟล์ 120 บรรทัด)
10. Playwright snapshot test (screenshot ตรวจ visual regression) เลี่ยง DOM-stub เมื่อซับซ้อนขึ้น
11. GitHub Action: refresh ราคาอัตโนมัcfgทุกวัน → commit ใหม่ (data บนเว็บจึง fresh)

**ฝากประชาชนขีป**
12. License file (repo public ไม่มี LICENSE — ถ้าอยากให้คนเอาไปใช้ต่อ ควรใส่ MIT)
13. ถอด GitHub Pages → Vercel/Netlify ถ้าอยากได้ custom domain / analytics

---

## 12. Cheat sheet

| อยากทำอะไร | คำสั่ง/ที่แก้ |
|---|---|
| แก้ข้อความ/UI | `template.html` → `python build.py` → test → push |
| แก้ logic/filter | `app.js` → rebuild → test → push |
| เพิ่ม/แก้ DNA ของเหรียญ | `data/dna3.json` (gene) หรือ `dna1/2.json` (prose) → rebuild |
| เพิ่มเหรียญเข้า pure list | `data/tiers.json` + DNA + (CoinGecko id ใน `data/ids.json`) → rebuild |
| อัปเดตราคา snapshot | curl `/coins/markets` (ดู§5A) + `ids.json` ไม่ต้องแก้ถ้า lิสต์เดิม |
| ดูเวอร์ชันปัจจุบัน | `git -C site log --oneline -5` |
| ย้อนเวอร์ชันก่อน | `git -C site revert <sha> && git push` |
| เอาออก/กลับเข้า repo | `gh repo edit akaradje/privacy-terminal --visibility private` |

---

## 13. Environment gotchas (เจอแล้วแก้ไปแล้ว)

1. **Git Bash `/tmp` มองไม่เห็นสำหรับ Windows python** — เขียนไฟล์ temp ใน workspace เสมอ (ใช้ `data/_check.js` แทน `/tmp/x.js`)
2. **WebFetch คืนempty สำหรับ JSON API** — ใช้ `curl` ทาง Bash แทน
3. **heredoc โยงเข้า `python.exe` ตรงๆ อาจโดนบล็อก** — เขียน `.py` ด้วย Write tool แล้วรัน
4. **CoinGecko 429** — retry + backoff; ปล่อยว่างดีกว่าปลอมตัวเลข
5. **`.gitattributes` CRLF** — git เตือน LF→CRLF บนไฟล์ text ใหม่ (harmless)
6. **git identity ไม่ตั้ง** — ส่ง `-c user.name/user.email` ต่อคอมมิต
7. **ภาษาเกณฑ์/ตัวเลขเพี้ยน** — build/verify ผ่าน grep (เช่น CJK scan ก่อน commit)

> **Disclaimer** — All data is compiled from public sources (CoinGecko, GitHub) for research and screening only. Nothing here is financial advice or a recommendation to buy or sell. Digital-asset markets are highly volatile; do your own research and verify each project's own documentation before acting.
