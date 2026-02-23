"use client";

import { useEffect, useState, useMemo } from "react";
import { Gravamen, getGravamenesPorCarpeta } from "@/app/actions/gravamenes";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, ShieldAlert, UserX } from "lucide-react";

interface EstudioDominioPanelProps {
    carpetaId: string;
    carpetasDnis?: string[];
}

/**
 * Normaliza un string de DNI para poder comparar:
 * Quita puntos, espacios, guiones, y convierte a string limpio.
 */
function normalizeDni(dni: string | null | undefined): string {
    if (!dni) return "";
    return dni.replace(/[\.\s\-]/g, "").trim().toLowerCase();
}

export function EstudioDominioPanel({ carpetaId, carpetasDnis = [] }: EstudioDominioPanelProps) {
    const [gravamenes, setGravamenes] = useState<Gravamen[]>([]);
    const [loading, setLoading] = useState(true);

    const loadGravamenes = async () => {
        try {
            const data = await getGravamenesPorCarpeta(carpetaId);
            setGravamenes(data);
        } catch (error) {
            console.error("Error loading gravamenes", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadGravamenes();
    }, [carpetaId]);

    // --- Lógica de cruce de inhibiciones con partes ---
    // Buscamos en las observaciones de cada gravamen si contiene un DNI que 
    // coincida con alguno de los participantes de la carpeta.
    const inhibicionesConMatch = useMemo(() => {
        if (carpetasDnis.length === 0) return [];

        const normalizedCarpetaDnis = carpetasDnis.map(normalizeDni).filter(Boolean);

        return gravamenes
            .filter(g => g.tipo === "INHIBICION_GENERAL" && g.estado === "VIGENTE")
            .map(g => {
                // Extraer DNI del campo observaciones (formato: "DNI inhibido: XXXXXXXX")
                const dniMatch = g.observaciones?.match(/DNI inhibido:\s*(\S+)/i);
                const dniInhibido = dniMatch ? normalizeDni(dniMatch[1]) : null;

                // Extraer nombre del campo observaciones
                const nombreMatch = g.observaciones?.match(/Persona inhibida:\s*([^|]+)/i);
                const nombreInhibido = nombreMatch ? nombreMatch[1].trim() : null;

                const isMatchByDni = dniInhibido
                    ? normalizedCarpetaDnis.includes(dniInhibido)
                    : false;

                return {
                    gravamen: g,
                    dniInhibido,
                    nombreInhibido,
                    isMatchByDni,
                };
            })
            .filter(item => item.isMatchByDni);
    }, [gravamenes, carpetasDnis]);

    if (loading) return <div className="p-4 text-sm text-muted-foreground animate-pulse">Cargando estudio de dominio...</div>;

    const hasCriticalRiesgo = gravamenes.some(g => g.estado === "VIGENTE" && g.tipo !== "USUFRUCTO");
    const hasInhibicionMatch = inhibicionesConMatch.length > 0;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Estudio de Dominio e Inhibiciones</h3>

                {hasInhibicionMatch ? (
                    <Badge variant="destructive" className="flex items-center gap-1 animate-pulse">
                        <ShieldAlert className="h-4 w-4" />
                        ⚠ BLOQUEO: Parte Inhibida
                    </Badge>
                ) : hasCriticalRiesgo ? (
                    <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        Dominio Observado
                    </Badge>
                ) : (
                    <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50 flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4" />
                        Libre Disponibilidad
                    </Badge>
                )}
            </div>

            {/* --- ALERTA CRÍTICA: Inhibición cruzada con parte --- */}
            {hasInhibicionMatch && (
                <div className="p-4 bg-red-50 border-2 border-red-400 rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                        <UserX className="h-5 w-5" />
                        ALERTA CRÍTICA: Se detectó inhibición que afecta a una parte de esta operación
                    </div>
                    {inhibicionesConMatch.map(({ gravamen, nombreInhibido, dniInhibido }, idx) => (
                        <div key={idx} className="text-xs text-red-600 bg-red-100/50 p-3 rounded-md space-y-1">
                            <p><span className="font-semibold">Persona:</span> {nombreInhibido || "No identificada"} {dniInhibido ? `(DNI: ${dniInhibido})` : ""}</p>
                            {gravamen.autos && <p><span className="font-semibold">Autos:</span> {gravamen.autos}</p>}
                            {gravamen.juzgado && <p><span className="font-semibold">Juzgado:</span> {gravamen.juzgado}</p>}
                            <p className="font-bold mt-1">⛔ Esta escritura NO puede otorgarse hasta que se levante la inhibición.</p>
                        </div>
                    ))}
                </div>
            )}

            {gravamenes.length === 0 ? (
                <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-md text-center border border-dashed">
                    No se han detectado gravámenes ni inhibiciones registradas extraídas de los certificados vinculados.
                </div>
            ) : (
                <div className="space-y-2">
                    {gravamenes.map((gravamen) => (
                        <div key={gravamen.id} className="p-3 border rounded-md flex justify-between items-start bg-background shadow-sm">
                            <div>
                                <div className="font-medium text-sm flex items-center gap-2">
                                    {gravamen.tipo.replace("_", " ")}
                                    {gravamen.estado === "VIGENTE" ? (
                                        <Badge variant="destructive" className="text-[10px] h-5">Vigente</Badge>
                                    ) : (
                                        <Badge variant="secondary" className="text-[10px] h-5">{gravamen.estado}</Badge>
                                    )}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    {gravamen.autos && <div><span className="font-semibold">Autos:</span> {gravamen.autos}</div>}
                                    {gravamen.juzgado && <div><span className="font-semibold">Juzgado:</span> {gravamen.juzgado}</div>}
                                    {gravamen.monto && <div><span className="font-semibold">Monto:</span> {gravamen.moneda} {gravamen.monto.toLocaleString()}</div>}
                                    {gravamen.observaciones && <div className="mt-1 italic text-muted-foreground/70">{gravamen.observaciones}</div>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
