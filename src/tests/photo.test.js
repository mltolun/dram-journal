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
