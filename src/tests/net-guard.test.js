import { describe, it, expect, vi } from 'vitest'
import {
  isPrivateIPv4, isPrivateIPv6, isPrivateIp, parseSafeUrl, safeFetchText, UnsafeTargetError,
} from '../../supabase/functions/_shared/net-guard.ts'

describe('isPrivateIp', () => {
  it.each([
    '0.0.0.0', '10.1.2.3', '127.0.0.1', '169.254.169.254', '172.16.0.1', '172.31.255.255',
    '192.168.1.1', '100.64.0.1', '100.127.255.254', '224.0.0.1', '255.255.255.255',
  ])('blocks private/reserved IPv4 %s', (ip) => expect(isPrivateIPv4(ip)).toBe(true))

  it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '100.63.0.1', '93.184.216.34'])(
    'allows public IPv4 %s', (ip) => expect(isPrivateIPv4(ip)).toBe(false))

  it.each([
    '::1', '::', 'fd00::1', 'fc00::1', 'fe80::1', 'ff02::1',
    '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:10.0.0.1', '[::1]',
  ])('blocks private IPv6 %s', (ip) => expect(isPrivateIPv6(ip)).toBe(true))

  it.each(['2606:4700:4700::1111', '2001:4860:4860::8888'])(
    'allows public IPv6 %s', (ip) => expect(isPrivateIPv6(ip)).toBe(false))

  it('dispatches by address family', () => {
    expect(isPrivateIp('10.0.0.1')).toBe(true)
    expect(isPrivateIp('fd12::1')).toBe(true)
    expect(isPrivateIp('8.8.8.8')).toBe(false)
  })
})

describe('parseSafeUrl', () => {
  it.each([
    'ftp://example.com/', 'file:///etc/passwd', 'http://localhost/', 'http://foo.localhost/',
    'http://127.0.0.1/', 'http://2130706433/', 'http://0x7f.0.0.1/', 'http://[::1]/',
    'http://[::ffff:127.0.0.1]/', 'http://169.254.169.254/latest/meta-data',
    'http://user:pw@example.com/', 'http://example.com:8080/', 'http://printer.local/',
    'http://metadata.internal/', 'not a url',
  ])('rejects %s', (u) => expect(() => parseSafeUrl(u)).toThrow(UnsafeTargetError))

  it('accepts a normal https url', () => {
    expect(parseSafeUrl('https://distilld.io/whisky/x').hostname).toBe('distilld.io')
  })

  it('enforces the host allow-list (exact or subdomain)', () => {
    expect(() => parseSafeUrl('https://www.distilld.io/x', ['distilld.io'])).not.toThrow()
    expect(() => parseSafeUrl('https://evil-distilld.io/x', ['distilld.io'])).toThrow(UnsafeTargetError)
    expect(() => parseSafeUrl('https://example.com/', ['distilld.io'])).toThrow(UnsafeTargetError)
  })
})

function res(status, body = '', headers = {}) {
  return new Response(body, { status, headers })
}

describe('safeFetchText', () => {
  const publicDns = async () => ['93.184.216.34']

  it('fetches a public page with redirect:manual', async () => {
    const fetchFn = vi.fn(async () => res(200, '<html>ok</html>'))
    const out = await safeFetchText('https://example.com/a', { resolveDns: publicDns, fetchFn })
    expect(out.html).toBe('<html>ok</html>')
    expect(fetchFn.mock.calls[0][1].redirect).toBe('manual')
  })

  it('blocks a hostname that resolves to a private address', async () => {
    const fetchFn = vi.fn()
    await expect(
      safeFetchText('https://rebind.example.com/', { resolveDns: async () => ['127.0.0.1'], fetchFn }),
    ).rejects.toThrow(/private/)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('blocks when ANY resolved address is private (mixed A/AAAA)', async () => {
    const resolveDns = async (_h, type) => (type === 'A' ? ['93.184.216.34'] : ['fd00::1'])
    await expect(safeFetchText('https://x.example.com/', { resolveDns, fetchFn: vi.fn() })).rejects.toThrow(/private/)
  })

  it('re-validates redirect targets (public → metadata IP)', async () => {
    const fetchFn = vi.fn(async () => res(302, '', { location: 'http://169.254.169.254/latest/meta-data' }))
    await expect(
      safeFetchText('https://example.com/', { resolveDns: publicDns, fetchFn }),
    ).rejects.toThrow(UnsafeTargetError)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('re-validates redirects against the allow-list', async () => {
    const fetchFn = vi.fn(async () => res(301, '', { location: 'https://evil.example.org/' }))
    await expect(
      safeFetchText('https://distilld.io/x', { resolveDns: publicDns, fetchFn }, { allowedHosts: ['distilld.io'] }),
    ).rejects.toThrow(/allow-list/)
  })

  it('follows safe redirects and caps the hop count', async () => {
    let n = 0
    const fetchFn = vi.fn(async () => res(302, '', { location: `https://example.com/${++n}` }))
    await expect(
      safeFetchText('https://example.com/', { resolveDns: publicDns, fetchFn }, { maxRedirects: 2 }),
    ).rejects.toThrow(/Too many redirects/)
    expect(fetchFn).toHaveBeenCalledTimes(3)
  })

  it('rejects oversized responses', async () => {
    const fetchFn = vi.fn(async () => res(200, 'x'.repeat(2000)))
    await expect(
      safeFetchText('https://example.com/', { resolveDns: publicDns, fetchFn }, { maxBytes: 1000 }),
    ).rejects.toThrow(/too large/)
  })

  it('fails when the host does not resolve', async () => {
    await expect(
      safeFetchText('https://nx.example.com/', { resolveDns: async () => { throw new Error('nx') }, fetchFn: vi.fn() }),
    ).rejects.toThrow(/did not resolve/)
  })
})
