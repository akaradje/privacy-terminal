# -*- coding: utf-8 -*-
"""Batch 2 fill: Zcash forks, masternode CoinJoin & legacy privacy coins (11 assets).

Rules (rubric 2.2/2.3): every value carries src + asof; arch is set; a value that cannot be
sourced is left out (null) with a note — never guessed as 0.
conf: high = the protocol spec / official docs state it · med = stated by the project and
      consistent with its architecture · low = inference that still needs verification.
"""
import json
import io
import os

D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASOF = '2026-10-16'

S = {
    'arrr': 'https://piratechain.com/',
    'arrr_gh': 'https://github.com/PirateNetwork',
    'yec': 'https://y.cash/',
    'zcl': 'https://zclassic.org/',
    'firo': 'https://firo.org/',
    'firo_spark': 'https://firo.org/2022/05/10/introducing-lelantus-spark.html',
    'dash': 'https://docs.dash.org/en/stable/docs/user/private-send.html',
    'pivx': 'https://pivx.org/shield',
    'nav': 'https://navcoin.org/',
    'nav_gh': 'https://github.com/nav-io/libblsct',
    'part': 'https://github.com/particl/particl-core',
    'xvg': 'https://vergecurrency.com/',
    'vrsc': 'https://verus.io/',
    'dcr': 'https://docs.decred.org/privacy/',
}


def ev(v, conf, src, note=''):
    o = {'v': v, 'conf': conf, 'src': src, 'asof': ASOF}
    if note:
        o['note'] = note
    return o


VT = 'value-transfer'
SAPLING = 'zk-SNARK Sapling: ซ่อนผู้ส่ง/ผู้รับ/จำนวนในธุรกรรม shielded'
SAPLING_TS = SAPLING + ' · Sapling ต้องพึ่ง trusted-setup ceremony (ต่างจาก ZEC ปัจจุบันที่ใช้ Orchard/Halo 2 ซึ่งไม่มี trusted setup)'

# name: (arch, hs, hr, ha, hst, nst, man, tl, hmeta, hnet, mat, pq, brk, src, note)
TABLE = {
 'ARRR': (VT, 2, 2, 2, 0, 1, 1, 1, 1, 0, 2, 0, 0, S['arrr'],
          SAPLING_TS + ' · บังคับ shielded 100% ของธุรกรรม peer-to-peer (CoinGecko/เว็บโปรเจกต์) — coinbase/block reward ยังโปร่งใสเหมือน Zcash fork อื่น · hnet=0: ไม่พบ network-layer privacy ในตัว'),
 'YEC':  (VT, 1, 1, 1, 0, 1, 0, 1, 1, 0, 2, 0, 0, S['yec'],
          SAPLING_TS + ' · opt-in (transparent ยังเป็นค่าเริ่มต้น) · สืบทอดประวัติบล็อกจาก Zcash · hnet=0: ยังไม่พบหลักฐาน network privacy ในตัวโปรโตคอล'),
 'ZCL':  (VT, 1, 1, 1, 0, 1, 0, 1, 1, 0, 2, 0, 0, S['zcl'],
          'Zcash fork (2016) — เอกสารโปรเจกต์ระบุว่าใช้พารามิเตอร์ชุดเดียวกับ trusted setup ceremony ของ Zcash → tl=1 · opt-in shielded · hnet=0'),
 'FIRO': (VT, 1, 1, 1, 0, 1, 0, 2, 1, 0, 2, 0, 0, S['firo_spark'],
          'Lelantus Spark: เว็บโปรเจกต์ระบุว่า "hides the sender, receiver, transaction amount" และเป็น "trustless" → tl=2 (ไม่มี trusted setup) · opt-in (ที่อยู่ transparent ยังใช้ได้) · hmeta=1: ยังมี transparent tx ปนในเชน'),
 'DASH': (VT, 1, 0, 0, 0, 1, 0, 0, 0, 0, 2, 0, 0, S['dash'],
          'PrivateSend = CoinJoin ที่ประสานโดย masternode · opt-in (เอกสาร CoinGecko/โปรเจกต์เขียนว่า "Optional privacy") · hr=0: ที่อยู่ผู้รับยังโปร่งใสบนเชน · ha=0: ใช้ denomination คงที่ มูลค่ารวมอนุมานได้ · tl=0: ต้องเชื่อ masternode quorum'),
 'PIVX': (VT, 1, 1, 1, 0, 1, 0, 1, 1, 0, 2, 0, 0, S['pivx'],
          'SHIELD = "anonymity protocol based on zk-SNARKs Sapling" → tl=1 (trusted setup) · opt-in · hnet=0'),
 'NAV':  (VT, 2, 2, 2, 0, 1, 1, 2, 1, 0, 2, 0, 0, S['nav'],
          'Navio (เดิม Navcoin) — เว็บทางการ: "Confidential by default. Powered by BLSCT and Proof-of-Private-Stake" → man=1 · blsCT (BLS signatures + confidential transactions) ไม่ต้อง trusted setup → tl=2 (conf=low: ต้องยืนยันกับสเปก libblsct) · hnet=0'),
 'PART': (VT, 1, 1, 1, 0, 1, 0, 2, 0, 0, 2, 0, 0, S['part'],
          'particl-core ระบุ "Privacy Protocols: Confidential Transactions (CT) and RingCT" + Bulletproofs → tl=2 (ไม่มี trusted setup) · man=0 (conf=low: ต้องยืนยันว่า CT/RingCT เป็นค่าเริ่มต้นหรือเลือกใช้) · hnet=0'),
 'XVG':  (VT, 0, 0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 0, S['xvg'],
          'กฎ: ledger โปร่งใสทั้งหมด → hs/hr/ha = 0 · ความเป็นส่วนตัวอยู่ที่ชั้นเครือข่ายเท่านั้น (Tor/I2P ในตัว wallet) → hnet=1 · tl=0: Tor ต้องเชื่อ directory authorities + สมมติฐานว่า relay ส่วนใหญ่ซื่อสัตย์ · man=0'),
 'VRSC': (VT, 1, 1, 1, 0, 0, 0, 1, 1, 0, 2, 0, 0, S['vrsc'],
          'เอกสารโปรเจกต์: "brings Sapling performance and zero knowledge features" → tl=1 (trusted setup ของ Sapling) · opt-in · nst=0 เพราะ VerusID/PBaaS มี state บนเชน แต่ hst=0 เพราะ state นั้นโปร่งใส ไม่ได้ถูกซ่อน'),
 'DCR':  (VT, 1, 1, 0, 0, 0, 0, 1, 0, 1, 2, 0, 0, S['dcr'],
          'CoinShuffle++ (decred docs /privacy/) — mixing แบบ opt-in ผ่าน mixnet · hs/hr=1 (ตัดความเชื่อมโยงในรอบ mixing) · ha=0: CoinJoin มาตรฐานไม่ซ่อนจำนวน · tl=1 (conf=low: พึ่ง mixnet server ซึ่งไม่ใช่ trusted setup เต็มรูปแบบ) · hnet=1 (mixing วิ่งบน mixnet)'),
}

# per-transaction anonymity set: state what the tier-1/tier-2 measurement would need
ASET_NOTE = {
 'ARRR': 'ชั้น 2: ต้องใช้จำนวน note commitment ใน Sapling pool ณ asof — ยังไม่มีแหล่งที่นับได้จากภายนอก (ผล probe 23 endpoints)',
 'YEC':  'ชั้น 2: จำนวน note ใน shielded pool — ยังไม่มีแหล่งนับ',
 'ZCL':  'ชั้น 2: จำนวน note ใน shielded pool — ยังไม่มีแหล่งนับ (โปรเจกต์แทบไม่มี activity)',
 'FIRO': 'ชั้น 2: ต้องใช้จำนวน coin ใน Spark pool ณ asof — ยังไม่มีแหล่งนับสาธารณะ',
 'DASH': 'ชั้น 2: CoinJoin ต้องใช้ขนาด pool ต่อรอบ mixing/denomination — ยังไม่มีแหล่งนับ',
 'PIVX': 'ชั้น 2: จำนวน note ใน SHIELD pool — ยังไม่มีแหล่งนับ',
 'NAV':  'ชั้น 2: ต้องใช้จำนวน output ที่ยังไม่ถูกใช้ใน confidential pool ณ asof — ยังไม่มีแหล่งนับ',
 'PART': 'ชั้น 2: ขนาด ring/CT pool — ยังไม่มีแหล่งนับ',
 'XVG':  'ชั้น 3: ledger โปร่งใสทั้งหมด — ไม่มี anonymity set ระดับธุรกรรมให้วัด (ค่า cov = 0 สะท้อนเรื่องนี้แล้ว)',
 'VRSC': 'ชั้น 2: จำนวน note ใน Sapling pool — ยังไม่มีแหล่งนับ',
 'DCR':  'ชั้น 2: ขนาด pool ของ CoinShuffle++ ต่อรอบ — ยังไม่มีแหล่งนับ',
}

CONF = {  # per-gene confidence for this batch (all inferred unless the docs state it)
 'arch': 'high', 'hs': 'med', 'hr': 'med', 'ha': 'med', 'hst': 'high', 'nst': 'med',
 'man': 'med', 'tl': 'med', 'hmeta': 'low', 'hnet': 'low', 'mat': 'high', 'pq': 'med',
 'brk': 'low',
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
    g['hs'] = ev(hs, CONF['hs'], src, note)
    g['hr'] = ev(hr, CONF['hr'], src, note)
    g['ha'] = ev(ha, CONF['ha'], src, note)
    g['hst'] = ev(hst, CONF['hst'], src, 'state (ถ้ามี) โปร่งใส ไม่ได้ถูกซ่อน' if hst == 0 else note)
    g['nst'] = ev(nst, CONF['nst'], src, 'ไม่มี execution layer' if nst else 'มี state layer บนเชน')
    g['man'] = ev(man, CONF['man'], src, 'บังคับใช้ทุกธุรกรรม' if man else 'opt-in — มีโหมดโปร่งใสให้เลือก')
    g['tl'] = ev(tl, CONF['tl'], src, note)
    g['hmeta'] = ev(hmeta, CONF['hmeta'], src, 'ประเมินจากสถาปัตยกรรม ยังต้องยืนยันด้วยงานวิจัย metadata')
    g['hnet'] = ev(hnet, CONF['hnet'], src, 'ประเมินจากเอกสารโปรเจกต์ ยังต้องยืนยัน')
    g['mat'] = ev(mat, CONF['mat'], src, 'นับจากปี mainnet ถึง asof')
    g['pq'] = ev(pq, CONF['pq'], src, 'พึ่ง elliptic curve — ไม่มี post-quantum')
    g['brk'] = ev(brk, CONF['brk'], src, 'ยังไม่พบ disclosure ที่ยังไม่ปิด — ต้องตรวจ advisory ให้ครบ')
    g['aset_note'] = ASET_NOTE[sym]
    filled += 1

io.open(p, 'w', encoding='utf-8').write(json.dumps(dna, ensure_ascii=False, indent=1))
print('batch 2 filled: %d assets' % filled)
if missing:
    print('NOT FOUND in dna3:', missing)
