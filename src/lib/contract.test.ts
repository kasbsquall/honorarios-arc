/**
 * Unit tests for parseProfileTuple.
 *
 * profileOf returns a viem readonly tuple [taxBps, utcOffsetMin, isSet]
 * (not a named object). These tests confirm the decoder handles both the
 * set and unset cases correctly and coerces the numeric fields.
 */
import { describe, it, expect } from 'vitest'
import { parseProfileTuple, type ProfileTuple } from './profile'

describe('parseProfileTuple', () => {
  it('returns a Profile when isSet is true', () => {
    const tuple: ProfileTuple = [800, -300, true]
    const result = parseProfileTuple(tuple)
    expect(result).not.toBeNull()
    expect(result?.taxBps).toBe(800)
    expect(result?.utcOffsetMin).toBe(-300)
    expect(result?.isSet).toBe(true)
  })

  it('returns null when isSet is false', () => {
    const tuple: ProfileTuple = [0, 0, false]
    expect(parseProfileTuple(tuple)).toBeNull()
  })

  it('returns null for a zero profile where isSet is false', () => {
    // This is the default state for an address that has never called setProfile
    const tuple: ProfileTuple = [0, 0, false]
    const result = parseProfileTuple(tuple)
    expect(result).toBeNull()
  })

  it('coerces bigint-like numbers (viem may return ABI number types)', () => {
    // viem uint16/int16 come back as numbers; Number() on a number is a no-op
    const tuple: ProfileTuple = [500, 60, true]
    const result = parseProfileTuple(tuple)
    expect(result?.taxBps).toBe(500)
    expect(result?.utcOffsetMin).toBe(60)
  })

  it('handles maximum valid taxBps (5000 = 50%)', () => {
    const tuple: ProfileTuple = [5000, 840, true]
    const result = parseProfileTuple(tuple)
    expect(result?.taxBps).toBe(5000)
    expect(result?.utcOffsetMin).toBe(840)
  })

  it('handles minimum valid utcOffsetMin (-720)', () => {
    const tuple: ProfileTuple = [800, -720, true]
    const result = parseProfileTuple(tuple)
    expect(result?.utcOffsetMin).toBe(-720)
  })
})
