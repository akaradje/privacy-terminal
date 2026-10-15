# -*- coding: utf-8 -*-
"""Batch 4 fill: DePIN / transport (VPN, mixnet, onion) / FHE-TEE compute (9 assets)
plus the consistency corrections found while filling this batch.

Rules (rubric 2.2/2.3): every value carries src + asof; arch is set; a value that cannot be
sourced is left as a bare legacy number or null with a note — never invented.
conf: high = the project's own spec/docs state it · med = stated by the project and consistent
      with its architecture · low = inference that still needs verification.
"""
import json
import io
import os

D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASOF = '2026-10-16'

S = {
    'anyone': 'https://anyone.io/',
    'hopr': 'https://hoprnet.org/',
    'myst': 'https://mysterium.network/',
    'p2p': 'https://sentinel.co/',
    'sesh': 'https://getsession.org/',
    'rose': 'https://oasis.net/',
    'pha': 'https://phala.network/',
    'oct': 'https://octra.org/',
    'zama': 'https://www.zama.ai/',
    'nym': 'https://nymtech.net/docs/',
    'scrt': 'https://docs.scrt.network/',
    'mpc': 'https://partisiablockchain.com/',
}

TRANSPORT, COMPUTE, VT = 'transport', 'compute', 'value-transfer'


def ev(v, conf, src, note=''):
    o = {'v': v, 'conf': conf, 'src': src, 'asof': ASOF}
    if note:
        o['note'] = note
    return o


# name: (arch, hs, hr, ha, hst, nst, man, tl, hmeta, hnet, mat, pq, brk, src, note)
TABLE = {
 'ANYONE': (TRANSPORT, 0, 0, 0, 0, 1, 1, 1.5, 2, 2, 1, 0, 0, S['anyone'],
            'Anyone Protocol = เครือข่าย privacy แบบ DePIN (onion routing) · โทเค็นอยู่บนเชนโฮสต์โปร่งใส → กฎ transport: hs/hr/ha=0 · ความเป็นส่วนตัวอยู่ที่ชั้นเครือข่าย: hmeta=2/hnet=2 (conf=low) · tl=1.5: ความปลอดภัยพึ่ง "มีโหนดซื่อสัตย์อย่างน้อยหนึ่งโหนดในเส้นทาง" = threshold honest-majority (conf=low) · man=1: ทราฟฟิกที่ผ่านเครือข่ายถูกซ่อนทั้งหมด ไม่มีโหมดโปร่งใส (conf=low) · mat=1 (conf=low)'),
 'HOPR': (TRANSPORT, 0, 0, 0, 0, 1, 1, 1.5, 2, 2, 2, 0, 0, S['hopr'],
          '"open incentivized mixnet which enables privacy-preserving point-to-point data exchange" — privacy ระดับ metadata ล้วน · hs/hr/ha=0 ตามกฎ transport · hmeta=2/hnet=2 · tl=1.5 (mixnet = threshold, conf=low) · man=1 · mat=2 (mainnet 2022-06, conf=low)'),
 'MYST': (TRANSPORT, 0, 0, 0, 0, 1, 0.5, 0, 1, 2, 2, 0, 0, S['myst'],
          'Mysterium Network = dVPN (WireGuard) · hs/hr/ha=0 ตามกฎ transport · hnet=2 (VPN เป็นกลไกชั้นเครือข่ายในตัว) · tl=0: VPN แบบ single-hop — โหนดทางออกเห็นทราฟฟิกได้ ต้องเชื่อผู้ให้บริการทางออก · man=0.5 (default-on เมื่อแอปเชื่อมต่อ) · hmeta=1 · หมายเหตุสำคัญ: description ที่ CoinGecko ให้มาเป็นของเหรียญ "Mystery" (lottery token) คนละโปรเจกต์ — ใช้เอกสาร Mysterium Network แทน'),
 'P2P': (TRANSPORT, 0, 0, 0, 0, 1, 0.5, 0, 1, 2, 2, 0, 0, S['p2p'],
         'Sentinel = dVPN บน Cosmos · hs/hr/ha=0 ตามกฎ transport · hnet=2 · tl=0 (single-hop: ต้องเชื่อโหนดทางออก) · man=0.5 (default-on) · mat=2 (conf=low)'),
 'SESH': (TRANSPORT, 0, 0, 0, 0, 1, 1, 1.5, 2, 2, 1, 0, 0, S['sesh'],
          'Session = แอปส่งข้อความ E2E + onion routing (3 hop) → hs/hr/ha=0 ตามกฎ transport · hmeta=2/hnet=2 (ซ่อน metadata ของการสื่อสาร) · tl=1.5 (onion routing = threshold, conf=low) · man=1 · mat=1 (conf=low: SESH เป็นโทเคนใหม่ แม้ตัวแอปจะรันมานาน)'),
 'ROSE': (COMPUTE, 0, 0, 0, 2, 0, 0, 1, 1, 0, 2, 0, 0, S['rose'],
          'Oasis: Sapphire = private EVM + Oasis Privacy Layer · hs/hr/ha=0 เพราะ "การโอน" บนเลเยอร์ consensus โปร่งใส — ความเป็นส่วนตัวอยู่ที่ state/input ของ contract → hst=2, nst=0 · tl=1: TEE (Intel SGX) เหมือน SCRT (conf=med) · mat=2 (mainnet 2020-11, conf=low) · hnet=0'),
 'PHA': (COMPUTE, 0, 0, 0, 2, 0, 0, 1, 1, 0, 2, 0, 0, S['pha'],
         'Phala = off-chain compute (TEE) สำหรับ AI agent/contract · hs/hr/ha=0 (การโอนโทเคนโปร่งใส) · hst=2 (input/state ของการประมวลผลถูกซ่อน) · tl=1: TEE (conf=med) · mat=2 (conf=low) · hnet=0'),
 'OCT': (COMPUTE, 1, 1, 1, 2, 0, 0, 2, 1, 0, 0, 2, 0, S['oct'],
         'Octra = FHE blockchain + isolated execution environments · FHE ครอบทั้งการประมวลผล → hs/hr/ha=1 (conf=low: อ้างว่าเข้ารหัส แต่ยังไม่ยืนยันบน mainnet ที่ใช้งานจริง) · hst=2 · tl=2 (FHE ไม่ต้อง trusted setup, conf=low) · pq=2 (FHE เป็น lattice-based → post-quantum, conf=low) · mat=0 (conf=low) · man=0'),
 'ZAMA': (COMPUTE, 0, 0, 0, 2, 0, 0, 2, 0, 0, 0, 2, 0, S['zama'],
          'Zama = บริษัท cryptography ที่สร้าง FHE สำหรับ blockchain (fhevm) · hs/hr/ha=0 (โทเคนอยู่บนเชนโฮสต์โปร่งใส) · hst=2 (FHE ซ่อน state ของ contract) · tl=2 (FHE, ไม่ต้อง trusted setup) · pq=2 (lattice-based → post-quantum) · mat=0 (conf=low) · hnet=0'),
}

ASET_NOTE = {
 'ANYONE': 'ชั้น 3: ไม่มี anonymity set ระดับธุรกรรม (การโอนโปร่งใส) — ตัวชี้วัดที่ควรใช้คือจำนวนโหนด/ผู้ใช้ในเส้นทาง ต้องออกแบบการวัดก่อน',
 'HOPR': 'ชั้น 3: ไม่มี anonymity set ระดับธุรกรรม — ตัวชี้วัดที่ควรใช้คือขนาด mixnet ต่อ epoch (ยังไม่มีแหล่งนับสาธารณะ)',
 'MYST': 'ชั้น 3: ไม่มี anonymity set ระดับธุรกรรม — ตัวชี้วัดที่ควรใช้คือจำนวน exit node ต่อประเทศ/ช่วงเวลา',
 'P2P': 'ชั้น 3: ไม่มี anonymity set ระดับธุรกรรม — ตัวชี้วัดที่ควรใช้คือจำนวน active node',
 'SESH': 'ชั้น 3: ไม่มี anonymity set ระดับธุรกรรม — ตัวชี้วัดที่ควรใช้คือจำนวน onion routing node ต่อ epoch',
 'ROSE': 'ชั้น 2: ต้องใช้จำนวนผู้ใช้ที่ interact กับ contract/pool เดียวกันต่อ epoch — ยังไม่มีแหล่งนับ',
 'PHA': 'ชั้น 2: ต้องใช้จำนวนผู้ใช้/worker ที่ประมวลผลงานเดียวกันต่อ epoch — ยังไม่มีแหล่งนับ',
 'OCT': 'ชั้น 2: ต้องใช้จำนวนธุรกรรมที่เข้ารหัสในกลุ่มเดียวกันต่อ epoch — ยังไม่มีแหล่งนับ',
 'ZAMA': 'ชั้น 2: ต้องใช้จำนวนผู้ใช้ที่ interact กับ contract เดียวกันต่อ epoch — ยังไม่มีแหล่งนับ',
}

CONF_OVR = {
 'ANYONE': {'hst': 'med', 'nst': 'med'},
 'HOPR': {'hst': 'med', 'nst': 'med'},
 'MYST': {'hst': 'med', 'nst': 'med'},
 'P2P': {'hst': 'med', 'nst': 'med'},
 'SESH': {'hst': 'med', 'nst': 'med'},
 'ROSE': {'hst': 'med', 'nst': 'med', 'arch': 'med'},
 'PHA': {'hst': 'med', 'nst': 'med', 'arch': 'med'},
 'OCT': {'hst': 'low', 'nst': 'med', 'arch': 'med'},
 'ZAMA': {'hst': 'med', 'nst': 'med', 'arch': 'med'},
}
DEFAULT_CONF = {'arch': 'high', 'hs': 'low', 'hr': 'low', 'ha': 'low', 'hst': 'low', 'nst': 'low',
                'man': 'low', 'tl': 'low', 'hmeta': 'low', 'hnet': 'low', 'mat': 'low',
                'pq': 'low', 'brk': 'low'}

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
    conf = dict(DEFAULT_CONF)
    conf.update(CONF_OVR.get(sym, {}))
    for k, v in {'arch': arch, 'hs': hs, 'hr': hr, 'ha': ha, 'hst': hst, 'nst': nst, 'man': man,
                 'tl': tl, 'hmeta': hmeta, 'hnet': hnet, 'mat': mat, 'pq': pq, 'brk': brk}.items():
        g[k] = None if v is None else ev(v, conf[k], src, note)
    g['aset_note'] = ASET_NOTE[sym]
    filled += 1

# ---------------------------------------------------------------------------------------------
# Consistency corrections found while filling this batch. Both were values set before the
# rules they violate existed, so they are the same class of bug the reviewer keeps catching:
# the same mechanism scored two different ways depending on when it was written.
# ---------------------------------------------------------------------------------------------
corrections = []

# (1) Mixnet / onion routing was scored tl=1 ("hardware enclave or trusted setup ceremony"),
#     which is semantically wrong — a mixnet has neither. Its security assumption is
#     "at least one honest node in the path" = a threshold honest-majority assumption, i.e. the
#     rubric's tl=1.5. Filling HOPR/ANYONE/SESH as 1.5 while NYM sat at 1 would be exactly the
#     inter-rater inconsistency the rubric is meant to prevent, so NYM is corrected too.
if 'NYM' in dna:
    _nym_tl = dna['NYM'].get('tl')
    if isinstance(_nym_tl, dict) and _nym_tl.get('v') == 1:
        dna['NYM']['tl'] = ev(1.5, 'med', S['nym'],
            'แก้ความสอดคล้อง: mixnet ไม่ใช่ hardware enclave หรือ trusted-setup ceremony — '
            'สมมติฐานความปลอดภัยคือ "มีโหนดซื่อสัตย์อย่างน้อยหนึ่งโหนดในเส้นทาง" = threshold honest-majority (tl=1.5)')
        corrections.append('NYM.tl 1 -> 1.5 (mixnet = threshold, was mapped to the TEE bucket)')

# (2) The non-value-transfer rule zeroes hs/hr/ha when the asset's OWN transfers are transparent.
#     SCRT and MPC are `compute` chains: their contract state is hidden (hst=2) but the native
#     token transfers are public — the sender is visible on chain, so hs/hr/ha = 1 was wrong.
for sym, src in (('SCRT', S['scrt']), ('MPC', S['mpc'])):
    if sym in dna:
        for k in ('hs', 'hr', 'ha'):
            dna[sym][k] = ev(0, 'med', src,
                'แก้ความสอดคล้อง: การโอนโทเคน native โปร่งใส (ที่อยู่ผู้ส่งเห็นบนเชน) — '
                'ความเป็นส่วนตัวของเชนนี้อยู่ที่ state/input ของ contract (hst) ไม่ใช่ที่ตัวการโอน')
        corrections.append('%s.%s 1 -> 0 (native transfers are transparent; privacy is contract-level)' % (sym, 'hs/hr/ha'))

io.open(p, 'w', encoding='utf-8').write(json.dumps(dna, ensure_ascii=False, indent=1))
print('batch 4 filled: %d assets' % filled)
if missing:
    print('NOT FOUND in dna3:', missing)
print('corrections applied:')
for c in corrections:
    print('  -', c)
