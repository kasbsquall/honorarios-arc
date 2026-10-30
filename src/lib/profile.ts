/**
 * Decoder for the viem tuple returned by `profileOf`.
 *
 * viem returns multi-output reads as a readonly tuple indexed by position,
 * not a named object.
 *
 * profileOf outputs (in ABI order):
 *   [0] taxBps       uint16
 *   [1] utcOffsetMin int16
 *   [2] isSet        bool
 */
export type ProfileTuple = readonly [taxBps: number, utcOffsetMin: number, isSet: boolean]

export interface Profile {
  taxBps: number
  utcOffsetMin: number
  isSet: boolean
}

/**
 * Decode a ProfileTuple into a Profile, or return null when isSet is false.
 */
export function parseProfileTuple(tuple: ProfileTuple): Profile | null {
  const [taxBps, utcOffsetMin, isSet] = tuple
  if (!isSet) return null
  return { taxBps: Number(taxBps), utcOffsetMin: Number(utcOffsetMin), isSet: true }
}
