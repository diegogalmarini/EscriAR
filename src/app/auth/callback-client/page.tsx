"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { toast } from "sonner";

function CallbackClientContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get('redirectTo') || '/dashboard';

    useEffect(() => {
        const handleAuthCallback = async () => {
            try {
                const supabase = createBrowserClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                );

                // Check for PKCE code flow (code in query params)
                const code = searchParams.get('code');
                if (code) {
                    console.log('[CLIENT CALLBACK] PKCE code detected, exchanging...');
                    const { error } = await supabase.auth.exchangeCodeForSession(code);
                    if (error) {
                        console.error('[CLIENT CALLBACK] Code exchange error:', error.message);
                        toast.error(error.message);
                        router.push('/login?error=' + encodeURIComponent(error.message));
                        return;
                    }
                    console.log('[CLIENT CALLBACK] Code exchange successful');
                    toast.success("Sesión iniciada correctamente");
                    window.location.href = redirectTo;
                    return;
                }

                // Check for implicit flow (tokens in hash)
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                const accessToken = hashParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token');
                const error = hashParams.get('error');
                const errorDescription = hashParams.get('error_description');

                if (error) {
                    console.error('[CLIENT CALLBACK] OAuth error:', error, errorDescription);
                    toast.error(errorDescription || error);
                    router.push('/login');
                    return;
                }

                if (accessToken && refreshToken) {
                    console.log('[CLIENT CALLBACK] Implicit flow tokens detected...');
                    const { error: sessionError } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    });
                    if (sessionError) {
                        console.error('[CLIENT CALLBACK] Session error:', sessionError);
                        toast.error(sessionError.message);
                        router.push('/login');
                        return;
                    }
                    console.log('[CLIENT CALLBACK] Session established successfully');
                    toast.success("Sesión iniciada correctamente");
                    window.location.href = redirectTo;
                    return;
                }

                // No code and no tokens — invalid callback
                console.error('[CLIENT CALLBACK] No code or tokens found');
                router.push('/login?error=invalid_callback');
            } catch (err: any) {
                console.error('[CLIENT CALLBACK] Error:', err);
                toast.error(err.message || "Error en la autenticación");
                router.push('/login');
            }
        };

        handleAuthCallback();
    }, [router, redirectTo, searchParams]);

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
                <p className="mt-4 text-gray-600">Procesando autenticación...</p>
            </div>
        </div>
    );
}

export default function CallbackClientPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Cargando...</p>
                </div>
            </div>
        }>
            <CallbackClientContent />
        </Suspense>
    );
}
