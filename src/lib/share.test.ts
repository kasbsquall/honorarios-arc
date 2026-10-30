import { describe, it, expect } from 'vitest'
import { buildOwnBase } from './share'

// buildOwnBase is a pure function — no window needed.

describe('buildOwnBase', () => {
  it('root path "/" → origin only', () => {
    expect(buildOwnBase('https://example.com', '/')).toBe('https://example.com')
  })

  it('sub-path without trailing slash', () => {
    expect(buildOwnBase('https://example.com', '/honorarios')).toBe('https://example.com/honorarios')
  })

  it('sub-path with trailing slash', () => {
    expect(buildOwnBase('https://example.com', '/honorarios/')).toBe('https://example.com/honorarios')
  })

  it('sub-path ending in index.html', () => {
    expect(buildOwnBase('https://example.com', '/honorarios/index.html')).toBe('https://example.com/honorarios')
  })

  it('root /index.html', () => {
    expect(buildOwnBase('https://example.com', '/index.html')).toBe('https://example.com')
  })

  it('double trailing slash', () => {
    expect(buildOwnBase('https://example.com', '/honorarios//')).toBe('https://example.com/honorarios')
  })

  it('preserves multi-segment sub-path', () => {
    expect(buildOwnBase('https://username.github.io', '/honorarios/v2/')).toBe('https://username.github.io/honorarios/v2')
  })
})
