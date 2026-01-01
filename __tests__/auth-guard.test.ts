import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

const mockSession = {
  session: {
    id: 'session-id',
    userId: 'user-id',
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: new Date(Date.now() + 86400000),
    token: 'test-token',
  },
  user: {
    id: 'user-id',
    email: 'test@example.com',
    name: 'Test User',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    image: null,
  },
}

describe('auth-guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.mocked(headers).mockResolvedValue(new Headers())
  })

  describe('verifySession', () => {
    test('未認証の場合、/auth へリダイレクト（デフォルト callbackUrl=/dashboard）', async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null)

      const { verifySession } = await import('@/app/lib/auth-guard')
      await verifySession()

      expect(redirect).toHaveBeenCalledWith('/auth?callbackUrl=%2Fdashboard')
    })

    test('未認証の場合、カスタム returnTo を callbackUrl に設定', async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null)

      const { verifySession } = await import('@/app/lib/auth-guard')
      await verifySession({ returnTo: '/settings/profile' })

      expect(redirect).toHaveBeenCalledWith(
        '/auth?callbackUrl=%2Fsettings%2Fprofile',
      )
    })

    test('認証済みの場合、セッションを返す', async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession)

      const { verifySession } = await import('@/app/lib/auth-guard')
      const result = await verifySession()

      expect(redirect).not.toHaveBeenCalled()
      expect(result).toEqual(mockSession)
    })
  })

  describe('getSession', () => {
    test('未認証の場合、null を返す（リダイレクトなし）', async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null)

      const { getSession } = await import('@/app/lib/auth-guard')
      const result = await getSession()

      expect(redirect).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })

    test('認証済みの場合、セッションを返す', async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession)

      const { getSession } = await import('@/app/lib/auth-guard')
      const result = await getSession()

      expect(result).toEqual(mockSession)
    })
  })
})
