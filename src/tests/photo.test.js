import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockUpload = vi.fn()
const mockGetPublicUrl = vi.fn()
const mockRemove = vi.fn()
const mockStorageFrom = vi.fn(() => ({
  upload: mockUpload,
  getPublicUrl: mockGetPublicUrl,
  remove: mockRemove,
}))

vi.mock('../utils/compressImage.js', () => ({
  compressImage: vi.fn(() => Promise.resolve({
    blob: new Blob(['fake']),
    dataUrl: 'data:image/jpeg;base64,fake',
    kb: 5,
  })),
}))

vi.mock('../lib/supabase.js', () => ({
  sb: {
    auth: { updateUser: vi.fn() },
    from: vi.fn(),
    rpc: vi.fn(),
    storage: { from: mockStorageFrom },
  },
}))

describe('usePhoto', () => {
  let currentUser

  beforeEach(async () => {
    localStorage.setItem('dj_locale', 'en')
    vi.clearAllMocks()
    currentUser = (await import('../composables/useAuth.js')).currentUser
    currentUser.value = { id: 'u1', email: 'test@test.com' }
  })

  afterEach(() => {
    localStorage.clear()
    if (currentUser) currentUser.value = null
  })

  async function getMod() {
    return await import('../composables/usePhoto.js')
  }

  it('selectPhoto compresses and stores preview', async () => {
    const file = new File(['fake-image'], 'test.jpg', { type: 'image/jpeg' })
    const mod = await getMod()
    const photo = mod.usePhoto()

    await photo.selectPhoto(file)

    expect(photo.pendingBlob.value).toBeTruthy()
    expect(photo.previewUrl.value).toBeTruthy()
    expect(photo.compressedKb.value).toBeGreaterThanOrEqual(0)
  })

  it('clearPhoto resets all state', async () => {
    const mod = await getMod()
    const photo = mod.usePhoto()

    // Set some state
    const file = new File(['fake-image'], 'test.jpg', { type: 'image/jpeg' })
    await photo.selectPhoto(file)
    expect(photo.previewUrl.value).toBeTruthy()

    photo.clearPhoto()

    expect(photo.pendingBlob.value).toBeNull()
    expect(photo.previewUrl.value).toBeNull()
    expect(photo.currentUrl.value).toBeNull()
    expect(photo.compressedKb.value).toBeNull()
  })

  it('loadExisting sets preview and current url', async () => {
    const mod = await getMod()
    const photo = mod.usePhoto()

    photo.loadExisting('http://example.com/photo.jpg')

    expect(photo.currentUrl.value).toBe('http://example.com/photo.jpg')
    expect(photo.previewUrl.value).toBe('http://example.com/photo.jpg')
    expect(photo.pendingBlob.value).toBeNull()
  })

  it('loadExisting handles null url', async () => {
    const mod = await getMod()
    const photo = mod.usePhoto()

    photo.loadExisting(null)

    expect(photo.currentUrl.value).toBeNull()
    expect(photo.previewUrl.value).toBeNull()
  })

  it('uploadPhoto uploads to supabase storage', async () => {
    mockUpload.mockResolvedValue({ error: null })
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'http://example.com/photo.jpg' } })

    const file = new File(['fake-image'], 'test.jpg', { type: 'image/jpeg' })
    const mod = await getMod()
    const photo = mod.usePhoto()

    await photo.selectPhoto(file)
    const url = await photo.uploadPhoto('whisky-1')

    expect(mockStorageFrom).toHaveBeenCalledWith('whisky-photos')
    expect(mockUpload).toHaveBeenCalled()
    expect(url).toContain('http://example.com/photo.jpg')
  })

  it('uploadPhoto returns existing url when no pending blob', async () => {
    const mod = await getMod()
    const photo = mod.usePhoto()
    photo.loadExisting('http://example.com/existing.jpg')

    const url = await photo.uploadPhoto('whisky-1')

    expect(url).toBe('http://example.com/existing.jpg')
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('deletePhoto removes from storage', async () => {
    const mod = await getMod()
    const photo = mod.usePhoto()

    await photo.deletePhoto('whisky-1', 'u1', 'http://example.com/photo.jpg')

    expect(mockStorageFrom).toHaveBeenCalledWith('whisky-photos')
    expect(mockRemove).toHaveBeenCalled()
  })
})

describe('usePhoto storage paths', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { currentUser } = await import('../composables/useAuth.js')
    currentUser.value = { id: 'u1', email: 'test@test.com' }
  })

  it('uploads to an unguessable path (random suffix, never upsert)', async () => {
    mockUpload.mockResolvedValue({ error: null })
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'http://x/storage/v1/object/public/whisky-photos/u1/a.webp' } })
    const mod = await import('../composables/usePhoto.js')
    const a = mod.usePhoto(); const b = mod.usePhoto()
    await a.selectPhoto(new File(['x'], 'a.jpg', { type: 'image/jpeg' }))
    await b.selectPhoto(new File(['x'], 'a.jpg', { type: 'image/jpeg' }))
    await a.uploadPhoto(1700000000000)
    await b.uploadPhoto(1700000000000)
    const [p1, , o1] = mockUpload.mock.calls[0]
    const p2 = mockUpload.mock.calls[1][0]
    expect(p1).toMatch(/^u1\/1700000000000-[0-9a-f-]{16,}\.(jpg|webp)$/)
    expect(p1).not.toBe(p2)
    expect(o1.upsert).toBe(false)
  })

  it('removes the previous object when a photo is replaced', async () => {
    mockUpload.mockResolvedValue({ error: null })
    mockRemove.mockResolvedValue({ error: null })
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'http://x/storage/v1/object/public/whisky-photos/u1/new.webp' } })
    const mod = await import('../composables/usePhoto.js')
    const photo = mod.usePhoto()
    photo.loadExisting('http://x/storage/v1/object/public/whisky-photos/u1/old-123.jpg?t=1')
    await photo.selectPhoto(new File(['x'], 'a.jpg', { type: 'image/jpeg' }))
    await photo.uploadPhoto(5)
    expect(mockRemove).toHaveBeenCalledWith(['u1/old-123.jpg'])
  })

  it('deletePhoto derives the path from the URL (new layout) or falls back (legacy)', async () => {
    mockRemove.mockResolvedValue({ error: null })
    const mod = await import('../composables/usePhoto.js')
    const photo = mod.usePhoto()
    await photo.deletePhoto(9, 'u1', 'http://x/storage/v1/object/public/whisky-photos/u1/9-abc.webp?t=2')
    expect(mockRemove).toHaveBeenLastCalledWith(['u1/9-abc.webp'])
    await photo.deletePhoto(9, 'u1', 'http://example.com/photo.png')
    expect(mockRemove).toHaveBeenLastCalledWith(['u1/9.png'])
    expect(mod.storagePathFromUrl('https://evil.test/x.jpg')).toBeNull()
  })
})
