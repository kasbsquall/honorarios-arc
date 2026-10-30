/** Format 18-decimal native USDC bigint to a fixed-2 string, e.g. "1.00" */
export function formatUsdc18(raw: bigint): string {
  const whole = raw / 10n ** 18n
  const frac = raw % 10n ** 18n
  // Two decimal places: take top 2 digits of fraction
  const cents = frac / 10n ** 16n
  return `${whole}.${String(cents).padStart(2, '0')}`
}

/**
 * Format an 18-decimal native USDC bigint with variable precision:
 * minimum 2 decimals, up to 6, trailing zeros trimmed — so that
 * reserve + net always equals the displayed amount.
 *
 * Examples (at 800 bps on 0.10 USDC):
 *   amount  = 0.1  USDC → "0.10"
 *   reserve = 0.008 USDC → "0.008"
 *   net     = 0.092 USDC → "0.092"
 */
export function fmtUsdc(raw: bigint): string {
  const UNIT = 10n ** 18n
  const whole = raw / UNIT
  const frac = raw % UNIT
  // Extract up to 6 significant fractional digits
  const frac6str = String(frac / 10n ** 12n).padStart(6, '0')
  // Trim trailing zeros, keeping at least 2 decimal places
  const trimmed = frac6str.replace(/0+$/, '').padEnd(2, '0')
  return `${whole}.${trimmed}`
}

/**
 * Compute the reserve for a receipt exactly as the contract does:
 *   ceil(amount * taxBps / 10_000)
 */
export function ceilReserve(amount: bigint, taxBps: number): bigint {
  const BPS = 10_000n
  return (amount * BigInt(taxBps) + BPS - 1n) / BPS
}

/** Parse a decimal string like "1.00" to 18-decimal bigint */
export function parseUsdc18(s: string): bigint {
  const [whole = '0', frac = ''] = s.split('.')
  const fracPadded = frac.slice(0, 18).padEnd(18, '0')
  return BigInt(whole) * 10n ** 18n + BigInt(fracPadded)
}

/** Shorten 0x address for display */
export function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}\u2026${addr.slice(-4)}`
}

/** Format a unix timestamp (seconds) as "Oct 25, 2026" */
export function formatDate(ts: number | bigint): string {
  return new Date(Number(ts) * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Parse a custom-error name out of a viem/wagmi error message */
export function parseContractError(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? ''
  if (msg.toLowerCase().includes('user rejected') || msg.includes('4001')) return ''
  const map: Record<string, string> = {
    TaxRateTooHigh: 'Tax rate cannot exceed 50%.',
    InvalidUtcOffset: 'UTC offset must be between −720 and 840 minutes.',
    NoProfile: 'Save your tax profile first.',
    EmptyRef: 'Reference cannot be empty.',
    RefTooLong: 'Reference must be 32 characters or fewer.',
    ConceptTooLong: 'Description must be 80 characters or fewer.',
    InvalidAmount: 'Amount must be greater than zero.',
    ReceiptExists: 'A receipt with that reference already exists.',
    UnknownReceipt: 'No receipt found with that reference.',
    AlreadyPaid: 'This receipt has already been paid.',
    WrongAmount: 'Payment amount does not match the receipt.',
    TransferFailed: 'Transfer failed. The recipient address may not be able to receive USDC.',
    InsufficientReserve: 'Withdrawal amount exceeds your reserve.',
  }
  for (const [name, human] of Object.entries(map)) {
    if (msg.includes(name)) return human
  }
  if (msg.includes('reverted')) return 'Transaction failed. Please try again.'
  if (msg.includes('network') || msg.includes('timeout'))
    return 'Network error. Check your connection and retry.'
  return 'Something went wrong. Please try again.'
}
