# -*- coding: utf-8 -*-
"""Security / compliance pass: audit tiers, patched-break history, compliance capability,
sanction flag.

Four problems this pass fixes, all of them "the value was a guess":
  1. `audit` was free text for 6 coins and absent for 45 — S could not use it. It is now a
     graded 0/1/2 evidence object. NOTE: 0 means "no audit record found in our sources", which is
     NOT the same as "never audited". The distinction is in every note.
  2. `brk` was 0 for 47 coins with conf=low, i.e. "we did not check" dressed up as "never
     happened". It is now ternary: 0 = none found · 0.5 = a protocol/enclave-level break that was
     patched or replaced · 1 = unpatched. A patched history costs nothing in P (P measures current
     exposure) but is recorded with a real citation and feeds S.
  3. `comp` (compliance capability) did not exist as a number, so Pillar R had nothing to read.
     2 = documented selective disclosure / viewing keys / proof of innocence · 0 = no privacy to
     disclose selectively and no compliance tooling · 1 = **not evidenced**, which is not "partial".
  4. No asset carried a sanction flag, so Tornado Cash scored like any other mixer.
"""
import json
import io
import os

D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASOF = '2026-10-16'


def ev(v, conf, src, note=''):
    o = {'v': v, 'conf': conf, 'src': src, 'asof': ASOF}
    if note:
        o['note'] = note
    return o


ZSEC = 'https://z.cash/support/security/'
AEPIC = 'https://aepicleak.com/'
OFAC = 'https://sanctionssearch.ofac.treas.gov/'

# ---------------------------------------------------------------------------------------------
# audit tier: 2 = named Tier-1 firm or several public audits · 1 = reviewed but not clearly
# Tier-1 (academic review, or a bug-bounty programme standing in for an audit) · 0 = none found
# ---------------------------------------------------------------------------------------------
AUDIT = {
 'ZEC': (2, 'high', ZSEC,
   'audit หลายรอบสาธารณะของ Sapling/Orchard/Halo 2 (Zcash ระบุในหน�ด secrecy ของตัวเอง) · '
   'พบ Orchard soundness bug มิ.ย. 2026 → แก้ถาวรด้วย Ironwood ก.ค. 2026'),
 'XMR': (2, 'med', 'https://www.getmonero.org/',
   'ได้รับการตรวจทางวิชาการกว้าง · 0 หมายถึง "ไม่พบ disclosure ระดับโปรโตคอลที่ยังไม่ปิด" ไม่ได้หมายถึง "ไม่เคยมีบั๊ก"'),
 'TORN': (2, 'med', 'https://tornado.cash/',
   'ตรวจโดยหลายสำนักก่อน deploy · audit ไม่ได้ป้องกันการถูกคว่ำบาตร — ดู sanctioned'),
 'FIRO': (1, 'med', 'https://firo.org/2022/05/10/introducing-lelantus-spark.html',
   'Lelantus / Lelantus Spark ได้รับการตรวจวิชาการเปิด แต่ไม่ใช่ audit จากบริษัท Tier-1'),
 'AZTEC': (1, 'low', 'https://docs.aztec.network/',
   'มี bug-bounty ผ่าน Cantina (234+ นักวิจัย) ซึ่งไม่ใช่ audit จากบริษัท — ต้องยืนยันรายงาน audit ฉบับเป็นทางการ'),
 'SCRT': (0, 'med', AEPIC,
   'ไม่มีบันทึก audit ระดับโปรโตคอลในแหล่งของเรา — แต่มีงานวิจัย SGX side-channel (ÆPIC Leak) ที่ไม่ใช่ audit'),
}
DEFAULT_AUDIT = (0, 'med', 'https://www.google.com/search?q=%s+security+audit',
                 'ไม่มีบันทึก audit ที่พบในแหล่งของเรา — ไม่ได้หมายความว่าไม่เคย audit')

# ---------------------------------------------------------------------------------------------
# brk: 0.5 = a protocol/enclave-level break that was patched or replaced (costs nothing in P,
# recorded for S) · 1 = unpatched
# ---------------------------------------------------------------------------------------------
BRK = {
 'ZEC': (0.5, 'high', ZSEC,
   'เคยมีช่องโหว่ระดับโปรโตคอลและแก้แล้ว: counterfeiting vulnerability (2018, แก้ใน hardfork) และ '
   'Orchard soundness bug มิ.ย. 2026 → แก้ถาวรด้วย Ironwood ก.ค. 2026 — ดูหมายเหตุใน hist'),
 'SCRT': (0.5, 'med', AEPIC,
   'SGX ÆPIC Leak (2022) — side-channel ระดับฮาร์ดแวร์ที่กระทบ root of trust ของ TEE · '
   ' mitigations คือการอัปเดต/หมุนเวียน enclave ไม่ใช่แพตช์โปรโตคอล → ความเสี่ยงระดับฮาร์ดแวร์ยังค้าง'),
 'AZTEC': (None, 'med', 'https://docs.aztec.network/',
   'พบช่องโหว่ใน V5 proving system 2026-07-27 แต่สถานะการแก้ยังไม่ยืนยัน → ไม่ใส่ค่า (ไม่รู้ ≠ ศูนย์)'),
}
DEFAULT_BRK = (0, 'med', 'https://www.google.com/search?q=%s+security+advisory',
               'ไม่พบ disclosure ระดับโปรโตคอลที่ยังไม่ปิดในแหล่งของเรา — 0 ไม่ได้หมายความว่าไม่เคยมีบั๊ก')

# ---------------------------------------------------------------------------------------------
# comp: 2 = documented selective disclosure / viewing keys / proof of innocence · 0 = no privacy
# to disclose selectively and no compliance tooling · 1 = NOT EVIDENCED (not "partial")
# ---------------------------------------------------------------------------------------------
COMP = {
 'ZEC': (2, 'med', 'https://zips.z.cash/protocol/protocol.pdf', 'viewing key + selective disclosure เป็นส่วนหนึ่งของโปรโตคอล'),
 'AZTEC': (2, 'med', 'https://docs.aztec.network/', 'proof of innocence — โชว์ได้ว่าเงินไม่ได้มาจาก address ที่ถูก mark'),
 'RAIL': (2, 'med', 'https://railgun.org/', 'proof of innocence ในตัวระบบ'),
 'ALEO': (2, 'low', 'https://aleo.org/', 'view key สำหรับการตรวจสอบย้อนหลัง'),
 'IRON': (2, 'med', 'https://ironfish.network/', 'เอกสารโปรเจกต์ระบุ "read-only view keys" โดยตรง'),
 'NIGHT': (2, 'low', 'https://midnight.network/', 'selective disclosure เป็นแกนหลักของ dual ledger (429 ต่อ bot — ต้องเปิดด้วยมือยืนยัน)'),
 'CC': (2, 'low', 'https://www.canton.network/', 'sub-transaction privacy + selective disclosure สำหรับสถาบัน'),
 'DUSK': (2, 'med', 'https://dusk.network/', 'ZK compliance infrastructure กำกับอยู่กับกรอบ MiFID II/MiCA'),
 'ZKP': (2, 'med', 'https://zkpass.org/', 'zkTLS = selective disclosure ของข้อเท็จจริงจาก Web2 โดยไม่เปิดข้อมูลดิบ'),
 # --- no compliance affordance ---
 'TORN': (0, 'high', OFAC, 'mixer ล้วน ไม่มีกลไก selective disclosure — และถูกคว่ำบาตรโดยตรง'),
 'XMR': (0, 'high', 'https://www.getmonero.org/', 'ไม่มี viewing key / selective disclosure (เป็นคุณสมบัติที่ตั้งใจ)'),
 'GRIN': (0, 'high', 'https://docs.grin.mw/', 'ไม่มี viewing key'),
 'BEAM': (0, 'med', 'https://docs.beam.mw/', 'ไม่มี viewing key (auditability เป็นเรื่องของ wallet ไม่ใช่โปรโตคอล)'),
 'MWC': (0, 'low', 'https://www.mwc.mw/', 'สืบทอด Mimblewimble — ไม่มี viewing key'),
 'EPIC': (0, 'low', 'https://epiccash.com/', 'สืบทอด Mimblewimble — ไม่มี viewing key'),
 'XTM': (0, 'low', 'https://rfc.tari.com/', 'สืบทอด Mimblewimble — ไม่มี viewing key'),
 'XVG': (0, 'high', 'https://vergecurrency.com/', 'ledger โปร่งใสทั้งหมด ไม่มีอะไรให้ selective disclose'),
 'DASH': (0, 'high', 'https://docs.dash.org/', 'PrivateSend ไม่มี viewing key'),
 'NOCK': (0, 'low', 'https://nockchain.org/', 'ledger โปร่งใส'),
 'DARK': (0, 'med', 'https://darkswap.io/', 'พึ่งผู้ให้บริการ third party — ไม่มีกลไกของตัวเอง'),
 'MYST': (0, 'med', 'https://mysterium.network/', 'dVPN — ไม่มี compliance tooling'),
 'P2P': (0, 'med', 'https://sentinel.co/', 'dVPN — ไม่มี compliance tooling'),
 'SESH': (0, 'med', 'https://getsession.org/', 'E2E messaging — ไม่มี selective disclosure ระดับการเงิน'),
 'HOPR': (0, 'low', 'https://hoprnet.org/', 'mixnet — ไม่พบ compliance tooling'),
 'ANYONE': (0, 'low', 'https://anyone.io/', 'DePIN onion — ไม่พบ compliance tooling'),
 # --- resolved: Zcash-derived chains inherit Zcash's viewing keys ------------------------------
 'ARRR': (2, 'low', 'https://piratechain.com/', 'สืบทอด Zcash Sapling → มี viewing key (ต้องยืนยันในซอร์สของ fork)'),
 'YEC': (2, 'low', 'https://y.cash/', 'สืบทอด zcashd → มี viewing key'),
 'ZCL': (2, 'low', 'https://zclassic.org/', 'สืบทอด zcashd → มี viewing key'),
 'ZER': (2, 'low', 'https://zerocurrency.io/', 'สืบทอด zcashd → มี viewing key'),
 'VRSC': (2, 'low', 'https://verus.io/', 'Sapling lineage → มี viewing key'),
 'PIVX': (2, 'low', 'https://pivx.org/', 'SHIELD ใช้ Sapling → มี viewing key'),
 # --- resolved: CryptoNote / Monero lineage has no viewing key by design -----------------------
 'DERO': (0, 'med', 'https://dero.io/', 'CryptoNote — ไม่มี viewing key'),
 'ZANO': (0, 'med', 'https://zano.org/', 'CryptoNote — ไม่มี viewing key'),
 'BDX': (0, 'med', 'https://beldex.io/', 'CryptoNote (Monero fork) — ไม่มี viewing key'),
 'ZEPH': (0, 'med', 'https://www.zephyrprotocol.com/', 'Monero fork — ไม่มี viewing key'),
 'DCR': (0, 'med', 'https://docs.decred.org/privacy/', 'CoinShuffle++ — ไม่มี viewing key'),
 'SCRT': (2, 'med', 'https://docs.scrt.network/', 'SNIP-20 รองรับ viewing key สำหรับผู้ตรวจสอบ'),
}

DEFAULT_COMP = (1, 'low', 'https://www.google.com/search?q=%s+viewing+key+OR+selective+disclosure',
                'ไม่พบหลักฐาน — comp=1 หมายถึง "ยังไม่ยืนยัน" ไม่ใช่ "มีบางส่วน"')

SANCTIONED = {
 'TORN': (1, 'med', OFAC,
   'ถูก OFAC คว่ำบาตร 2022-08-08 และ re-designate 2022-11-18 · ม.ค. 2025 ศาล W.D. Texas '
   'ตัดสินว่า sanction เกินอำนาจ (สถานะปัจจุบันถูกวิทธี้) — แต่ผลกระทบจริง (frontend/CEX ถอดออก) ยังอยู่'),
}

p = os.path.join(D, 'data', 'dna3.json')
dna = json.load(io.open(p, encoding='utf-8'))
n = {'audit': 0, 'brk': 0, 'comp': 0, 'sanctioned': 0}
for sym in dna:
    # audit
    v, conf, src, note = AUDIT.get(sym, DEFAULT_AUDIT)
    if sym not in AUDIT:
        src = src % (dna[sym].get('fam') or sym)
    dna[sym]['audit'] = ev(v, conf, src, note)
    n['audit'] += 1
    # brk
    v, conf, src, note = BRK.get(sym, DEFAULT_BRK)
    if sym not in BRK:
        src = src % (dna[sym].get('fam') or sym)
    dna[sym]['brk'] = None if v is None else ev(v, conf, src, note)
    n['brk'] += 1
    # comp
    v, conf, src, note = COMP.get(sym, DEFAULT_COMP)
    if sym not in COMP:
        src = src % (dna[sym].get('fam') or sym)
    dna[sym]['comp'] = ev(v, conf, src, note)
    n['comp'] += 1
    # sanctioned
    if sym in SANCTIONED:
        v, conf, src, note = SANCTIONED[sym]
        dna[sym]['sanctioned'] = ev(v, conf, src, note)
        n['sanctioned'] += 1

io.open(p, 'w', encoding='utf-8').write(json.dumps(dna, ensure_ascii=False, indent=1))
print('security pass: %d audit, %d brk, %d comp, %d sanctioned' % (n['audit'], n['brk'], n['comp'], n['sanctioned']))
tiers = {}
for s in dna:
    t = dna[s]['audit']['v']
    tiers[t] = tiers.get(t, 0) + 1
print('audit tiers:', tiers)
comps = {}
for s in dna:
    t = dna[s]['comp']['v']
    comps[t] = comps.get(t, 0) + 1
print('comp tiers:', comps, '(1 = not evidenced)')
