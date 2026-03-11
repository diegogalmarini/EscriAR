import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const redirectTo = requestUrl.searchParams.get('redirectTo') || '/dashboard'

    if (code) {
        let response = NextResponse.redirect(`${requestUrl.origin}${redirectTo}`)

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll()
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            request.cookies.set(name, value)
                        })
                        response = NextResponse.redirect(`${requestUrl.origin}${redirectTo}`)
                        cookiesToSet.forEach(({ name, value, options }) => {
                            response.cookies.set(name, value, options)
                        })
                    },
                },
            }
        )

        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
            console.log('[CALLBACK SERVER] Session exchanged flawlessly. Cookie set for route:', redirectTo)
            return response
        } else {
             console.error('[CALLBACK SERVER] Code exchange error:', error.message)
             return NextResponse.redirect(`${requestUrl.origin}/login?error=${encodeURIComponent(error.message)}`)
        }
    }

    console.error('[CALLBACK SERVER] No "code" parameter found in URL')
    return NextResponse.redirect(`${requestUrl.origin}/login?error=invalid_auth_callback`)
}
