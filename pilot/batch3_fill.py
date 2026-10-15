# -*- coding: utf-8 -*-
"""Batch 3 fill: ZK L1/L2, mixers & shielded smart contracts (14 assets).

Rules (rubric 2.2/2.3): every value carries src + asof; arch is set; a value that cannot be
sourced is left as a bare legacy number or null with a note — never invented.
conf: high = the project's own spec/docs state it · med = stated by the project and consistent
      with its architecture · low = inference that still needs verification.

This batch has a high proportion of `conf=low` on purpose: most of these projects are young, some
are not clearly on mainnet, and several have thin documentation. `conf=low` widens the band, which
is the honest outcome — it does not hide the uncertainty.
"""
import json
import io
import os

D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASOF = '2026-10-16'

S = {
    'iron': 'https://ironfish.network/',
    'iron_gh': 'https://github.com/iron-fish/ironfish',
    'rail': 'https://railgun.org/',
    'torn': 'https://tornado.cash/',
    'umbra': 'https://www.umbra.cash/',
    'aleo': 'https://aleo.org/',
    'dusk': 'https://dusk.network/',
    'azero': 'https://alephzero.org/',
    'night': 'https://midnight.network/',
    'cc': 'https://www.canton.network/',
    'xan': 'https://anoma.net/',
    'zkp': 'https://zkpass.org/',
    'nock': 'https://nockchain.org/',
    'zer': 'https://zerocurrency.io/',
    'dark': 'https://darkswap.io/',
}

VT, COMPUTE = 'value-transfer', 'compute'


def ev(v, conf, src, note=''):
    o = {'v': v, 'conf': conf, 'src': src, 'asof': ASOF}
    if note:
        o['note'] = note
    return o


# name: (arch, hs, hr, ha, hst, nst, man, tl, hmeta, hnet, mat, pq, brk, src, note)
TABLE = {
 'IRON': (VT, 2, 2, 2, 0, 1, 1, 1, 1, 0, 1, 0, 0, S['iron'],
          'เอกสารโปรเจกต์: "encrypts every transaction, shielding your sensitive asset information" → man=1, hs/hr/ha=2 · UTXO, ไม่มี general smart contract → nst=1 · mainnet 2023-04-20 · zk-SNARK (Sapling lineage): tl=1 (conf=low — ต้องยืนยันรายละเอียด trusted setup ceremony) · มีงานวิจัย 2025 "Trust Without Transparency: An Empirical Analysis of Anonymity and Verifiability in Iron Fish" ควรอ่านก่อนปิดค่า hs/hr/ha เป็น high'),
 'RAIL': (VT, 1, 1, 1, 0, 0, 0, 1, 0, 0, 2, 0, 0, S['rail'],
          'smart contract shielded pool บน EVM: "gives zk-SNARK privacy to any transaction or smart contract interaction" → ซ่อนได้เมื่อเลือกใช้ (opt-in) · hst=0: state ของ contract ยังโปร่งใสบน EVM · tl=1 (Groth16 trusted setup) · mainnet ตั้งแต่ ~2021 → mat=2 (conf=low: ยังไม่ยืนยันจำนวน audit)'),
 'TORN': (VT, 1, 1, 0, 0, 0, 0, 1, 0, 0, 2, 0, 0, S['torn'],
          'mixer zk-SNARK บน Ethereum ตัดความเชื่อมโยงฝาก-ถอน → hs=1 (เลือกใช้), hr=1 (ถอนเข้าที่อยู่ใหม่) · ha=0: ใช้ denomination คงที่ จำนวนจึงเปิดเผย (เหมือน DASH) · hst=0: EVM state โปร่งใส · tl=1 (Groth16 trusted setup) · ถูก OFAC sanction 2022-08 (ศาลอุทธรณ์สหรัฐ 2024 ตัดสินว่าเกินอำนาจ) → ดู red flag/compliance'),
 'UMBRA': (VT, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, S['umbra'],
          'stealth address protocol บน Solana/EVM: ซ่อนความเชื่อมโยงของผู้รับ (hr=1) แต่ผู้ส่งและจำนวนยังเห็นบนเชน → hs=0, ha=0 (ยกเว้นเส้นทางผ่าน relayer/hook) · mat=0: ยังไม่ยืนยันระยะเวลา mainnet/audit · conf=low ทุกค่า privacy — ต้องตรวจว่าโหมด shielded เปิดใช้จริงแล้วหรือยัง'),
 'ALEO': (VT, 2, 2, 2, 2, 0, 1, 1, 1, 0, 1, 0, 0, S['aleo'],
          'เอกสารโปรเจกต์: "architecting Aleo as a blockchain that is private-by-default" → man=1, hs/hr/ha=2 · record model ซ่อน state ของ application → hst=2, nst=0 · zk-SNARK (Varuna/Marlin lineage): tl=1 (conf=low — ต้องยืนยันสถานะ trusted setup) · mainnet 2024-09 → mat=1'),
 'DUSK': (VT, 1, 1, 1, 2, 0, 0, 1, 1, 0, 1, 0, 0, S['dusk'],
          'L1 สำหรับตลาดการเงินที่มีการกำกับ + "privacy-preserving smart contracts, zero-knowledge compliance infrastructure" → private contract state → hst=2, nst=0 · โอนแบบ private (Phoenix lineage) เป็น opt-in → hs/hr/ha=1, man=0 · tl=1 (conf=low: universal setup ของ PLONK lineage) · mat=1 (conf=low: mainnet/audit ต้องยืนยัน)'),
 'AZERO': (VT, 1, 1, 1, 1, 0, 0, 1.5, 0, 0, 2, 0, 0, S['azero'],
          'L1 (Substrate) พื้นฐานโปร่งใส — ชั้น privacy (Liminal/zkOS) เป็นการเลือกใช้ → man=0, hs/hr/ha=1 (conf=low) · hst=1 (conf=low: private state ยังต้องยืนยันว่าเปิดบน mainnet) · tl=1.5: ชั้น privacy ใช้ secure multiparty computation (conf=low) · mainnet 2021-11 → mat=2 (conf=low)'),
 'NIGHT': (VT, 1, 1, 1, 2, 0, 0, 2, 1, 0, 0, 0, 0, S['night'],
          'Midnight: "privacy-first blockchain... selective disclosure and ZK proofs" · dual ledger (public + private) → โอน private เป็น opt-in → hs/hr/ha=1, man=0 · private contract state → hst=2, nst=0 · tl=2 (conf=low: ZK proof ไม่ต้อง trusted setup — ต้องยืนยัน) · mat=0: สถานะ mainnet ยังไม่ชัด (การเปิดตัว mainnet ยังอยู่ระหว่างการหารือ) → conf=low ทั้งแถว'),
 'CC': (VT, 1, 1, 1, 2, 0, 0, 0, 1, 0, 0, 0, 0, S['cc'],
          'Canton Network (Daml ledger สำหรับสถาบัน): sub-transaction privacy — คู่สัญญาเห็นเฉพาะสัญญาของตัวเอง → hs/hr/ha=1 (conf=low) · private contract state เป็นแกน → hst=2, nst=0 · tl=0: โมเดลความเชื่อใจพึ่ง notary/validator domain ที่ต้องเชื่อ (ไม่ใช่ public trustless) · mat=0 (conf=low)'),
 'XAN': (VT, 1, 1, 1, 2, 0, 0, 2, 1, 0, 0, 0, 0, S['xan'],
          'Anoma — intent-centric architecture; การชำระ intent แบบ shielded → hs/hr/ha=1 (conf=low) · private state → hst=2, nst=0 · tl=2 (conf=low) · mat=0: ยังไม่ยืนยันสถานะ mainnet/audit · conf=low ทั้งแถว'),
 'ZKP': (COMPUTE, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, S['zkp'],
          'zkPass = zkTLS oracle: พิสูจน์ข้อเท็จจริงจากเว็บ HTTPS โดยไม่เปิดข้อมูลดิบ — ไม่ใช่เชนโอนมูลค่า → arch=compute, กฎ non-value-transfer: hs/hr/ha=0 · ไม่มี execution layer ให้ซ่อน state → nst=1, hst=0 · tl=1 (conf=low: 3P-TLS ต้องมี proxy ที่เชื่อถือในรอบ session) · mat=0 (conf=low) · หมายเหตุ: คะแนน P ต่ำเพราะ rubric วัด privacy ของ "การโอน/state" ไม่ได้วัด "การไม่เปิดเผยข้อมูลต้นทาง"'),
 'NOCK': (VT, 0, 0, 0, 0, 1, 0, None, 0, 0, 0, 0, 0, S['nock'],
          'ZKPoW เป็นกลไก consensus ไม่ใช่ privacy ของธุรกรรม · ไม่พบเอกสารที่ยืนยันกลไก privacy ระดับธุรกรรม → hs/hr/ha=0 (conf=low) · tl=null เพราะไม่มีกลไก privacy ให้ประเมิน trust (ไม่ใช่ 0 ซึ่งแปลว่า "ต้องเชื่อคนกลาง") · mat=0 (fair launch 2025-05) · ต้องอ่าน whitepaper ก่อนปิดค่า'),
 'ZER': (VT, 1, 1, 1, 0, 1, 0, 1, 1, 0, 2, 0, 0, S['zer'],
          'Zcash fork ("ZERO is born from Zcash") → shielded แบบ opt-in → hs/hr/ha=1, man=0 · Sapling trusted setup → tl=1 · UTXO ไม่มี smart contract → nst=1 · genesis 2017-02 → mat=2 (conf=low: audit/activity ต้องยืนยัน)'),
 'DARK': (VT, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, S['dark'],
          'DarkSwap = swap interface ที่ส่งต่อผ่านผู้ให้บริการบุคคลที่สาม (HoudiniSwap, NEAR Intents 1Click) — ไม่มีกลไก privacy ของตัวเอง · hs/hr/ha=1 (conf=low: ความเป็นส่วนตัวมาจากเส้นทางของ third party) · tl=0: ต้องเชื่อผู้ให้บริการ/intent solver · hst=0: state บน Solana/EVM โปร่งใส · mat=0 (conf=low) · ต้องแยกให้ชัดว่า P สะท้อน "เส้นทางที่ใช้" ไม่ใช่กลไกของโปรเจกต์'),
}

# per-transaction anonymity set — what the tier-1/tier-2 measurement would need
ASET_NOTE = {
 'IRON': 'ชั้น 2: ต้องใช้จำนวน note/UTXO ใน shielded set ณ asof — ยังไม่มีแหล่งนับสาธารณะ',
 'RAIL': 'ชั้น 2: ต้องใช้จำนวน note commitment ใน shielded pool ของ Railgun ต่อเชน — ยังไม่มีแหล่งนับ',
 'TORN': 'ชั้น 2: ต้องใช้ขนาด deposit pool ต่อ denomination/epoch — ยังไม่มีแหล่งนับ (และหลัง sanction สถิติไม่น่าเชื่อถือ)',
 'UMBRA': 'ชั้น 2: ต้องใช้จำนวน stealth address ที่ยังไม่ถูก claim — ยังไม่มีแหล่งนับ',
 'ALEO': 'ชั้น 2: ต้องใช้จำนวน record ที่ยังไม่ถูก consume — ยังไม่มีแหล่งนับ',
 'DUSK': 'ชั้น 2: ต้องใช้ขนาด private pool ณ asof — ยังไม่มีแหล่งนับ',
 'AZERO': 'ชั้น 2: ต้องใช้จำนวนผู้ใช้ที่ interact กับ contract/pool เดียวกันต่อ epoch — ยังไม่มีแหล่งนับ',
 'NIGHT': 'ชั้น 2: ต้องใช้จำนวน note ใน private ledger — ยังไม่มีแหล่งนับ',
 'CC': 'ชั้น 2: ต้องใช้จำนวนคู่สัญญาที่แยกไม่ออกต่อ transaction — โมเดล Canton เป็น per-party ไม่ใช่ per-pool ต้องออกแบบการวัดก่อน',
 'XAN': 'ชั้น 2: ต้องใช้จำนวน intent ที่ settle ในกลุ่มเดียวกันต่อ epoch — ยังไม่มีแหล่งนับ',
 'ZKP': 'ชั้น 3: ไม่มี anonymity set ระดับธุรกรรมให้วัด (การโอนไม่ถูกซ่อน)',
 'NOCK': 'ชั้น 3: ไม่มี anonymity set ระดับธุรกรรมให้วัด',
 'ZER': 'ชั้น 2: จำนวน note ใน shielded pool — ยังไม่มีแหล่งนับ',
 'DARK': 'ชั้น 2: ต้องใช้ขนาด pool ของผู้ให้บริการที่ใช้เป็นเส้นทาง — ไม่ใช่ค่าของ DarkSwap เอง',
}

# genes that are genuinely stated by the project rather than inferred
CONF_OVR = {
 'IRON': {'hs': 'med', 'hr': 'med', 'ha': 'med', 'man': 'high', 'nst': 'med', 'mat': 'med'},
 'RAIL': {'man': 'med', 'nst': 'med', 'mat': 'med', 'hst': 'med'},
 'TORN': {'hs': 'med', 'hr': 'med', 'ha': 'med', 'man': 'med', 'nst': 'med', 'mat': 'med', 'hst': 'med'},
 'UMBRA': {'hr': 'med', 'man': 'med', 'nst': 'med', 'hst': 'med'},
 'ALEO': {'man': 'high', 'nst': 'med', 'hst': 'med', 'mat': 'med'},
 'DUSK': {'hst': 'med', 'nst': 'med'},
 'AZERO': {'nst': 'med', 'hst': 'low'},
 'NIGHT': {'hst': 'low', 'nst': 'med'},
 'CC': {'hst': 'med', 'nst': 'med', 'tl': 'med'},
 'XAN': {'hst': 'low', 'nst': 'med'},
 'ZKP': {'nst': 'med', 'hst': 'med', 'arch': 'med'},
 'NOCK': {'nst': 'med', 'hst': 'med'},
 'ZER': {'hs': 'med', 'hr': 'med', 'ha': 'med', 'man': 'med', 'nst': 'med', 'mat': 'med'},
 'DARK': {'hst': 'med', 'nst': 'med'},
}
DEFAULT_CONF = {'arch': 'high', 'hs': 'low', 'hr': 'low', 'ha': 'low', 'hst': 'low', 'nst': 'low',
                'man': 'low', 'tl': 'low', 'hmeta': 'low', 'hnet': 'low', 'mat': 'low',
                'pq': 'low', 'brk': 'low'}

p = os.path.join(D, 'data', 'dna3.json')
dna = json.load(io.open(p, encoding='utf-8'))
filled = 0
nulled = []
missing = []
for sym, row in TABLE.items():
    if sym not in dna:
        missing.append(sym)
        continue
    arch, hs, hr, ha, hst, nst, man, tl, hmeta, hnet, mat, pq, brk, src, note = row
    g = dna[sym]
    conf = dict(DEFAULT_CONF)
    conf.update(CONF_OVR.get(sym, {}))
    vals = {'arch': arch, 'hs': hs, 'hr': hr, 'ha': ha, 'hst': hst, 'nst': nst, 'man': man,
            'tl': tl, 'hmeta': hmeta, 'hnet': hnet, 'mat': mat, 'pq': pq, 'brk': brk}
    for k, v in vals.items():
        if v is None:
            g[k] = None                       # explicitly "no value" — the engine floors it to 0
            nulled.append('%s.%s' % (sym, k))
        else:
            g[k] = ev(v, conf[k], src, note)
    g['aset_note'] = ASET_NOTE[sym]
    filled += 1

io.open(p, 'w', encoding='utf-8').write(json.dumps(dna, ensure_ascii=False, indent=1))
print('batch 3 filled: %d assets' % filled)
print('explicit nulls: %s' % (', '.join(nulled) or 'none'))
if missing:
    print('NOT FOUND in dna3:', missing)
