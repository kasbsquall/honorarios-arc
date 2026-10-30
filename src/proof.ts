/**
 * Demo transaction hashes for the /proof page.
 * Filled in by hand after the mainnet run (Arc mainnet, 2026-10-29).
 * Each entry has: a transaction hash, a human-readable label, and the expected status.
 */
export interface DemoTx {
  hash: `0x${string}`
  label: string
  expect: 'success' | 'reverted'
}

export const DEMO_TRANSACTIONS: DemoTx[] = [
  {
    hash: '0x1ac344ea8c4f050ace2458efe3585cebe40b86c4ee58250dafbd374bbc150779',
    label: 'Deploy Honorarios (same bytecode as the Arc Studio testnet deploy)',
    expect: 'success',
  },
  {
    hash: '0xed3bc2b6eddff4d7926370a054cc6f0c5556c15fca47c26f10975a6ef3914dc2',
    label: 'setProfile: Peru preset, 8% reserve, Lima time (UTC-5)',
    expect: 'success',
  },
  {
    hash: '0xa6ab5854294e878d08c72151bfaa5d825c142f63b8d9ffff17935ae674c8c553',
    label: 'issue E001-1 for 0.50 USDC',
    expect: 'success',
  },
  {
    hash: '0x324132c480032d8805a987ff6cf3e12eccea31ef6ff33d8bf57e0417dc398cf0',
    label: 'issue E001-2 for 0.25 USDC',
    expect: 'success',
  },
  {
    hash: '0x3c7904377e2c22aabce22bc489564fa15388303941656741d064a47d8119a089',
    label: 'issue E001-3 for 0.10 USDC (left pending for reviewers)',
    expect: 'success',
  },
  {
    hash: '0x30c9e7c7b325a1a0322a328ccda7d1458ef81d23bbdb8ce8f4e0e972cff36a72',
    label: 'pay E001-1: 0.46 net to the freelancer and 0.04 to the reserve, same transaction',
    expect: 'success',
  },
  {
    hash: '0xbaf34646f3540728d2885cd2897c4286f1f4df56124e075ecebbe6f90f4cca8c',
    label: 'pay E001-1 again: rejected, AlreadyPaid',
    expect: 'reverted',
  },
  {
    hash: '0x2809a749917dd21752b0d9cc04d43876507850f6d69ed3f24cafa1989334fc0c',
    label: 'pay E001-2 with 0.20 instead of 0.25: rejected, WrongAmount',
    expect: 'reverted',
  },
  {
    hash: '0x88f827de17c35c3db74197e97215a3e042bd9ac9ca6c29999e7971a4714cd70c',
    label: 'setProfile: reserve raised to 10% after E001-2 was issued',
    expect: 'success',
  },
  {
    hash: '0xed3e6c04994250c09f7cd83f74664fbb9c4bea1ee3bde17349064b5dec59daab',
    label: 'pay E001-2: reserve stays at the 8% in force when it was issued (0.02)',
    expect: 'success',
  },
  {
    hash: '0x6daa238c06d1b36d386d7f1b8be0341e67664b506f152babbdbaf46111bc12a2',
    label: 'withdrawReserve: the full 0.06 reserve back to the freelancer',
    expect: 'success',
  },
]
