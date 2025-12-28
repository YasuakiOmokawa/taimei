// クライアントサイドでの誤用を防止（セッション検証はサーバーサイドでのみ安全）
import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

// cache() で同一リクエスト内のDB問い合わせを1回に抑制（layout/page で複数回呼んでも効率的）
export const verifySession = cache(
  async (options?: { returnTo?: string }) => {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session) {
      const callbackUrl = options?.returnTo ?? '/dashboard'
      redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
    }

    return session
  },
)

// verifySession と異なりリダイレクトしない（ルートページ等で認証状態に応じた分岐が必要な場合用）
export const getSession = cache(async () => {
  return await auth.api.getSession({
    headers: await headers(),
  })
})

export type Session = Awaited<ReturnType<typeof getSession>>
export type VerifiedSession = Exclude<Session, null>
