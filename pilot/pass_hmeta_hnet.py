# -*- coding: utf-8 -*-
"""Focused pass: re-value `hnet` and `hmeta` from protocol features, and extend `hst` to cover
off-chain / client-side private computation (which fixes zkPass).

Why: nearly every `hnet`/`hmeta` value carried conf=low because it was inferred from "the vibe of
the architecture". The rubric now defines both genes by protocol-level features (see
data/schema/rubric.json), so the value can be read off a node/client/protocol document instead of
guessed. conf is raised only where such a document exists; where the feature is *inherited* from a
fork and not verified in that project's own source, conf stays low on purpose.

conf=high  the project's own protocol/node/client doc states the feature
conf=med   stated by the project and directly implied by its architecture
conf=low   inherited from a fork, or "no evidence found" for a value of 0
"""
import json
import io
import os

D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASOF = '2026-10-16'

# name: (hnet, hnet_conf, hnet_src, hnet_note)
HNET = {
 # --- 2: enforced or default at the protocol layer ---------------------------------------------
 'XMR':  (2, 'high', 'https://docs.getmonero.org/', 'Dandelion++ ฝังในโปรโตคอลและเป็นค่าเริ่มต้น (stem phase) — node spec ระบุ'),
 'GRIN': (2, 'high', 'https://docs.grin.mw/', 'Dandelion (stem phase) เป็นส่วนของโปรโตคอล — docs ระบุ'),
 'BEAM': (2, 'med', 'https://docs.beam.mw/', 'Dandelion อยู่ในโปรโตคอล'),
 'MWC':  (2, 'low', 'https://www.mwc.mw/', 'สืบทอด Dandelion จาก Grin (MWC เป็น Grin fork) — ยังไม่ยืนยันในซอร์สของโปรเจกต์เอง'),
 'EPIC': (2, 'low', 'https://epiccash.com/', 'สืบทอดจาก Grin — ยังไม่ยืนยันในซอร์สของโปรเจกต์เอง'),
 'XTM':  (2, 'low', 'https://rfc.tari.com/', 'MimbleWimble chain — ต้องยืนยัน Dandelion ในซอร์ส'),
 'NYM':  (2, 'high', 'https://nymtech.net/docs/', 'mixnet — Sphinx packet ขนาดคงที่ทั้งเครือข่าย เป็นตัวโปรโตคอลเอง'),
 'HOPR': (2, 'high', 'https://hoprnet.org/', 'incentivized mixnet — network-layer privacy คือผลิตภัณฑ์'),
 'ANYONE': (2, 'med', 'https://anyone.io/', 'onion routing แบบ DePIN'),
 'SESH': (2, 'high', 'https://getsession.org/', 'onion routing 3 hop ในตัวแอป — ไม่มีโหมดส่งตรง'),
 'MYST': (2, 'med', 'https://mysterium.network/', 'dVPN — ทราฟฟิกทั้งหมดวิ่งผ่าน tunnel เมื่อเชื่อมต่อ'),
 'P2P':  (2, 'med', 'https://sentinel.co/', 'dVPN'),
 'XVG':  (2, 'low', 'https://vergecurrency.com/', 'Tor/I2P ฝังใน core QT wallet (เอกสารโปรเจกต์) — เป็นระดับ wallet ไม่ใช่ consensus'),
 # --- 1: opt-in Tor/I2P in the official client --------------------------------------------------
 'ZEC':  (1, 'med', 'https://zcash.github.io/zcash/', 'zcashd รองรับ Tor แบบเลือกใช้ (ไม่ใช่ค่าเริ่มต้นของชั้น P2P)'),
 'YEC':  (1, 'low', 'https://y.cash/', 'สืบทอด zcashd'),
 'ZCL':  (1, 'low', 'https://zclassic.org/', 'สืบทอด zcashd'),
 'ZER':  (1, 'low', 'https://zerocurrency.io/', 'สืบทอด zcashd'),
 'DASH': (1, 'low', 'https://docs.dash.org/', 'Dash Core รองรับ Tor แบบเลือกใช้'),
 'FIRO': (1, 'low', 'https://firo.org/', 'Firo client รองรับ Tor แบบเลือกใช้'),
 'PIVX': (1, 'low', 'https://pivx.org/', 'PIVX wallet รองรับ Tor แบบเลือกใช้'),
 'PART': (1, 'low', 'https://particl.io/', 'Particl wallet รองรับ Tor แบบเลือกใช้'),
 'VRSC': (1, 'low', 'https://verus.io/', 'Verus client รองรับ Tor แบบเลือกใช้'),
 'IRON': (1, 'low', 'https://ironfish.network/', 'Iron Fish CLI รองรับ Tor — ต้องยืนยันว่าเปิดเป็นค่าเริ่มต้นหรือไม่'),
 'DCR':  (1, 'med', 'https://docs.decred.org/privacy/', 'CoinShuffle++ วิ่งบน mixnet แต่เฉพาะธุรกรรมที่ผู้ใช้เลือก mix'),
 # --- 0: standard gossip / RPC ------------------------------------------------------------------
 'AZTEC': (0, 'med', 'https://docs.aztec.network/', 'rollup บน Ethereum — IP ของ sequencer/prover เปิดเผยตามมาตรฐาน EVM'),
 'RAIL': (0, 'med', 'https://railgun.org/', 'EVM smart contract — RPC/gossip มาตรฐาน'),
 'TORN': (0, 'med', 'https://tornado.cash/', 'EVM smart contract — RPC/gossip มาตรฐาน'),
 'UMBRA': (0, 'med', 'https://www.umbra.cash/', 'Solana/EVM — RPC มาตรฐาน'),
 'SCRT': (0, 'med', 'https://docs.scrt.network/', 'Cosmos SDK P2P gossip มาตรฐาน'),
 'MPC':  (0, 'med', 'https://partisiablockchain.com/', 'P2P gossip มาตรฐาน'),
 'ROSE': (0, 'med', 'https://oasis.net/', 'P2P gossip มาตรฐาน'),
 'PHA':  (0, 'med', 'https://phala.network/', 'P2P gossip มาตรฐาน'),
 'AZERO': (0, 'med', 'https://alephzero.org/', 'Substrate P2P gossip มาตรฐาน'),
 'DUSK': (0, 'low', 'https://dusk.network/', 'ไม่พบ network-layer privacy ในตัว'),
 'NIGHT': (0, 'low', 'https://midnight.network/', 'ไม่พบ network-layer privacy ในตัว'),
 'XAN':  (0, 'low', 'https://anoma.net/', 'ไม่พบ network-layer privacy ในตัว'),
 'CC':   (0, 'low', 'https://www.canton.network/', 'ไม่พบ network-layer privacy ในตัว'),
 'OCT':  (0, 'low', 'https://octra.org/', 'ไม่พบ network-layer privacy ในตัว'),
 'ZAMA': (0, 'low', 'https://www.zama.ai/', 'ไม่พบ network-layer privacy ในตัว'),
 'ZKP':  (0, 'low', 'https://zkpass.org/', 'ไม่พบ network-layer privacy ในตัว'),
 'NOCK': (0, 'low', 'https://nockchain.org/', 'ไม่พบ network-layer privacy ในตัว'),
 'DARK': (0, 'low', 'https://darkswap.io/', 'ไม่พบ network-layer privacy ในตัว'),
 'ARRR': (0, 'low', 'https://piratechain.com/', 'ไม่พบ network-layer privacy ในตัว'),
 'NAV':  (0, 'low', 'https://navcoin.org/', 'ไม่พบ network-layer privacy ในตัว'),
 'ALEO': (0, 'low', 'https://aleo.org/', 'ไม่พบ network-layer privacy ในตัว'),
 'DERO': (0, 'low', 'https://dero.io/', 'CryptoNote fork (ไม่ใช่ Monero) — ไม่พบ Dandelion ในซอร์ส'),
 'ZANO': (0, 'low', 'https://zano.org/', 'codebase ของตัวเอง — ไม่พบ network-layer privacy'),
 'XEL':  (0, 'low', 'https://xelis.io/', 'codebase ของตัวเอง (Rust) — ไม่พบ network-layer privacy'),
 'ABEL': (0, 'low', 'https://www.abelian.info/', 'codebase ของตัวเอง — ไม่พบ network-layer privacy'),
 'BDX':  (2, 'low', 'https://beldex.io/', 'Beldex เป็น Monero fork → น่าจะสืบทอด Dandelion++ แต่ยังไม่ยืนยัน'),
 'ZEPH': (2, 'low', 'https://www.zephyrprotocol.com/', 'Zephyr เป็น Monero fork → น่าจะสืบทอด Dandelion++ แต่ยังไม่ยืนยัน'),
}

# name: (hmeta, hmeta_conf, hmeta_src, hmeta_note)
HMETA = {
 # --- 2: graph hidden AND timing/size correlation mitigated -------------------------------------
 'NYM':  (2, 'high', 'https://nymtech.net/docs/', 'Sphinx packet ขนาดคงที่ — ไม่มี linkage และขนาดไม่เปิดเผย'),
 'HOPR': (2, 'high', 'https://hoprnet.org/', 'mixnet packet ขนาดคงที่'),
 'ANYONE': (2, 'med', 'https://anyone.io/', 'onion routing — ขนาด packet คงที่ตามเส้นทาง'),
 'SESH': (2, 'high', 'https://getsession.org/', 'onion routing + sealed sender — ไม่มีโหมดเปิดกราฟ'),
 'GRIN': (2, 'med', 'https://docs.grin.mw/', 'cut-through + kernel aggregation: ธุรกรรมกลางทางไม่ขึ้นเชน และ kernel ไม่ผูกกับ output'),
 'BEAM': (2, 'med', 'https://docs.beam.mw/', 'cut-through + kernel aggregation'),
 'MWC':  (2, 'low', 'https://www.mwc.mw/', 'สืบทอด MimbleWimble cut-through จาก Grin'),
 'EPIC': (2, 'low', 'https://epiccash.com/', 'สืบทอด MimbleWimble cut-through'),
 'XTM':  (2, 'low', 'https://rfc.tari.com/', 'MimbleWimble cut-through'),
 'ZEC':  (2, 'med', 'https://zips.z.cash/protocol/protocol.pdf', 'Orchard shielded pool: note commitment ไม่มี linkage กับที่อยู่ และไม่เปิดกราฟ'),
 'CC':   (2, 'low', 'https://www.canton.network/', 'sub-transaction privacy — คู่สัญญาที่ไม่เกี่ยวข้องไม่เห็นกราฟธุรกรรมนั้นเลย'),
 # --- 1: content hidden but timing/size still visible -------------------------------------------
 'XMR':  (1, 'high', 'https://docs.getmonero.org/', 'RingCT ซ่อนจำนวน/ที่อยู่ แต่จำนวน input-output และขนาด tx ยังแปรผันตามโครงสร้าง'),
 'DERO': (1, 'low', 'https://dero.io/', 'homomorphic — ซ่อนเนื้อหา แต่ขนาด/จังหวะยังเห็น'),
 'ZANO': (1, 'low', 'https://zano.org/', 'RingCT lineage'),
 'BDX':  (1, 'low', 'https://beldex.io/', 'RingCT lineage'),
 'ZEPH': (1, 'low', 'https://www.zephyrprotocol.com/', 'RingCT lineage'),
 'XEL':  (1, 'low', 'https://xelis.io/', 'ซ่อนเนื้อหา แต่ขนาด/จังหวะยังเห็น'),
 'ABEL': (1, 'low', 'https://www.abelian.info/', 'post-quantum ring — ซ่อนเนื้อหา แต่โครงสร้าง tx ยังเห็น'),
 'IRON': (1, 'low', 'https://ironfish.network/', 'encrypted UTXO — ซ่อนเนื้อหา แต่จำนวน input/output ยังเห็น'),
 'ALEO': (1, 'low', 'https://aleo.org/', 'record model ซ่อนเนื้อหา แต่จำนวน record/gas ยังเห็น'),
 'ARRR': (1, 'low', 'https://piratechain.com/', 'shielded ทั้งหมด แต่ค่า fee/จังหวะยังสังเกตได้'),
 'NAV':  (1, 'low', 'https://navcoin.org/', 'blsCT ซ่อนเนื้อหา แต่จังหวะ/ขนาดยังเห็น'),
 'RAIL': (1, 'med', 'https://railgun.org/', 'ซ่อนเนื้อหาภายใน pool แต่ gas/จังหวะการเรียก contract ยังเห็น'),
 'TORN': (1, 'med', 'https://tornado.cash/', 'ซ่อนเนื้อหา แต่จังหวะฝาก/ถอนและ denomination ยังเห็น'),
 'UMBRA': (1, 'low', 'https://www.umbra.cash/', 'stealth address ซ่อนผู้รับ แต่กราฟของ tx ที่ให้ทุนยังเห็น'),
 'AZTEC': (1, 'med', 'https://docs.aztec.network/', 'ซ่อนเนื้อหาใน rollup แต่การส่ง batch ขึ้น L1 และ gas ยังเห็น'),
 'SCRT': (1, 'med', 'https://docs.scrt.network/', 'contract input/state ถูกซ่อน แต่ gas และจังหวะการเรียกยังเห็น'),
 'MPC':  (1, 'low', 'https://partisiablockchain.com/', 'contract state ซ่อน แต่ gas/จังหวะยังเห็น'),
 'ROSE': (1, 'low', 'https://oasis.net/', 'Sapphire ซ่อน input แต่ gas/จังหวะยังเห็น'),
 'PHA':  (1, 'low', 'https://phala.network/', 'งานประมวลผลซ่อน แต่การเรียก contract ยังเห็น'),
 'AZERO': (1, 'low', 'https://alephzero.org/', 'ชั้น privacy เป็น opt-in — จังหวะการเรียกยังเห็น'),
 'DUSK': (1, 'low', 'https://dusk.network/', 'private contract — gas/จังหวะยังเห็น'),
 'NIGHT': (1, 'low', 'https://midnight.network/', 'dual ledger — ฝั่ง public ยังเปิดกราฟ'),
 'XAN':  (1, 'low', 'https://anoma.net/', 'intent settlement แบบ shielded — จังหวะยังเห็น'),
 'OCT':  (1, 'low', 'https://octra.org/', 'FHE — ยังไม่ยืนยันรูปแบบ metadata'),
 'ZAMA': (1, 'low', 'https://www.zama.ai/', 'FHE ซ่อน state แต่จังหวะการเรียกยังเห็น'),
 'ZKP':  (1, 'low', 'https://zkpass.org/', 'ข้อมูลต้นทางถูกซ่อน แต่การยื่น proof ขึ้นเชนมีจังหวะ/ค่า gas ที่เห็นได้'),
 'MYST': (1, 'low', 'https://mysterium.network/', 'traffic อยู่ใน tunnel แต่ขนาด/จังหวะยังสัมพันธ์กับทราฟฟิกจริง'),
 'P2P':  (1, 'low', 'https://sentinel.co/', 'เช่นเดียวกับ dVPN อื่น'),
 'FIRO': (1, 'low', 'https://firo.org/', 'Lelantus Spark ซ่อนเนื้อหา แต่ค่า fee/จังหวะยังเห็น'),
 'PIVX': (1, 'low', 'https://pivx.org/', 'SHIELD ซ่อนเนื้อหา แต่จังหวะยังเห็น'),
 'YEC':  (1, 'low', 'https://y.cash/', 'shielded แบบ opt-in — กราฟของ transparent tx ยังเปิด'),
 'ZCL':  (1, 'low', 'https://zclassic.org/', 'shielded แบบ opt-in'),
 'ZER':  (1, 'low', 'https://zerocurrency.io/', 'shielded แบบ opt-in'),
 'VRSC': (1, 'low', 'https://verus.io/', 'shielded แบบ opt-in'),
 'DARK': (0, 'low', 'https://darkswap.io/', 'พึ่งผู้ให้บริการ third party — ไม่มีกลไก metadata ของตัวเอง'),
 'DCR':  (1, 'low', 'https://docs.decred.org/privacy/', 'CoinShuffle++ ซ่อนเนื้อหา แต่จำนวน/จังหวะของ CoinJoin ยังเห็น'),
 # --- 0: graph clearly exposed ------------------------------------------------------------------
 'DASH': (0, 'med', 'https://docs.dash.org/en/stable/docs/user/private-send.html', 'PrivateSend ใช้ denomination คงที่บนที่อยู่โปร่งใส — กราฟยังตามได้'),
 'XVG':  (0, 'med', 'https://vergecurrency.com/', 'ledger โปร่งใสทั้งหมด — กราฟเปิด'),
 'NOCK': (0, 'low', 'https://nockchain.org/', 'ZKPoW เป็นกลไก consensus — ไม่พบการป้องกัน metadata ระดับธุรกรรม'),
}

p = os.path.join(D, 'data', 'dna3.json')
dna = json.load(io.open(p, encoding='utf-8'))
changes = []
for gene, table in (('hnet', HNET), ('hmeta', HMETA)):
    for sym, (v, conf, src, note) in table.items():
        if sym not in dna:
            continue
        old = dna[sym].get(gene)
        oldv = old.get('v') if isinstance(old, dict) else old
        dna[sym][gene] = {'v': v, 'conf': conf, 'src': src, 'asof': ASOF, 'note': note}
        if oldv != v or (isinstance(old, dict) and old.get('conf') != conf):
            changes.append('%s.%s %s -> %s (conf %s)' % (sym, gene, oldv,
                           v, conf if not isinstance(old, dict) else (old.get('conf') or '?') + '->' + conf))

# --- hst extension: off-chain / client-side private computation ---------------------------------
# zkPass (ZKP) is a zkTLS attestation protocol: the sensitive data never leaves the client and only
# a proof reaches the chain. Under the extended `hst` definition that is private state, so the
# gene is 2 and `nst` must be 0 (there IS a state being protected). It also has no transparent
# mode for the attested data, so `man` = 1.
if 'ZKP' in dna:
    src = 'https://zkpass.org/'
    dna['ZKP']['hst'] = {'v': 2, 'conf': 'med', 'src': src, 'asof': ASOF,
        'note': 'ข้อมูลต้นทางไม่เคยออกจากฝั่งผู้ใช้ — มีเพียง proof ขึ้นเชน (zkTLS) → นับเป็น private state ตามนิยาม hst ที่ขยายแล้ว'}
    dna['ZKP']['nst'] = {'v': 0, 'conf': 'med', 'src': src, 'asof': ASOF,
        'note': 'มี state ที่ต้องปกป้อง (ข้อมูลต้นทาง + ผลการพิสูจน์) — ไม่ใช่เชนที่ไม่มี state'}
    dna['ZKP']['man'] = {'v': 1, 'conf': 'low', 'src': src, 'asof': ASOF,
        'note': 'ไม่มีโหมดเปิดเผยข้อมูลต้นทางเลย — การใช้โปรโตคอลคือการใช้ privacy โดยโครงสร้าง'}
    dna['ZKP']['tl'] = {'v': 1.5, 'conf': 'med', 'src': src, 'asof': ASOF,
        'note': '3P-TLS ต้องมี proxy ในรอบ TLS + hybrid-ZK → สมมติฐานแบบ threshold ไม่ใช่ trustless เต็มรูปแบบ'}
    dna['ZKP']['mat'] = {'v': 1, 'conf': 'low', 'src': src, 'asof': ASOF,
        'note': 'ใช้งานจริง 1-3 ปี — ต้องยืนยันจำนวน audit สาธารณะ'}
    changes.append('ZKP: hst 0->2, nst 1->0, man 0->1, tl 1->1.5, mat 0->1 (hst definition extended to zkTLS)')

io.open(p, 'w', encoding='utf-8').write(json.dumps(dna, ensure_ascii=False, indent=1))
print('pass applied. %d value changes:' % len(changes))
for c in changes:
    print('  -', c)
