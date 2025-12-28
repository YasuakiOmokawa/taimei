import { redirect } from 'next/navigation'
import { getSession } from '@/app/lib/auth-guard'
import LandingPage from '@/app/ui/landing-page'

export default async function RootPage() {
  const session = await getSession()

  if (session) {
    redirect('/dashboard')
  }

  return <LandingPage />
}
