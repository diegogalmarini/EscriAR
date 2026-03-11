import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('redirectTo') ?? searchParams.get('next') ?? '/dashboard'

    // Determine redirect base URL (handle Vercel load balancer)
    const forwardedHost = request.headers.get('x-forwarded-host')
    const isLocalEnv = process.env.NODE_ENV === 'development'
    let redirectBase: string
    if (isLocalEnv) {
        redirectBase = origin
    } else if (forwardedHost) {
        redirectBase = `https://${forwardedHost}`
    } else {
        redirectBase = origin
    }

    if (!code) {
        console.error('[AUTH CALLBACK] No code parameter found')
        return NextResponse.redirect(`${redirectBase}/login?error=no_code`)
    }

    const cookieStore = await cookies()

    // Collect cookies to explicitly set on the redirect response
    // (cookieStore.set() does NOT transfer to NextResponse.redirect())
    const pendingCookies: { name: string; value: string; options: Record<string, unknown> }[] = []

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach((cookie) => {
                        pendingCookies.push(cookie)
                    })
                },
            },
        }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
        console.error('[AUTH CALLBACK] Code exchange error:', error.message)
        return NextResponse.redirect(`${redirectBase}/login?error=${encodeURIComponent(error.message)}`)
    }

    // Create redirect and EXPLICITLY set all auth cookies on the response
    const redirectUrl = `${redirectBase}${next}`
    console.log('[AUTH CALLBACK] Session exchanged OK. Redirecting to:', redirectUrl, '| Cookies:', pendingCookies.length)

    const response = NextResponse.redirect(redirectUrl)
    pendingCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options as any)
    })

    return response
}
