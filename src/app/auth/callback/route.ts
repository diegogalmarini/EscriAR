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

    console.log('[AUTH CALLBACK] origin:', origin, '| forwardedHost:', forwardedHost, '| redirectBase:', redirectBase, '| code:', code ? 'present' : 'MISSING')

    if (!code) {
        console.error('[AUTH CALLBACK] No code parameter found')
        return NextResponse.redirect(`${redirectBase}/login?error=no_code`)
    }

    const cookieStore = await cookies()

    // Log incoming cookies for diagnosis
    const incomingCookies = cookieStore.getAll()
    console.log('[AUTH CALLBACK] Incoming cookies:', incomingCookies.map(c => c.name).join(', '))

    // Collect cookies to explicitly set on the redirect response
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
                        // Update cookie store for subsequent reads within this request
                        try {
                            cookieStore.set(cookie.name, cookie.value, cookie.options as any)
                        } catch {
                            // May fail in some contexts, that's OK
                        }
                        // Also collect for explicit setting on the redirect response
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
    const cookieNames = pendingCookies.map(c => c.name).join(', ')
    console.log('[AUTH CALLBACK] SUCCESS. Redirecting to:', redirectUrl, '| Setting cookies:', cookieNames, '| Count:', pendingCookies.length)

    const response = NextResponse.redirect(redirectUrl)
    pendingCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options as any)
    })

    return response
}
