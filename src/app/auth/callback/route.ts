import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabaseServer'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    // if "next" or "redirectTo" is in param, use it as the redirect URL
    const next = searchParams.get('redirectTo') ?? searchParams.get('next') ?? '/dashboard'

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        
        if (!error) {
            console.log('[CALLBACK SERVER] Session exchanged flawlessly. Redirecting...', next)
            const forwardedHost = request.headers.get('x-forwarded-host') 
            const isLocalEnv = process.env.NODE_ENV === 'development'
            
            if (isLocalEnv) {
                // local environment, no load balancers
                return NextResponse.redirect(`${origin}${next}`)
            } else if (forwardedHost) {
                // production with Vercel load balancer causing origin issues
                return NextResponse.redirect(`https://${forwardedHost}${next}`)
            } else {
                return NextResponse.redirect(`${origin}${next}`)
            }
        } else {
            console.error('[CALLBACK SERVER] Code exchange error:', error)
            return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
        }
    }

    console.error('[CALLBACK SERVER] No "code" parameter found in URL')
    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/login?error=invalid_auth_callback`)
}
