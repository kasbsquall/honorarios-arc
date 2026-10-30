/**
 * Peru fourth-category income tax (renta de cuarta categoría) prepayment logic.
 *
 * Rules per R.S. 000390-2025/SUNAT (article 3.a):
 *   - Monthly threshold: S/ 4,010
 *   - If gross income in soles for the month exceeds S/ 4,010, the freelancer
 *     must make an 8% prepayment on the full month's fourth-category income.
 *   - If income is at or below S/ 4,010, no prepayment is due.
 *
 * Source: https://www.sunat.gob.pe/legislacion/superin/2025/000390-2025.pdf
 */

export const PERU_TAX_RATE = 0.08        // 8 %
export const PERU_THRESHOLD_SOLES = 4010 // S/ 4,010 per month (article 3.a)
export const PERU_THRESHOLD_SOURCE =
  'Threshold: article 3.a of R.S. 000390-2025/SUNAT'
export const PERU_THRESHOLD_URL =
  'https://www.sunat.gob.pe/legislacion/superin/2025/000390-2025.pdf'

export interface PeruTaxInput {
  /** Total fourth-category gross income in USDC this month (18-decimal bigint). */
  grossUsdc18: bigint
  /** Exchange rate: PEN per USD. Must be > 0. */
  exchangeRatePenPerUsd: number | undefined
  /** Other fourth-category income this month, in soles. Default 0. */
  otherIncomeSoles: number
  /** Contract reserve held, in 18-decimal USDC bigint. */
  reserveUsdc18: bigint
}

export interface PeruTaxResult {
  /** Gross income in soles this month (contract income + other income). */
  grossSoles: number
  /** Whether the threshold is crossed. */
  crossesThreshold: boolean
  /** Estimated prepayment in soles (0 if below threshold). */
  prepaymentSoles: number
  /** Whether the USDC reserve (converted to soles) covers the prepayment. */
  reserveCovers: boolean
  /** Reserve in soles (for display). */
  reserveSoles: number
  /** Error: undefined if calculation is valid, string if exchange rate is missing or invalid. */
  error: string | undefined
}

export function calcPeruTax(input: PeruTaxInput): PeruTaxResult {
  const { grossUsdc18, exchangeRatePenPerUsd, otherIncomeSoles, reserveUsdc18 } = input

  if (!exchangeRatePenPerUsd || exchangeRatePenPerUsd <= 0) {
    return {
      grossSoles: 0,
      crossesThreshold: false,
      prepaymentSoles: 0,
      reserveCovers: false,
      reserveSoles: 0,
      error: 'Enter the exchange rate to estimate in soles.',
    }
  }

  // Convert 18-decimal USDC to USD (divide by 1e18)
  const grossUsd = Number(grossUsdc18) / 1e18
  const reserveUsd = Number(reserveUsdc18) / 1e18

  const contractIncomeSoles = grossUsd * exchangeRatePenPerUsd
  const grossSoles = contractIncomeSoles + (otherIncomeSoles ?? 0)
  const reserveSoles = reserveUsd * exchangeRatePenPerUsd

  const crossesThreshold = grossSoles > PERU_THRESHOLD_SOLES
  const prepaymentSoles = crossesThreshold
    ? Math.round(grossSoles * PERU_TAX_RATE * 100) / 100
    : 0
  const reserveCovers = reserveSoles >= prepaymentSoles

  return {
    grossSoles: Math.round(grossSoles * 100) / 100,
    crossesThreshold,
    prepaymentSoles,
    reserveCovers,
    reserveSoles: Math.round(reserveSoles * 100) / 100,
    error: undefined,
  }
}
