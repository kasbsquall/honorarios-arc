import { describe, it, expect } from 'vitest'
import { csvField, fmtUsdcCsv, fmtDateTimeCsv, buildMonthCsv } from './csv'

describe('csvField', () => {
  it('passes through plain text unchanged', () => {
    expect(csvField('hello')).toBe('hello')
  })
  it('wraps text containing a comma', () => {
    expect(csvField('a,b')).toBe('"a,b"')
  })
  it('escapes internal double-quotes', () => {
    expect(csvField('say "hi"')).toBe('"say ""hi"""')
  })
  it('wraps text containing a newline', () => {
    expect(csvField('line1\nline2')).toBe('"line1\nline2"')
  })
  it('wraps text containing double-quote only', () => {
    expect(csvField('"quoted"')).toBe('"""quoted"""')
  })
})

describe('fmtUsdcCsv', () => {
  it('formats 1 USDC (1e18) as 1.00', () => {
    expect(fmtUsdcCsv(1_000_000_000_000_000_000n)).toBe('1.00')
  })
  it('formats 0.92 USDC correctly', () => {
    expect(fmtUsdcCsv(920_000_000_000_000_000n)).toBe('0.92')
  })
  it('formats 0.08 USDC (reserve on 1 USDC at 8%)', () => {
    expect(fmtUsdcCsv(80_000_000_000_000_000n)).toBe('0.08')
  })
  it('rounds half-up', () => {
    // 0.005 USDC = 5e15 — boundary: should round up to 0.01
    expect(fmtUsdcCsv(5_000_000_000_000_000n)).toBe('0.01')
  })
  it('formats 0', () => {
    expect(fmtUsdcCsv(0n)).toBe('0.00')
  })
  it('formats large amount', () => {
    expect(fmtUsdcCsv(10_250_000_000_000_000_000n)).toBe('10.25')
  })
})

describe('fmtDateTimeCsv', () => {
  it('offsets by utcOffsetMin correctly (UTC-5 = -300 min)', () => {
    // 2024-01-15 12:00:00 UTC → 2024-01-15 07:00 UTC-5
    const ts = Date.UTC(2024, 0, 15, 12, 0, 0) / 1000
    expect(fmtDateTimeCsv(ts, -300)).toBe('2024-01-15 07:00')
  })
  it('handles positive offset (UTC+5:30)', () => {
    // 2024-01-15 00:00:00 UTC → 2024-01-15 05:30 UTC+5:30
    const ts = Date.UTC(2024, 0, 15, 0, 0, 0) / 1000
    expect(fmtDateTimeCsv(ts, 330)).toBe('2024-01-15 05:30')
  })
})

describe('buildMonthCsv', () => {
  it('produces the header row', () => {
    const csv = buildMonthCsv([], {})
    expect(csv.startsWith('ref,concept,payer')).toBe(true)
  })
  it('escapes concept with comma', () => {
    const row = {
      ref: 'E001-1',
      concept: 'Design, October',
      payer: '0x1234567890abcdef1234567890abcdef12345678',
      paidAt: Date.UTC(2024, 0, 15, 12, 0, 0) / 1000,
      utcOffsetMin: -300,
      grossRaw: 1_000_000_000_000_000_000n,
      taxBps: 800,
    }
    const csv = buildMonthCsv([row], {})
    expect(csv).toContain('"Design, October"')
  })
  it('calculates reserve and net correctly at 8%', () => {
    const row = {
      ref: 'E001-1',
      concept: 'Test',
      payer: '0x1234567890abcdef1234567890abcdef12345678',
      paidAt: Date.UTC(2024, 0, 15, 12, 0, 0) / 1000,
      utcOffsetMin: -300,
      grossRaw: 1_000_000_000_000_000_000n, // 1 USDC
      taxBps: 800,  // 8%
    }
    const csv = buildMonthCsv([row], { 'E001-1': true })
    const lines = csv.split('\r\n')
    expect(lines[1]).toContain('1.00')  // gross
    expect(lines[1]).toContain('0.08')  // reserve (ceil(1e18 * 800 / 10000))
    expect(lines[1]).toContain('0.92')  // net
    expect(lines[1]).toContain('yes')   // net_delivered
  })
})
