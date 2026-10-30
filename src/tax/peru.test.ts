import { describe, it, expect } from 'vitest'
import { calcPeruTax, PERU_THRESHOLD_SOLES } from './peru'

// 1 USDC = 1e18 units
const ONE_USDC = 10n ** 18n

describe('calcPeruTax', () => {
  const rate = 3.8 // PEN per USD

  it('returns error when exchange rate is missing', () => {
    const result = calcPeruTax({
      grossUsdc18: 100n * ONE_USDC,
      exchangeRatePenPerUsd: undefined,
      otherIncomeSoles: 0,
      reserveUsdc18: 8n * ONE_USDC,
    })
    expect(result.error).toBeDefined()
    expect(result.crossesThreshold).toBe(false)
    expect(result.prepaymentSoles).toBe(0)
  })

  it('returns error when exchange rate is zero', () => {
    const result = calcPeruTax({
      grossUsdc18: 100n * ONE_USDC,
      exchangeRatePenPerUsd: 0,
      otherIncomeSoles: 0,
      reserveUsdc18: 8n * ONE_USDC,
    })
    expect(result.error).toBeDefined()
  })

  it('is below threshold: no prepayment due', () => {
    // S/ 4,010 threshold at 3.8 rate = USD 1055.26. Use 900 USD gross.
    const grossUsdc18 = 900n * ONE_USDC
    const result = calcPeruTax({
      grossUsdc18,
      exchangeRatePenPerUsd: rate,
      otherIncomeSoles: 0,
      reserveUsdc18: 72n * ONE_USDC,
    })
    expect(result.error).toBeUndefined()
    expect(result.crossesThreshold).toBe(false)
    expect(result.prepaymentSoles).toBe(0)
    expect(result.grossSoles).toBeLessThanOrEqual(PERU_THRESHOLD_SOLES)
  })

  it('is exactly at threshold: no prepayment due (not strictly over)', () => {
    // gross soles == 4010 exactly
    const usdNeeded = PERU_THRESHOLD_SOLES / rate            // ~1055.26
    const grossUsdc18 = BigInt(Math.round(usdNeeded * 1e18))
    const result = calcPeruTax({
      grossUsdc18,
      exchangeRatePenPerUsd: rate,
      otherIncomeSoles: 0,
      reserveUsdc18: 0n,
    })
    expect(result.error).toBeUndefined()
    // At exactly the threshold (not strictly over), no prepayment
    expect(result.crossesThreshold).toBe(false)
    expect(result.prepaymentSoles).toBe(0)
  })

  it('is above threshold: prepayment is 8% of gross', () => {
    // Use 2000 USD gross at 3.8 = S/ 7,600 > S/ 4,010
    const grossUsdc18 = 2000n * ONE_USDC
    const result = calcPeruTax({
      grossUsdc18,
      exchangeRatePenPerUsd: rate,
      otherIncomeSoles: 0,
      reserveUsdc18: 0n,
    })
    expect(result.error).toBeUndefined()
    expect(result.crossesThreshold).toBe(true)
    const expectedGross = 2000 * rate
    expect(result.grossSoles).toBeCloseTo(expectedGross, 1)
    expect(result.prepaymentSoles).toBeCloseTo(expectedGross * 0.08, 1)
  })

  it('includes other income in gross', () => {
    // 500 USD contract + S/ 2,000 other = S/ 1,900 + S/ 2,000 = S/ 3,900 < S/ 4,010
    const grossUsdc18 = 500n * ONE_USDC
    const resultBelow = calcPeruTax({
      grossUsdc18,
      exchangeRatePenPerUsd: rate,
      otherIncomeSoles: 2000,
      reserveUsdc18: 0n,
    })
    expect(resultBelow.crossesThreshold).toBe(false)

    // 500 USD contract + S/ 2,500 other = S/ 1,900 + S/ 2,500 = S/ 4,400 > S/ 4,010
    const resultAbove = calcPeruTax({
      grossUsdc18,
      exchangeRatePenPerUsd: rate,
      otherIncomeSoles: 2500,
      reserveUsdc18: 0n,
    })
    expect(resultAbove.crossesThreshold).toBe(true)
    expect(resultAbove.prepaymentSoles).toBeGreaterThan(0)
  })

  it('reserve short of estimate', () => {
    // 2000 USD at 3.8 = S/ 7,600. Prepayment = S/ 608. Reserve = S/ 200.
    const grossUsdc18 = 2000n * ONE_USDC
    const reserveUsdc18 = BigInt(Math.round((200 / rate) * 1e18)) // ~52.6 USDC
    const result = calcPeruTax({
      grossUsdc18,
      exchangeRatePenPerUsd: rate,
      otherIncomeSoles: 0,
      reserveUsdc18,
    })
    expect(result.crossesThreshold).toBe(true)
    expect(result.reserveCovers).toBe(false)
  })

  it('reserve covers the estimate', () => {
    // 2000 USD at 3.8 = S/ 7,600. Prepayment = S/ 608. Reserve = 200 USDC ≈ S/ 760.
    const grossUsdc18 = 2000n * ONE_USDC
    const reserveUsdc18 = 200n * ONE_USDC
    const result = calcPeruTax({
      grossUsdc18,
      exchangeRatePenPerUsd: rate,
      otherIncomeSoles: 0,
      reserveUsdc18,
    })
    expect(result.crossesThreshold).toBe(true)
    expect(result.reserveCovers).toBe(true)
  })
})
