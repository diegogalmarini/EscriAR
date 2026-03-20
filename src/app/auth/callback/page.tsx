"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Suspense } from "react";

function CallbackHandler() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const handled = useRef(false);

    useEffect(() => {
        if (handled.current) return;
        handled.current = true;

        const redirectTo = searchParams.get("redirectTo") ?? searchParams.get("next") ?? "/dashboard";
        const code = searchParams.get("code");

        if (!code) {
            console.error("[AUTH CALLBACK] No code parameter found");
            router.replace("/login?error=no_code");
            return;
        }

        async function handleCallback() {
            // Check if session already exists (auto-detection may have exchanged the code)
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                console.log("[AUTH CALLBACK] Session already exists, redirecting to:", redirectTo);
                window.location.href = redirectTo;
                return;
            }

            // Exchange the code for a session — browser client has direct access
            // to the PKCE code verifier cookie via document.cookie
            const { error } = await supabase.auth.exchangeCodeForSession(code!);
            if (error) {
                console.error("[AUTH CALLBACK] Code exchange error:", error.message);
                router.replace(`/login?error=${encodeURIComponent(error.message)}`);
            } else {
                console.log("[AUTH CALLBACK] Success, redirecting to:", redirectTo);
                window.location.href = redirectTo;
            }
        }

        handleCallback();
    }, [router, searchParams]);

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto" />
                <p className="mt-4 text-gray-600">Autenticando...</p>
            </div>
        </div>
    );
}

export default function AuthCallbackPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto" />
                        <p className="mt-4 text-gray-600">Cargando...</p>
                    </div>
                </div>
            }
        >
            <CallbackHandler />
        </Suspense>
    );
}
