/**
 * CSV builder for monthly statements.
 *
 * Rules:
 * - Fields containing commas, double-quotes or newlines are wrapped in double-quotes.
 * - Double-quotes inside a field are escaped as "".
 * - Amounts are formatted with 2 decimal places (18-decimal native → divide by 1e16 for cents).
 * - All dates/times are expressed in the freelancer's tax time zone (utcOffsetMin).
 */

/** Escape a single CSV field. */
export function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

/** Format a bigint with 18 decimals to 2 decimal places (round half-up). */
export function fmtUsdcCsv(raw: bigint): string {
  // 1e16 per cent → divide raw by 1e16, keep remainder for rounding
  const cents100 = raw / 10n ** 16n          // gives 100× the display value (i.e. 2 decimal places)
  const rem = raw % 10n ** 16n               // remainder
  const rounded = rem >= 5n * 10n ** 15n ? cents100 + 1n : cents100
  const whole = rounded / 100n
  const frac = rounded % 100n
  return `${whole}.${String(frac).padStart(2, '0')}`
}

/** Format a Unix timestamp with an offset (minutes east of UTC) to a local date-time string. */
export function fmtDateTimeCsv(unixSec: number, utcOffsetMin: number): string {
  const ms = (unixSec + utcOffsetMin * 60) * 1000
  const d = new Date(ms)
  // All fields are UTC because we already shifted by the offset
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  )
}

export interface CsvRow {
  ref: string
  concept: string
  payer: string
  paidAt: number      // Unix seconds
  utcOffsetMin: number
  grossRaw: bigint
  taxBps: number
  payTxHash?: string
}

const HEADERS = ['ref', 'concept', 'payer', 'paid_at', 'gross_usdc', 'reserve_usdc', 'net_usdc', 'net_delivered', 'tx_hash']

export function buildMonthCsv(rows: CsvRow[], netSentMap: Record<string, boolean>): string {
  const lines: string[] = [HEADERS.join(',')]
  for (const row of rows) {
    const BPS = 10_000n
    const reserve = (row.grossRaw * BigInt(row.taxBps) + BPS - 1n) / BPS
    const net = row.grossRaw - reserve
    const netDelivered = netSentMap[row.ref] !== false ? 'yes' : 'pending'
    lines.push([
      csvField(row.ref),
      csvField(row.concept),
      csvField(row.payer),
      csvField(fmtDateTimeCsv(row.paidAt, row.utcOffsetMin)),
      csvField(fmtUsdcCsv(row.grossRaw)),
      csvField(fmtUsdcCsv(reserve)),
      csvField(fmtUsdcCsv(net)),
      csvField(netDelivered),
      csvField(row.payTxHash ?? ''),
    ].join(','))
  }
  return lines.join('\r\n')
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
