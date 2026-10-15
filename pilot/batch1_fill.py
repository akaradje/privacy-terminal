# -*- coding: utf-8 -*-
"""Batch 1 fill: MimbleWimble + RingCT/CryptoNote family (11 assets).

Rules (rubric 2.2): every value carries src + asof; arch is set; a value that cannot be
sourced is left out (null) with a note — never guessed as 0.
conf: high = the protocol spec states it · med = derived from the spec/architecture ·
      low = inference that still needs verification.
"""
import json
import io
import os

D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASOF = '2026-10-16'

S = {
 'grin': 'https://docs.grin.mw/',
 'grin_gh': 'https://github.com/mimblewimble/grin',
 'beam': 'https://docs.beam.mw/',
 'mwc': 'https://www.mwc.mw/',
 'epic': 'https://epiccash.com/',
 'tari': 'https://rfc.tari.com/',
 'dero': 'https://dero.io/',
 'zano': 'https://zano.org/',
 'bdx': 'https://beldex.io/',
 'zeph': 'https://www.zephyrprotocol.com/',
 'xelis': 'https://xelis.io/',
 'abel': 'https://www.abelian.info/',
}


def ev(v, conf, src, note=''):
    o = {'v': v, 'conf': conf, 'src': src, 'asof': ASOF}
    if note:
        o['note'] = note
    return o


# name: (arch, hs, hr, ha, hst, nst, man, tl, hmeta, hnet, mat, pq, brk, src, family_note)
MW = 'MimbleWimble: Pedersen commitments + cut-through, ไม่มีที่อยู่บนเชน — ซ่อนผู้ส่ง/ผู้รับ/จำนวนโดยโครงสร้าง'
CN = 'CryptoNote/RingCT: ring signature + stealth address + RingCT — ซ่อนโดยโครงสร้าง'

TABLE = {
 'GRIN': ('value-transfer', 2, 2, 2, 0, 1, 1, 2, 1, 1, 2, 0, 0, S['grin'], MW + ' · Dandelion (stem phase) ให้ hnet=1 · cut-through รวมธุรกรรมก่อนขึ้นบล็อก → hmeta=1'),
 'BEAM': ('value-transfer', 2, 2, 2, 0, 1, 1, 2, 1, 1, 2, 0, 0, S['beam'], MW + ' · มี Dandelion · เพิ่ม confidential assets'),
 'MWC':  ('value-transfer', 2, 2, 2, 0, 1, 1, 2, 1, 0, 2, 0, 0, S['mwc'], MW + ' · ไม่มี network privacy ในตัว → hnet=0 (ยังต้องยืนยัน)'),
 'EPIC': ('value-transfer', 2, 2, 2, 0, 1, 1, 2, 1, 0, 2, 0, 0, S['epic'], MW + ' · Epic Pay เป็น UX ไม่ใช่ network privacy → hnet=0'),
 'XTM':  ('value-transfer', 2, 2, 2, 0, 1, 1, 2, 1, 1, 2, 0, 0, S['tari'], MW + ' | digital assets, merge-mined with Monero'),
 'DERO': ('value-transfer', 2, 2, 2, 2, 0, 1, 2, 1, 1, 2, 0, 0, S['dero'], CN + ' · มี private smart contract (homomorphic) → hst=2 และ nst=0'),
 'ZANO': ('value-transfer', 2, 2, 2, 0, 1, 1, 2, 1, 1, 2, 0, 0, S['zano'], CN + ' · confidential assets · dPoS'),
 'BDX':  ('value-transfer', 2, 2, 2, 0, 1, 1, 2, 1, 1, 2, 0, 0, S['bdx'], CN + ' · เน้น privacy ที่ชั้น messenger ด้วย'),
 'ZEPH': ('value-transfer', 2, 2, 2, 0, 1, 1, 2, 1, 1, 1, 0, 0, S['zeph'], CN + ' · mainnet 2023 → mat=1 (1–3 ปี)'),
 'XEL':  ('value-transfer', 2, 2, 2, 0, 1, 1, 2, 1, 1, 0, 0, 0, S['xelis'], CN + ' · mainnet 2024 → mat=0 (<1 ปี)'),
 'ABEL': ('value-transfer', 2, 2, 2, 0, 1, 1, 2, 1, 1, 1, 2, 0, S['abel'], 'post-quantum (lattice-based) → pq=2 · mainnet 2023 → mat=1'),
}

# per-tx anonymity set: protocol-enforced values are only quoted where the spec states them
ASET_NOTE = {
 'GRIN': 'ชั้น 2: ต้องใช้จำนวน UTXO ที่ยังไม่ถูกใช้ (ทั้งเชน) ณ asof — ยังไม่มีแหล่งที่นับได้จากภายนอก',
 'BEAM': 'ชั้น 2: เช่นเดียวกับ GRIN (UTXO set) — ยังไม่มีแหล่งนับ',
 'MWC':  'ชั้น 2: UTXO set — ยังไม่มีแหล่งนับ',
 'EPIC': 'ชั้น 2: UTXO set — ยังไม่มีแหล่งนับ',
 'XTM':  'ชั้น 2: UTXO set — ยังไม่มีแหล่งนับ',
 'DERO': 'ชั้น 1: ring size ของ CryptoNote กำหนดในโค้ด — ต้องอ้างไฟล์โค้ด/สเปกฉบับระบุเลขก่อนจึงจะใส่ได้',
 'ZANO': 'ชั้น 1: ring size กำหนดในโค้ด — ต้องอ้างสเปกที่ระบุเลขก่อน',
 'BDX':  'ชั้น 1: ring size กำหนดในโค้ด — ต้องอ้างสเปกที่ระบุเลขก่อน',
 'ZEPH': 'ชั้น 1: ring size กำหนดในโค้ด — ต้องอ้างสเปกที่ระบุเลขก่อน',
 'XEL':  'ชั้น 1: ring size กำหนดในโค้ด — ต้องอ้างสเปกที่ระบุเลขก่อน',
 'ABEL': 'ชั้น 1: ring size กำหนดในโค้ด — ต้องอ้างสเปกที่ระบุเลขก่อน',
}

p = os.path.join(D, 'data', 'dna3.json')
dna = json.load(io.open(p, encoding='utf-8'))
filled = 0
missing = []
for sym, row in TABLE.items():
    if sym not in dna:
        missing.append(sym)
        continue
    arch, hs, hr, ha, hst, nst, man, tl, hmeta, hnet, mat, pq, brk, src, note = row
    g = dna[sym]
    g['arch'] = ev(arch, 'high', src, 'โอนมูลค่าบนเชนของตัวเอง')
    g['hs'] = ev(hs, 'med', src, note)
    g['hr'] = ev(hr, 'med', src, note)
    g['ha'] = ev(ha, 'med', src, note)
    g['hst'] = ev(hst, 'high' if hst == 0 else 'med', src, note)
    g['nst'] = ev(nst, 'high', src, 'ไม่มี execution layer' if nst else 'มี state layer')
    g['man'] = ev(man, 'high', src, 'บังคับใช้ privacy ทุกธุรกรรม ไม่มีโหมดโปร่งใส')
    g['tl'] = ev(tl, 'med', src, 'PoW เปิด ไม่มี trusted setup')
    g['hmeta'] = ev(hmeta, 'low', src, 'ประเมินจากสถาปัตยกรรม ยังต้องยืนยันด้วยงานวิจัย metadata')
    g['hnet'] = ev(hnet, 'low', src, 'ประเมินจากเอกสารโปรเจกต์ ยังต้องยืนยัน')
    g['mat'] = ev(mat, 'high', src, 'นับจากปี mainnet ถึง asof')
    g['pq'] = ev(pq, 'med', src, 'post-quantum' if pq else 'พึ่ง elliptic curve')
    g['brk'] = ev(brk, 'low', src, 'ยังไม่พบ disclosure ที่กระทบ privacy — ต้องตรวจ advisory ให้ครบ')
    g['aset_note'] = ASET_NOTE[sym]
    filled += 1

io.open(p, 'w', encoding='utf-8').write(json.dumps(dna, ensure_ascii=False, indent=1))
print('batch 1 filled: %d assets' % filled)
if missing:
    print('NOT FOUND in dna3:', missing)
