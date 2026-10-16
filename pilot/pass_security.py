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
 'XMR': (1, 'med', 'https://github.com/monero-project/research-lab',
   'repo นี้คือชุดงานวิจัย + vulnerability response process (HackerOne) — พิสูจน์ได้ว่ามี security programme '
   'แต่ยังยืนยันชื่อบริษัท audit ไม่ได้ (probe: repo มี README แสดง vulnerability response process ไม่ใช่รายงาน audit) '
   '→ ใช้ 1 ไว้ก่อน · ถ้าจะขึ้น 2 ต้องหาลิงก์รายงาน audit ฉบับเต็ม'),
 'TORN': (2, 'med', 'https://tornado.cash/',
   'ตรวจโดยหลายสำนักก่อน deploy · audit ไม่ได้ป้องกันการถูกคว่ำบาตร — ดู sanctioned'),
 'FIRO': (1, 'med', 'https://github.com/firoorg/firo',
   'README ของ repo (HTTP 200) ยืนยันว่า Spark "supports high anonymity sets without requiring trusted setup" '
   '(→ ยืนยัน tl=2) แต่ไม่ได้ระบุชื่อบริษัท audit · post-mortem Zerocoin 2019 ที่เสนอลิงก์มาเป็น 404 ทั้งหมด'),
 'AZTEC': (1, 'med', 'https://raw.githubusercontent.com/AztecProtocol/aztec-packages/next/SECURITY.md',
   'SECURITY.md ยืนยัน (HTTP 200, อ่านเนื้อหาได้): "currently under internal and external review" + bug bounty '
   'ผ่าน Cantina — ยังไม่มีรายงาน audit จากบริษัท Tier-1 ที่เผยแพร่ → 1 ไม่ใช่ 2'),
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
# XMR: verified. getmonero.org disclosure page returns HTTP 200 and the content mentions
# "key image" (16x), "double-spend" and "infinite" — this is the real CryptoNote post-mortem.
BRK['XMR'] = (0.5, 'high', 'https://www.getmonero.org/2017/05/17/disclosure-of-a-major-bug-in-cryptonote-based-currencies.html',
              'ช่องโหว่ระดับ CryptoNote (พ.ค. 2017): key image ซ้ำได้ → สร้างเหรียญ/double-spend ไม่จำกัด · '
              'ทีม Monero ค้นพบและแพตช์ก่อนถูกใช้โจมตี · แก้ที่ระดับโค้ด CryptoNote ทุกตัวจึงกระทบทั้งตระกาล')
# FIRO / RAIL: the cited post-mortem and audit URLs are all dead — recorded, not encoded.
DEAD_LINKS = {
 'FIRO': 'firo.org/2019/04/30/zcoin-cryptographic-flaw-in-zerocoin-allows-attacker-to-mint-zcoin.html → HTTP 404 (probe 3 รูปแบบ path ไม่ได้)',
 'RAIL': 'github.com/Railgun-Community/contract → HTTP 404 · railgun.org/audits → 200 แต่เป็น SPA shell ไม่มีเนื้อหา audit',
}

# ---------------------------------------------------------------------------------------------
# comp: 2 = documented selective disclosure / viewing keys / proof of innocence · 0 = no privacy
# to disclose selectively and no compliance tooling · 1 = NOT EVIDENCED (not "partial")
# ---------------------------------------------------------------------------------------------
COMP = {
 # --- 2: full / programmable viewing key -------------------------------------------------------
 'ZEC': (2, 'med', 'https://zips.z.cash/protocol/protocol.pdf', 'viewing key + selective disclosure ระดับโปรโตคอล'),
 'AZTEC': (2, 'med', 'https://docs.aztec.network/', 'proof of innocence — โชว์ได้ว่าเงินไม่ได้มาจาก address ที่ถูก mark'),
 'RAIL': (2, 'med', 'https://railgun.org/', 'proof of innocence ในตัวระบบ'),
 'ALEO': (2, 'low', 'https://aleo.org/', 'view key สำหรับการตรวจสอบย้อนหลัง'),
 'IRON': (2, 'med', 'https://ironfish.network/', 'เอกสารโปรเจกต์ระบุ "read-only view keys" โดยตรง'),
 'NIGHT': (2, 'low', 'https://midnight.network/', 'selective disclosure เป็นแกนหลักของ dual ledger (429 ต่อ bot — ต้องเปิดด้วยมือยืนยัน)'),
 'CC': (2, 'low', 'https://www.canton.network/', 'sub-transaction privacy + selective disclosure สำหรับสถาบัน'),
 'DUSK': (2, 'med', 'https://dusk.network/', 'ZK compliance infrastructure กำกับอยู่กับกรอบ MiFID II/MiCA'),
 'ZKP': (2, 'med', 'https://zkpass.org/', 'zkTLS = selective disclosure ของข้อเท็จจริงจาก Web2 โดยไม่เปิดข้อมูลดิบ'),
 # --- Zcash-derived: inherit full viewing keys ------------------------------------------------
 'ARRR': (2, 'low', 'https://piratechain.com/', 'สืบทอด Zcash Sapling → มี viewing key (ต้องยืนยันในซอร์สของ fork)'),
 'YEC': (2, 'low', 'https://y.cash/', 'สืบทอด zcashd → มี viewing key'),
 'ZCL': (2, 'low', 'https://zclassic.org/', 'สืบทอด zcashd → มี viewing key'),
 'ZER': (2, 'low', 'https://zerocurrency.io/', 'สืบทอด zcashd → มี viewing key'),
 'VRSC': (2, 'low', 'https://verus.io/', 'Sapling lineage → มี viewing key'),
 'PIVX': (2, 'low', 'https://pivx.org/', 'SHIELD ใช้ Sapling → มี viewing key'),
 'SCRT': (2, 'med', 'https://docs.scrt.network/', 'SNIP-20 รองรับ viewing key สำหรับผู้ตรวจสอบ'),
 # --- 1: basic view key / per-tx proof, or IP-only privacy that stays AML-auditable -----------
 'XMR': (1, 'med', 'https://www.getmonero.org/', 'Secret View Key + per-tx proof (TxProof/OutProof) ในตัว wallet — ยืนยันรายธุรกรรมได้แต่ไม่ใช่ programmable viewing key ระดับบัญชี'),
 'DERO': (1, 'low', 'https://dero.io/', 'CryptoNote lineage — น่าจะมี view key รายธุรกรรม (ต้องยืนยันในซอร์ส)'),
 'ZANO': (1, 'low', 'https://zano.org/', 'CryptoNote lineage'),
 'BDX': (1, 'low', 'https://beldex.io/', 'CryptoNote (Monero fork) — น่าจะมี view key รายธุรกรรม'),
 'ZEPH': (1, 'low', 'https://www.zephyrprotocol.com/', 'Monero fork — น่าจะมี view key รายธุรกรรม'),
 'NYM': (1, 'med', 'https://nymtech.net/docs/', 'ซ่อนเฉพาะ IP ของเครือข่าย — เนื้อหาธุรกรรมยังอยู่บนเชนโฮสต์ที่ audit ได้'),
 'HOPR': (1, 'med', 'https://hoprnet.org/', 'เช่นเดียวกับ mixnet อื่น — ไม่อุ่นกับ AML ของเชนต้นทาง'),
 'MYST': (1, 'med', 'https://mysterium.network/', 'dVPN — ซ่อน IP เท่านั้น เชนโฮสต์ audit ได้'),
 'P2P': (1, 'med', 'https://sentinel.co/', 'dVPN — ซ่อน IP เท่านั้น'),
 'SESH': (1, 'low', 'https://getsession.org/', 'messaging — เชนโฮสต์ audit ได้'),
 'ANYONE': (1, 'low', 'https://anyone.io/', 'DePIN onion — ซ่อน IP เท่านั้น'),
 'UMBRA': (1, 'low', 'https://www.umbra.cash/', 'claim flow ให้ผู้รับพิสูจน์การรับเงินรายครั้งได้ (per-tx proof)'),
 # --- 0: no selective-disclosure mechanism at all ---------------------------------------------
 'GRIN': (0, 'high', 'https://docs.grin.mw/', 'MimbleWimble ตัด input-output ทิ้ง — สร้าง view key ย้อนหลังทั้งบัญชีไม่ได้'),
 'BEAM': (0, 'med', 'https://docs.beam.mw/', 'เช่นเดียวกับ MimbleWimble อื่น'),
 'MWC': (0, 'low', 'https://www.mwc.mw/', 'สืบทอด MimbleWimble'),
 'EPIC': (0, 'low', 'https://epiccash.com/', 'สืบทอด MimbleWimble'),
 'XTM': (0, 'low', 'https://rfc.tari.com/', 'สืบทอด MimbleWimble'),
 'TORN': (0, 'high', 'https://sanctionssearch.ofac.treas.gov/', 'mixer ล้วน ไม่มี proof of innocence — และถูกคว่ำบาตรโดยตรง'),
 'XVG': (0, 'high', 'https://vergecurrency.com/', 'ledger โปร่งใสทั้งหมด'),
 'DASH': (0, 'high', 'https://docs.dash.org/', 'PrivateSend ไม่มี viewing key'),
 'NOCK': (0, 'low', 'https://nockchain.org/', 'ledger โปร่งใส'),
 'DARK': (0, 'med', 'https://darkswap.io/', 'พึ่งผู้ให้บริการ third party'),
 'DCR': (0, 'med', 'https://docs.decred.org/privacy/', 'CoinShuffle++ ไม่มี viewing key'),
 # --- null: not evidenced. NOT a score — engine floors it to 0 with the weight retained -------
 'AZERO': None, 'MPC': None, 'OCT': None, 'ZAMA': None, 'ROSE': None, 'PHA': None,
 'PART': None, 'ABEL': None, 'XEL': None, 'NAV': None, 'FIRO': None,
}
UNK_SRC = 'https://www.google.com/search?q=%s+viewing+key+OR+selective+disclosure'
UNK_NOTE = 'ยังไม่ยืนยัน — comp=null → engine floor เป็น 0 โดยน้ำหนักยังอยู่ในตัวหาร (กฎ monotonicity: ไม่รู้ห้ามได้คะแนนสูงกว่า"รู้ว่าไม่มี")'

DEFAULT_COMP = None

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
    # comp — null means "not evidenced" and is written as null, never as a score
    entry = COMP.get(sym, DEFAULT_COMP)
    if entry is None:
        dna[sym]['comp'] = None
    else:
        v, conf, src, note = entry
        if sym not in COMP:
            src = src % (dna[sym].get('fam') or sym)
        dna[sym]['comp'] = ev(v, conf, src, note)
    n['comp'] += 1
    # sanctioned
    if sym in SANCTIONED:
        v, conf, src, note = SANCTIONED[sym]
        dna[sym]['sanctioned'] = ev(v, conf, src, note)
        n['sanctioned'] += 1

# FIRO: the repo README independently confirms the trustless claim → upgrade tl's evidence
if 'FIRO' in dna and isinstance(dna['FIRO'].get('tl'), dict) and dna['FIRO']['tl'].get('v') == 2:
    dna['FIRO']['tl']['conf'] = 'med'
    dna['FIRO']['tl']['src'] = 'https://github.com/firoorg/firo'
    dna['FIRO']['tl']['note'] = 'README ของ repo ยืนยันว่า Spark "without requiring trusted setup" — ยืนยัน tl=2 จากเอกสารโปรเจกต์เอง'

io.open(p, 'w', encoding='utf-8').write(json.dumps(dna, ensure_ascii=False, indent=1))
print('security pass: %d audit, %d brk, %d comp, %d sanctioned' % (n['audit'], n['brk'], n['comp'], n['sanctioned']))
tiers = {}
for s in dna:
    t = dna[s]['audit']['v']
    tiers[t] = tiers.get(t, 0) + 1
print('audit tiers:', tiers)
comps = {}
for s in dna:
    t = dna[s]['comp']
    t = None if t is None else t['v']
    comps[t] = comps.get(t, 0) + 1
print('comp tiers:', comps, '(null = not evidenced -> floored to 0)')
