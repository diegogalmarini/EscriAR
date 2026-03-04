"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getSignedUrl } from "@/app/actions/storageSync";
import { CrossCheckService, ValidationState } from "@/lib/agent/CrossCheckService";

/**
 * useCarpetaState — Fuente de verdad única para el estado de la carpeta.
 *
 * Centraliza:
 * - Estado local de la carpeta (sincronizado con initialData del server)
 * - Suscripción Realtime (debounced router.refresh)
 * - activeDeedId / currentEscritura derivados
 * - CrossCheck engine
 * - resolveDocumentUrl helper
 * - refreshCarpeta() controlado (nunca location.reload)
 */
export function useCarpetaState(initialData: any) {
    const [carpeta, setCarpeta] = useState(initialData);
    const router = useRouter();

    // Sync local state when server re-fetches (after router.refresh())
    useEffect(() => {
        setCarpeta(initialData);
    }, [initialData]);

    // --- REFRESH CONTROLADO ---
    const refreshCarpeta = useCallback(() => {
        router.refresh();
    }, [router]);

    // --- REALTIME SUBSCRIPTION ---
    useEffect(() => {
        let refreshTimeout: NodeJS.Timeout;
        const debouncedRefresh = () => {
            clearTimeout(refreshTimeout);
            refreshTimeout = setTimeout(() => {
                router.refresh();
            }, 500);
        };

        const channel = supabase
            .channel(`folder-updates-${carpeta.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'carpetas',
                    filter: `id=eq.${carpeta.id}`
                },
                (payload: any) => {
                    const newData = payload.new as any;
                    setCarpeta((prev: any) => ({ ...prev, ...newData }));

                    if (newData.ingesta_estado === 'COMPLETADO' || newData.ingesta_estado === 'ERROR') {
                        debouncedRefresh();
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'escrituras',
                    filter: `carpeta_id=eq.${carpeta.id}`
                },
                debouncedRefresh
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'participantes_operacion'
                },
                debouncedRefresh
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'inmuebles'
                },
                debouncedRefresh
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            clearTimeout(refreshTimeout);
        };
    }, [carpeta.id, router]);

    // --- ACTIVE DEED ---
    const [activeDeedId, setActiveDeedId] = useState<string | null>(
        carpeta.escrituras?.[0]?.id || null
    );

    const currentEscritura = useMemo(
        () => carpeta.escrituras?.find((e: any) => e.id === activeDeedId) ?? null,
        [carpeta.escrituras, activeDeedId]
    );

    // --- CROSS-CHECK ENGINE ---
    const crossCheckResult = useMemo(() => {
        if (!currentEscritura) return undefined;

        const entities = currentEscritura.analysis_metadata?.entities || [];
        const participants = currentEscritura.operaciones?.flatMap(
            (op: any) => op.participantes_operacion || []
        ) || [];

        const fieldsToValidate: Record<string, any> = {};

        participants.forEach((p: any, idx: number) => {
            const person = p.persona || p.personas;
            const personId = person?.id || `temp_${idx}`;

            const extracted = entities.find(
                (e: any) =>
                    e.datos?.dni_cuil_cuit?.valor === person?.dni ||
                    e.datos?.nombre_completo?.valor === person?.nombre_completo
            );

            const officialMock = person?.metadata?.official_data || {
                nombre_completo: person?.nombre_completo || extracted?.datos?.nombre_completo?.valor,
                cuit: person?.cuit,
            };

            fieldsToValidate[`nombre_${personId}`] = {
                official: officialMock.nombre_completo,
                extracted: extracted?.datos?.nombre_completo?.valor,
                manual: person?.nombre_completo,
            };
            fieldsToValidate[`cuit_${personId}`] = {
                official: officialMock.cuit,
                extracted: extracted?.datos?.dni_cuil_cuit?.valor,
                manual: person?.cuit,
            };
        });

        return CrossCheckService.validateIdentity(fieldsToValidate);
    }, [currentEscritura]);

    const isBlockedBySecurity = crossCheckResult?.state === ValidationState.CRITICAL_DISCREPANCY;

    // --- RESOLVE DOCUMENT URL ---
    const resolveDocumentUrl = useCallback(async (pdfUrl: string): Promise<string | null> => {
        let storagePath = pdfUrl;
        const publicPrefix = '/storage/v1/object/public/escrituras/';
        const idx = pdfUrl.indexOf(publicPrefix);
        if (idx !== -1) {
            storagePath = pdfUrl.substring(idx + publicPrefix.length);
        }
        const result = await getSignedUrl('escrituras', storagePath);
        if (result.success && result.url) return result.url;
        return null;
    }, []);

    return {
        carpeta,
        setCarpeta,
        refreshCarpeta,
        activeDeedId,
        setActiveDeedId,
        currentEscritura,
        crossCheckResult,
        isBlockedBySecurity,
        resolveDocumentUrl,
        router,
    };
}
