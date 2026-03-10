/**
 * DEV ONLY - Bypass Auth Endpoint
 * Permite testing local sin OAuth
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

export async function POST(req: Request) {
    if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json({ error: 'Prohibido en producción' }, { status: 403 });
    }
    try {
        const { email, action } = await req.json();
        const userEmail = email || 'test@escriar.dev';

        if (action === 'generate_session') {
            // Generar magic link y extraer tokens
            const { data, error } = await supabase.auth.admin.generateLink({
                type: 'magiclink',
                email: userEmail,
                options: {
                    redirectTo: 'http://localhost:3000/dashboard'
                }
            });

            if (error) {
                return NextResponse.json({
                    error: 'No se pudo generar sesión',
                    details: error.message
                }, { status: 500 });
            }

            // Extraer tokens de la respuesta
            const { properties } = data;
            const props = properties as any;

            return NextResponse.json({
                success: true,
                access_token: props.access_token,
                refresh_token: props.refresh_token,
                message: 'Tokens generados. Usar setSession() en console'
            });
        }

        // Fallback: crear usuario si no existe
        const { data: existingUser } = await supabase.auth.admin.listUsers();
        const user = existingUser?.users?.find(u => u.email === userEmail);

        if (user) {
            return NextResponse.json({
                success: true,
                user,
                message: 'Usuario existe. Usa action: generate_session para login'
            });
        }

        // Crear usuario nuevo
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: userEmail,
            password: 'test1234',
            email_confirm: true
        });

        if (createError) {
            return NextResponse.json({
                error: createError.message
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            user: newUser,
            message: 'Usuario creado. Ahora llama con action: generate_session'
        });

    } catch (error: any) {
        return NextResponse.json({
            error: error.message
        }, { status: 500 });
    }
}
