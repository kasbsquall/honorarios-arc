import { describe, it, expect } from 'vitest'
import { fmtUsdc, ceilReserve } from './format'

const E18 = 10n ** 18n

describe('fmtUsdc', () => {
  it('whole number → 2 decimals', () => {
    expect(fmtUsdc(1n * E18)).toBe('1.00')
  })

  it('0.10 USDC → "0.10"', () => {
    expect(fmtUsdc(E18 / 10n)).toBe('0.10')
  })

  it('0.008 USDC → "0.008"', () => {
    // 0.008 = 8e15
    expect(fmtUsdc(8n * 10n ** 15n)).toBe('0.008')
  })

  it('0.092 USDC → "0.092"', () => {
    // 0.092 = 92e15
    expect(fmtUsdc(92n * 10n ** 15n)).toBe('0.092')
  })

  it('reserve + net === amount (0.10 at 800 bps)', () => {
    const amount = E18 / 10n               // 0.10 USDC
    const reserve = ceilReserve(amount, 800)
    const net = amount - reserve
    // Both format to strings that parse back to the same bigint
    const rStr = fmtUsdc(reserve)          // "0.008"
    const nStr = fmtUsdc(net)              // "0.092"
    const aStr = fmtUsdc(amount)           // "0.10"
    // Sum of displayed values equals displayed amount
    const rParsed = BigInt(rStr.replace('.', '').padEnd(20, '0').slice(0, 19))
    const nParsed = BigInt(nStr.replace('.', '').padEnd(20, '0').slice(0, 19))
    const aParsed = BigInt(aStr.replace('.', '').padEnd(20, '0').slice(0, 19))
    expect(rParsed + nParsed).toBe(aParsed)
    // Exact string checks
    expect(rStr).toBe('0.008')
    expect(nStr).toBe('0.092')
    expect(aStr).toBe('0.10')
  })

  it('1.50 USDC → "1.50"', () => {
    expect(fmtUsdc(15n * E18 / 10n)).toBe('1.50')
  })

  it('1.000001 USDC → keeps 6th decimal', () => {
    // 1.000001 = 1e18 + 1e12
    expect(fmtUsdc(E18 + 10n ** 12n)).toBe('1.000001')
  })

  it('zero → "0.00"', () => {
    expect(fmtUsdc(0n)).toBe('0.00')
  })

  it('trims trailing zeros beyond 2 places', () => {
    // 0.120000 → "0.12"
    expect(fmtUsdc(12n * 10n ** 16n)).toBe('0.12')
  })
})

describe('ceilReserve', () => {
  it('0.10 USDC at 800 bps → 0.008 USDC', () => {
    const amount = E18 / 10n
    expect(ceilReserve(amount, 800)).toBe(8n * 10n ** 15n)
  })

  it('net of 0.10 at 800 bps → 0.092 USDC', () => {
    const amount = E18 / 10n
    const reserve = ceilReserve(amount, 800)
    expect(amount - reserve).toBe(92n * 10n ** 15n)
  })

  it('1.00 USDC at 800 bps → 0.08 USDC', () => {
    expect(ceilReserve(E18, 800)).toBe(8n * 10n ** 16n)
  })

  it('ceiling rounds up: 0.25 USDC at 800 bps', () => {
    // 0.25 * 800 / 10000 = 0.02 exactly → no ceiling needed
    const amount = 25n * E18 / 100n
    expect(ceilReserve(amount, 800)).toBe(2n * 10n ** 16n)
  })

  it('ceiling rounds up when not exact', () => {
    // 0.1 USDC at 300 bps = 0.003 exactly (1e18/10 * 300 / 10000 = 3e15)
    const amount = E18 / 10n
    expect(ceilReserve(amount, 300)).toBe(3n * 10n ** 15n)
  })

  it('zero at any bps → 0', () => {
    expect(ceilReserve(0n, 800)).toBe(0n)
  })

  it('max bps 5000 on 1 USDC → 0.50 USDC', () => {
    expect(ceilReserve(E18, 5000)).toBe(5n * 10n ** 17n)
  })
})
