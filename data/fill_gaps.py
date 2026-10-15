# -*- coding: utf-8 -*-
"""Close the validator gaps: event timelines for pure currency coins + curation entries."""
import json, io, os

D = os.path.dirname(os.path.abspath(__file__))

HIST = {
 'DCR': '2016-02 mainnet (Bitcoin fork + PoS ผสม) · 2017 ระบบ governance Politeia · 2019 CoinShuffle++ mixing · พัฒนาต่อเนื่องถึงปัจจุบัน (commit 2026-10)',
 'BDX': '2018 mainnet (CryptoNote fork) · ขยายเป็น ecosystem BChat messenger + Beldex VPN · เน้น privacy ที่ระดับการสื่อสารมากกว่ายอดโอน',
 'ZANO': '2019 mainnet (สาย Boolberry) · เพิ่ม confidential assets · เปลี่ยนเป็น dPoS + ระบบ staking',
 'XVG': '2014 เปิดตัวในชื่อ DogeCoinDark → 2016 เปลี่ยนชื่อเป็น Verge · 2018 Wraith protocol (Tor/I2P) · ถูกวิจารณ์หนักว่าไม่ใช่ on-chain privacy',
 'DERO': '2018 mainnet (DAG + homomorphic encryption) · 2020 เพิ่ม private smart contracts (DERO HE) · commit ล่าสุด 2022-03 → dev ชะลอตัวชัดเจน',
 'ZEPH': '2023 mainnet · โมเดล CryptoNote + ZSD stablecoin แบบ overcollateralized · พยายามแก้โจทย์ privacy stablecoin',
 'ZCL': '2016 hardfork จาก Zcash (ก่อน Sapling) · เป็นต้นสายที่ Horizen (ZEN) แยกออกไป · activity ต่ำ',
 'PIVX': '2016 mainnet (Dash fork) · 2017-2019 เพิ่ม zk-SNARKs ชื่อ SHIELD · masternode governance',
 'IRON': '2023 mainnet · zk-SNARK privacy L1 (Sapling-derived) · ออกแบบให้ compliance-friendly · commit ล่าสุด 2025-08',
 'XTM': 'Tari mainnet 2024 · MimbleWimble สำหรับ digital assets · merge-mined กับ Monero',
 'ABEL': '2023 mainnet · post-quantum privacy chain (lattice-based cryptography) · จุดขายคือทนต่อ quantum computer',
 'EPIC': '2019 mainnet · MimbleWimble private cash · ระบบ Epic Pay',
 'MWC': '2019 mainnet · MimbleWimble + atomic swap กับ Bitcoin',
 'YEC': '2019 hardfork จาก Zcash · เปลี่ยน emission เป็นแบบ linear · shielded pool แบบ Sapling',
 'XEL': '2024 mainnet · privacy L1 (zk confidential transactions) · dev ยัง active (commit 2026-10)',
 'PART': '2017 mainnet (Bitcoin fork) · เพิ่ม confidential transactions + privacy marketplace · activity ลดลง',
 'NAV': '2014 เปิดตัวในชื่อ Navcoin · 2018 เพิ่ม zk-SNARKs (NavTech) · ต่อมาเป็น PoS + privacy layer',
 'ZER': '2016 Bitcoin fork · zk-SNARK shielded (Zero) · activity ต่ำมาก (commit 2026-10 แต่ community เล็ก)',
}

CUR = {
 'PIVX': {'mech': 'zk-SNARKs (SHIELD) + masternodes', 'model': 'Opt-in', 'access': 'CEXs', 'note': 'shielded opt-in ผ่าน SHIELD protocol'},
 'IRON': {'mech': 'zk-SNARK privacy L1 (Sapling-derived)', 'model': 'Mandatory', 'access': 'CEXs', 'note': 'ออกแบบมาให้ compliance-friendly กว่า XMR'},
 'XTM': {'mech': 'MimbleWimble สำหรับ digital assets (Tari)', 'model': 'Mandatory', 'access': 'Niche venues', 'note': 'merge-mined กับ Monero'},
 'ABEL': {'mech': 'post-quantum privacy (lattice-based)', 'model': 'Mandatory', 'access': 'Niche venues', 'note': 'ทนต่อ quantum แต่ assumption ใหม่ ยังไม่ผ่านการทดสอบระยะยาว'},
 'EPIC': {'mech': 'MimbleWimble private cash', 'model': 'Mandatory', 'access': 'Niche venues', 'note': 'เน้น cash-like UX (Epic Pay)'},
 'YEC': {'mech': 'Zcash fork (Sapling shielded)', 'model': 'Opt-in', 'access': 'Niche venues', 'note': 'emission แบบ linear ต่างจาก ZEC'},
 'XEL': {'mech': 'zk confidential transactions L1', 'model': 'Mandatory', 'access': 'Niche venues', 'note': 'dev ยัง active'},
 'PART': {'mech': 'Confidential transactions + privacy marketplace', 'model': 'Opt-in', 'access': 'Niche venues', 'note': 'privacy marketplace (PART swap)'},
 'NAV': {'mech': 'zk-SNARKs (NavTech) + PoS', 'model': 'Opt-in', 'access': 'Niche venues', 'note': 'privacy layer สำหรับการจ่าย'},
 'UMBRA': {'mech': 'Shielded transfers/claims ด้วย zk บน Solana/EVM', 'model': 'Opt-in', 'access': 'DEX', 'note': 'เหมาะกับการจ่าย/เคลมที่ไม่ต้องเปิดยอด'},
 'DARK': {'mech': 'Privacy DEX (ซ่อน order flow)', 'model': 'Opt-in', 'access': 'Early', 'note': 'stage early มาก'},
 'ZKP': {'mech': 'ZK proof ของข้อมูลจากเว็บ (privacy identity)', 'model': 'Opt-in', 'access': 'CEXs', 'note': 'privacy identity ไม่ใช่การโอน'},
 'AZERO': {'mech': 'Privacy L1 (zk-SNARKs + private smart contracts)', 'model': 'Opt-in', 'access': 'CEXs', 'note': 'มี liminal/private contract layer'},
 'NYM': {'mech': 'Mixnet (Sphinx packets) — network/metadata privacy', 'model': 'Mandatory', 'access': 'CEXs', 'note': 'ซ่อน IP/metadata ไม่ใช่ยอดโอน'},
 'HOPR': {'mech': 'Incentivized mixnet (layer-0 metadata privacy)', 'model': 'Mandatory', 'access': 'CEXs', 'note': 'token ใช้จ่ายให้ relay node'},
 'SESH': {'mech': 'Onion-routed messenger (ไม่ต้องใช้เบอร์โทร)', 'model': 'Mandatory', 'access': 'CEXs', 'note': 'privacy ที่ชั้นการสื่อสาร'},
 'MYST': {'mech': 'Mysterium dVPN — ซ่อน IP/traffic', 'model': 'Opt-in', 'access': 'CEXs', 'note': 'ซ่อน IP ไม่ซ่อนยอด'},
 'P2P': {'mech': 'Sentinel dVPN', 'model': 'Opt-in', 'access': 'Niche venues', 'note': 'node network กระจาย; commit ล่าสุด 2021-04'},
 'ANYONE': {'mech': 'Onion routing + relay network (ANyONe)', 'model': 'Opt-in', 'access': 'Niche venues', 'note': 'ชื่อเดิม ATOR protocol'},
 'MPC': {'mech': 'MPC (secret sharing) ประมวลผลข้าม node', 'model': 'Opt-in', 'access': 'CEXs', 'note': 'เชื่อ honest-majority ของคณะ MPC'},
}

dna3 = json.load(io.open(os.path.join(D, 'dna3.json'), encoding='utf-8'))
cur = json.load(io.open(os.path.join(D, 'curation.json'), encoding='utf-8'))
nh = nc = 0
for k, v in HIST.items():
    if k in dna3 and not dna3[k].get('hist'):
        dna3[k]['hist'] = v
        nh += 1
for k, v in CUR.items():
    if k not in cur:
        cur[k] = v
        nc += 1
io.open(os.path.join(D, 'dna3.json'), 'w', encoding='utf-8').write(json.dumps(dna3, ensure_ascii=False, indent=1))
io.open(os.path.join(D, 'curation.json'), 'w', encoding='utf-8').write(json.dumps(cur, ensure_ascii=False, indent=1))
print('timelines added: %d | curation added: %d | curation total: %d' % (nh, nc, len(cur)))
