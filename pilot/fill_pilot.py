# -*- coding: utf-8 -*-
"""Pilot round: fill all 12 genes for the 6 pilot coins with evidence objects {v, conf, src, asof, note}.

Rules honoured:
- a value that cannot be backed by a source is left OUT (null), never guessed as 0
- src points at the project's own specification/documentation (domain-level, not a fabricated deep link)
- conf: high = the source states it directly; med = derived from the source; low = inference / contested
"""
import json
import io
import os

D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASOF = '2026-10-16'

XMR_DOC = 'https://www.getmonero.org/library/Zero-to-Monero-2-0-0.pdf'
XMR_RESEARCH = 'https://github.com/monero-project/research-lab'
XMR_DOCS = 'https://docs.getmonero.org/'
ZEC_SPEC = 'https://zips.z.cash/protocol/protocol.pdf'
ZEC_TECH = 'https://z.cash/technology/'
AZTEC_DOCS = 'https://docs.aztec.network/'
AZTEC_SITE = 'https://aztec.network/'
SCRT_DOCS = 'https://docs.scrt.network/'
SCRT_SITE = 'https://scrt.network/'
MPC_DOCS = 'https://partisiablockchain.com/'
MPC_SITE = 'https://partisiablockchain.com/'
NYM_SITE = 'https://nymtech.net/'
NYM_DOCS = 'https://nymtech.net/docs/'


def ev(v, conf, src, note=''):
    d = {'v': v, 'conf': conf, 'src': src, 'asof': ASOF}
    if note:
        d['note'] = note
    return d


PILOT = {
 'XMR': {
   'hs': ev(2, 'high', XMR_DOC, 'ทุกธุรกรรมซ่อนผู้ส่งด้วย ring signature — ไม่มีโหมด transparent'),
   'hr': ev(2, 'high', XMR_DOC, 'stealth address ทุกธุรกรรม'),
   'ha': ev(2, 'high', XMR_DOC, 'RingCT ซ่อนจำนวนทุกธุรกรรม'),
   'hst': ev(0, 'high', XMR_DOCS, 'ไม่มี execution layer / smart contract'),
   'nst': ev(1, 'high', XMR_DOCS, 'สกุลเงินล้วน ไม่มี state'),
   'hmeta': ev(1, 'med', XMR_DOCS, 'ขนาด tx ค่อนข้างสม่ำเสมอจาก RingCT แต่ fee ยังผันผวนและยังมี timing leak'),
   'hnet': ev(2, 'high', XMR_DOCS, 'Dandelion++ ทำงานโดยปริยายในตัวไคลเอนต์มาตรฐาน'),
   'man': ev(1, 'high', XMR_DOC, 'privacy บังคับ ไม่มีโหมดเปิดเผย'),
   'tl': ev(2, 'high', XMR_DOC, 'PoW เปิด ไม่มี trusted setup และไม่มีคณะผู้ดูแล'),
   'mat': ev(2, 'high', XMR_DOCS, 'mainnet 2014 (>3 ปี) + งานวิจัย/audit หลายชิ้น'),
   'pq': ev(0, 'high', XMR_DOCS, 'พึ่ง elliptic curve (Ed25519/curve25519) ไม่มีแผน PQ ที่ใช้แล้ว'),
   'brk': ev(0, 'med', XMR_RESEARCH, 'ข้อค้นพบเรื่อง traceability ในอดีตถูกแก้แล้ว (decoy sampling 2019)'),
   'aset': ev(4, 'low', XMR_RESEARCH, 'effective ไม่เท่า ring size: งานวิจัยด้าน heuristic (Miller et al. 2017; Kumar et al. 2017) ชี้ว่า effective set เล็กกว่ามาก หลังแก้ decoy sampling ยังเป็นที่ถกเถียง — ค่านี้ต้องยืนยันด้วยการวัดจริง'),
 },
 'ZEC': {
   'hs': ev(1, 'high', ZEC_SPEC, 'shielded ซ่อนได้ แต่ยังมี transparent address และเป็นค่าเริ่มต้นของหลายวอลเล็ต/กระดาน'),
   'hr': ev(1, 'high', ZEC_SPEC, 'เหมือน hs — opt-in ผ่าน shielded pool'),
   'ha': ev(1, 'high', ZEC_SPEC, 'จำนวนถูกซ่อนเฉพาะใน shielded pool'),
   'hst': ev(0, 'high', ZEC_TECH, 'ไม่มี general smart contract'),
   'nst': ev(1, 'high', ZEC_TECH, 'สกุลเงินล้วน'),
   'hmeta': ev(1, 'med', ZEC_SPEC, 'ภายใน pool รูปแบบสม่ำเสมอ แต่ fee และ timing ยังเปิด และ transparent tx รั่วทั้งหมด'),
   'hnet': ev(1, 'med', ZEC_TECH, 'รองรับ Tor ในไคลเอนต์ แต่ผู้ใช้ต้องตั้งเอง (opt-in)'),
   'man': ev(0, 'high', ZEC_SPEC, 'opt-in — transparent pool ยังเป็นทางเลือกหลัก'),
   'tl': ev(2, 'high', ZEC_SPEC, 'Orchard/Halo 2 ไม่ต้อง trusted setup (Sprout/Sapling รุ่นก่อนมี)'),
   'mat': ev(2, 'high', ZEC_TECH, 'mainnet 2016 (>3 ปี) + audit หลายครั้ง'),
   'pq': ev(0, 'high', ZEC_SPEC, 'พึ่ง elliptic curve (BLS12-381 / Pasta)'),
   'brk': ev(0, 'high', ZEC_SITE_NOTE := 'https://z.cash/', 'Orchard soundness bug มิ.ย. 2026 ถูกเปิดเผยและแก้ถาวรด้วย Ironwood ก.ค. 2026'),
 },
 'AZTEC': {
   'hs': ev(1, 'med', AZTEC_DOCS, 'private function ซ่อนโดยปริยาย แต่โปรโตคอลยังมี public function/state ให้ใช้'),
   'hr': ev(1, 'med', AZTEC_DOCS, 'เหมือน hs — ขึ้นกับว่า contract ใช้ private หรือ public'),
   'ha': ev(1, 'med', AZTEC_DOCS, 'จำนวนถูกซ่อนใน private execution'),
   'hst': ev(2, 'high', AZTEC_DOCS, 'private state ถูกเข้ารหัสและพิสูจน์ฝั่งผู้ใช้ (client-side proving)'),
   'nst': ev(0, 'high', AZTEC_DOCS, 'มี state layer เต็มรูปแบบ'),
   'hmeta': ev(1, 'low', AZTEC_DOCS, 'fee/timing ยังเปิด และขนาด proof ไม่คงที่ — ต้องยืนยันด้วยการวัด'),
   'hnet': ev(0, 'med', AZTEC_DOCS, 'ไม่มี network privacy ในตัว ผู้ใช้ต้องพึ่งเครื่องมือภายนอก'),
   'man': ev(0, 'low', AZTEC_DOCS, 'ค่าเริ่มต้นขึ้นกับ contract — ถ้าเขียน public function ก็เปิดเผยได้'),
   'tl': ev(2, 'med', AZTEC_SITE, 'PLONK/Honk ไม่ต้อง trusted setup + พิสูจน์ฝั่งผู้ใช้'),
   'mat': ev(0, 'high', AZTEC_SITE, 'Ignition mainnet พ.ย. 2025 — ใช้งานจริงไม่ถึง 1 ปี และยังเป็น alpha'),
   'pq': ev(0, 'high', AZTEC_DOCS, 'พึ่ง elliptic curve'),
 },
 'SCRT': {
   'hs': ev(1, 'med', SCRT_DOCS, 'Secret contract ซ่อนได้ แต่การโอน/ธุรกรรมสาธารณะยังเปิด'),
   'hr': ev(1, 'med', SCRT_DOCS, 'เหมือน hs'),
   'ha': ev(1, 'med', SCRT_DOCS, 'ซ่อนได้ใน secret contract (SNIP-20 private)'),
   'hst': ev(2, 'high', SCRT_DOCS, 'contract state ถูกเข้ารหัสใน TEE'),
   'nst': ev(0, 'high', SCRT_DOCS, 'มี state layer'),
   'hmeta': ev(1, 'low', SCRT_DOCS, 'fee/timing เปิด — ต้องยืนยันด้วยการวัด'),
   'hnet': ev(0, 'med', SCRT_DOCS, 'ไม่มี network privacy ในตัว'),
   'man': ev(0, 'med', SCRT_DOCS, 'public contract ยังเป็นค่าเริ่มต้นของหลายกรณี'),
   'tl': ev(1, 'high', SCRT_DOCS, 'ต้องเชื่อฮาร์ดแวร์ TEE (SGX) — ความเสี่ยงนี้อยู่ที่ tl เท่านั้น ไม่นับใน aset'),
   'mat': ev(2, 'high', SCRT_SITE, 'mainnet 2020 (>3 ปี) + audit หลายครั้ง'),
   'pq': ev(0, 'med', SCRT_DOCS, 'พึ่ง elliptic curve'),
   'brk': ev(0, 'low', SCRT_DOCS, 'งานวิจัย SGX side-channel ถูกเปิดเผยและมีการ upgrade/rotation แต่ผลกระทบต่อ privacy ยังถกเถียง'),
 },
 'MPC': {
   'hs': ev(1, 'med', MPC_DOCS, 'MPC secret-sharing ซ่อน input ของ contract ที่เลือกใช้ แต่การโอนสาธารณะยังเปิด'),
   'hr': ev(1, 'med', MPC_DOCS, 'เหมือน hs'),
   'ha': ev(1, 'med', MPC_DOCS, 'ซ่อนจำนวนได้ใน MPC contract'),
   'hst': ev(2, 'med', MPC_DOCS, 'state ถูกแบ่งเป็น secret share ระหว่างคณะ MPC'),
   'nst': ev(0, 'high', MPC_DOCS, 'มี state layer'),
   'hmeta': ev(1, 'low', MPC_DOCS, 'fee/timing เปิด — ต้องยืนยันด้วยการวัด'),
   'hnet': ev(0, 'low', MPC_DOCS, 'ไม่มี network privacy ในตัว'),
   'man': ev(0, 'low', MPC_DOCS, 'private contract เป็นทางเลือก ไม่ใช่ค่าเริ่มต้นของทั้งเครือข่าย'),
   'tl': ev(1, 'high', MPC_DOCS, 'เชื่อ honest-majority ของคณะ MPC — ความเสี่ยงนี้อยู่ที่ tl เท่านั้น'),
   'mat': ev(2, 'med', MPC_SITE, 'mainnet 2022 (เกิน 3 ปี) — ต้องยืนยันรายการ audit ให้ครบ'),
   'pq': ev(0, 'low', MPC_DOCS, 'พึ่ง elliptic curve'),
   'brk': ev(0, 'low', MPC_DOCS, 'ไม่พบ disclosure ที่กระทบ privacy — ยังต้องตรวจ advisory ย้อนหลังให้ครบ'),
 },
 'NYM': {
   'hs': ev(1, 'med', NYM_SITE, 'ซ่อนผู้ส่งที่ระดับ network/metadata ไม่ใช่ผู้ส่งบนเชน'),
   'hr': ev(1, 'med', NYM_SITE, 'เหมือน hs — mixnet ซ่อนปลายทางของการสื่อสาร'),
   'ha': ev(0, 'high', NYM_DOCS, 'ไม่มีการซ่อนจำนวน เพราะไม่ได้เป็นระบบโอนมูลค่า'),
   'hst': ev(0, 'high', NYM_DOCS, 'ไม่มี state layer ให้ซ่อน'),
   'nst': ev(1, 'med', NYM_DOCS, 'ไม่ใช่สกุลเงินที่มี state'),
   'hmeta': ev(2, 'high', NYM_DOCS, 'Sphinx packet ทำให้ทุกแพ็กเก็ตมีรูปแบบเดียวกันโดยปริยาย'),
   'hnet': ev(2, 'high', NYM_DOCS, 'mixnet ทำงานโดยปริยายสำหรับทราฟฟิกที่ผ่านเครือข่าย'),
   'man': ev(1, 'med', NYM_DOCS, 'ทราฟฟิกที่ผ่าน mixnet ถูกผสมโดยปริยาย แต่ผู้ใช้ต้องเลือกใช้เครือข่ายนี้'),
   'tl': ev(1, 'med', NYM_DOCS, 'ต้องเชื่อ mix node ว่าจะไม่ collude — ไม่ trustless เต็มรูปแบบ'),
   'mat': ev(2, 'med', NYM_SITE, 'mainnet 2022 (เกิน 3 ปี) — audit ต้องยืนยันรายการ'),
   'pq': ev(0, 'low', NYM_DOCS, 'พึ่ง elliptic curve'),
   'brk': ev(0, 'low', NYM_DOCS, 'ไม่พบ disclosure ที่กระทบ privacy — ยังต้องตรวจ advisory ให้ครบ'),
 },
}

p = os.path.join(D, 'data', 'dna3.json')
dna = json.load(io.open(p, encoding='utf-8'))
filled = 0
for sym, genes in PILOT.items():
    if sym not in dna:
        print('MISSING coin in dna3:', sym)
        continue
    for k, v in genes.items():
        dna[sym][k] = v
        filled += 1
io.open(p, 'w', encoding='utf-8').write(json.dumps(dna, ensure_ascii=False, indent=1))
print('filled %d gene values across %d pilot coins' % (filled, len(PILOT)))
