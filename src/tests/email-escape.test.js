import { describe, it, expect } from 'vitest'
import { escapeHtml, safeImageUrl, photoHostsFromEnv } from '../../scripts/lib/html.js'
import { emailIconImg } from '../../scripts/email-icons.js'

describe('escapeHtml', () => {
  it('escapes markup and quotes', () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe('&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;')
  })
  it('handles null/undefined/numbers', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
    expect(escapeHtml(4)).toBe('4')
  })
  it('neutralises a phishing link payload', () => {
    const out = escapeHtml('<a href="https://evil.test">Reset your password</a>')
    expect(out).not.toContain('<a')
  })
})

describe('safeImageUrl', () => {
  const hosts = ['abc.supabase.co']
  it('allows https urls on allowed hosts', () => {
    expect(safeImageUrl('https://abc.supabase.co/storage/v1/object/public/p/x.jpg?t=1', hosts))
      .toBe('https://abc.supabase.co/storage/v1/object/public/p/x.jpg?t=1')
  })
  it.each([
    'http://abc.supabase.co/x.jpg',
    'https://evil.test/pixel.gif',
    'https://abc.supabase.co.evil.test/x.jpg',
    'javascript:alert(1)',
    '"><script>',
    '',
    null,
  ])('rejects %s', (u) => expect(safeImageUrl(u, hosts)).toBe(''))
  it('attribute-escapes quotes in otherwise valid URLs', () => {
    expect(safeImageUrl('https://abc.supabase.co/a"b.jpg', hosts)).not.toContain('"')
  })
  it('derives hosts from env', () => {
    expect(photoHostsFromEnv({ SUPABASE_URL: 'https://abc.supabase.co' })).toEqual(['abc.supabase.co'])
    expect(photoHostsFromEnv({})).toEqual([])
  })
})

describe('emailIconImg', () => {
  it('escapes alt text', () => {
    expect(emailIconImg('trophy', 'https://x.test', { alt: '"><script>' })).not.toContain('<script>')
  })
})
