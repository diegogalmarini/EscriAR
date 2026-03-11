'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

function AuthCallbackContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    useEffect(() => {
        const handleCallback = async () => {
            const code = searchParams.get('code')
            const error = searchParams.get('error')
            const errorDescription = searchParams.get('error_description')
            const redirectTo = searchParams.get('redirectTo') || '/dashboard'

            // Handle errors from OAuth provider
            if (error) {
                console.error('[CALLBACK CLIENT] OAuth error:', error, errorDescription)
                router.push(`/login?error=${encodeURIComponent(errorDescription || error)}`)
                return
            }

            // Exchange code for session (client-side - fixes SameSite cookie issue)
            if (code) {
                try {
                    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

                    if (exchangeError) {
                        console.error('[CALLBACK CLIENT] Exchange error:', exchangeError)
                        router.push(`/login?error=${encodeURIComponent(exchangeError.message)}`)
                        return
                    }

                    if (data.session) {
                        console.log('[CALLBACK CLIENT] Session established for:', data.session.user.email)

                        // Aumentamos el delay y usamos window.location.href (hard reload)
                        // para asegurar que las cookies Auth viajen 100% al middleware.
                        setTimeout(() => {
                            window.location.href = redirectTo
                        }, 500)
                    } else {
                        console.error('[CALLBACK CLIENT] No session returned')
                        router.push('/login?error=no_session')
                    }
                } catch (err: any) {
                    console.error('[CALLBACK CLIENT] Exception:', err)
                    router.push(`/login?error=${encodeURIComponent(err.message)}`)
                }
            } else {
                // No code parameter - shouldn't happen
                console.error('[CALLBACK CLIENT] No code parameter')
                router.push('/login?error=missing_code')
            }
        }

        handleCallback()
    }, [searchParams, router])

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4"></div>
                <p className="text-slate-600">Autenticando...</p>
            </div>
        </div>
    )
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4"></div>
                    <p className="text-slate-600">Cargando...</p>
                </div>
            </div>
        }>
            <AuthCallbackContent />
        </Suspense>
    )
}
