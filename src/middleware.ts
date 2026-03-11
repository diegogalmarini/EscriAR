import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Super admin emails: configurable via env var (comma-separated), fallback hardcoded
const SUPER_ADMIN_EMAILS = process.env.SUPER_ADMIN_EMAILS
    ? process.env.SUPER_ADMIN_EMAILS.split(',').map(e => e.trim())
    : ['diegogalmarini@gmail.com'];

const PUBLIC_ROUTES = [
    '/',
    '/login',
    '/signup',
    '/auth/callback',
    '/auth/callback-client',
    '/api/ingest',
    '/api/auth-diag',
    '/pending-approval',
    '/unauthorized',
    '/privacy',
    '/terms',
];

const PUBLIC_ROUTE_PATTERNS = [
    /^\/ficha\/.+$/,
];

export async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    const isPublicRoute = PUBLIC_ROUTES.includes(pathname) ||
        PUBLIC_ROUTE_PATTERNS.some(pattern => pattern.test(pathname));

    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    let user = null;
    try {
        const { data, error } = await supabase.auth.getUser()
        if (error) {
            console.error("[middleware] getUser error:", error.message);
        }
        user = data?.user;
    } catch (err) {
        console.error("[middleware] getUser exception:", err);
    }

    if (user && pathname === '/login') {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    if (!user && !isPublicRoute) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        if (pathname !== '/dashboard') {
            url.searchParams.set('redirectTo', pathname)
        }

        const redirectResponse = NextResponse.redirect(url)

        // Propagate cookies to the redirect response
        supabaseResponse.cookies.getAll().forEach(c => {
            redirectResponse.cookies.set(c.name, c.value, c);
        });

        return redirectResponse
    }

    return supabaseResponse
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
