"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
    Loader2,
    MapPin,
    Calendar,
    Hash,
    ShieldAlert,
    ShieldCheck,
    Clock,
    CheckCircle2,
    AlertTriangle,
    FileSignature,
    Send,
    Hourglass,
} from "lucide-react";

// --- Types ---
interface CarpetaHeroProps {
    carpeta: any;
}

// --- Estado Operativo → Badge Config ---
const ESTADO_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    PROCESANDO: {
        label: "Procesando",
        color: "bg-amber-100 text-amber-800 border-amber-300",
        icon: Loader2,
    },
    COMPLETADO: {
        label: "Procesando",
        color: "bg-amber-100 text-amber-800 border-amber-300",
        icon: Loader2,
    },
    ABIERTA: {
        label: "Pre-escriturario",
        color: "bg-orange-100 text-orange-800 border-orange-300",
        icon: AlertTriangle,
    },
    LISTA_PARA_FIRMAR: {
        label: "Lista para firmar",
        color: "bg-blue-100 text-blue-800 border-blue-300",
        icon: FileSignature,
    },
    FIRMADA: {
        label: "En Registro",
        color: "bg-violet-100 text-violet-800 border-violet-300",
        icon: Send,
    },
    INSCRIPTA: {
        label: "Finalizada",
        color: "bg-emerald-100 text-emerald-800 border-emerald-300",
        icon: CheckCircle2,
    },
};

// --- Mock vencimientos (estructura para cuando el módulo de certificados esté listo) ---
const MOCK_VENCIMIENTOS = [
    { label: "Cert. de Dominio", status: "warning" as const, text: "Vence en 5 días" },
    { label: "Cert. Catastral", status: "ok" as const, text: "Vigente" },
    { label: "Cert. de Inhibición", status: "danger" as const, text: "Vencido" },
];

const VENCIMIENTO_STYLES = {
    ok: { icon: ShieldCheck, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
    warning: { icon: Clock, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
    danger: { icon: ShieldAlert, color: "text-red-600", bg: "bg-red-50 border-red-200" },
};

// --- Helper: Generar carátula dinámica ---
function generarCaratula(carpeta: any): { titulo: string; subtipo: string | null } {
    const escritura = carpeta.escrituras?.[0];
    const operacion = escritura?.operaciones?.[0];

    if (!operacion?.tipo_acto) {
        if (carpeta.ingesta_estado === "PROCESANDO") {
            return { titulo: "Procesando operación...", subtipo: null };
        }
        return { titulo: carpeta.caratula || "Nueva Carpeta", subtipo: null };
    }

    const participantes = operacion.participantes_operacion || [];

    // Buscar vendedor/transmitente
    const vendedor = participantes.find(
        (p: any) =>
            p.rol?.toUpperCase().includes("VENDEDOR") ||
            p.rol?.toUpperCase().includes("TRANSMITENTE") ||
            p.rol?.toUpperCase().includes("CEDENTE") ||
            p.rol?.toUpperCase().includes("DONANTE")
    );

    // Buscar comprador/adquirente
    const comprador = participantes.find(
        (p: any) =>
            p.rol?.toUpperCase().includes("COMPRADOR") ||
            p.rol?.toUpperCase().includes("ADQUIRENTE") ||
            p.rol?.toUpperCase().includes("CESIONARIO") ||
            p.rol?.toUpperCase().includes("DONATARIO")
    );

    const apellidoVendedor = vendedor?.persona?.nombre_completo?.split(" ").pop() || null;
    const apellidoComprador = comprador?.persona?.nombre_completo?.split(" ").pop() || null;

    // Tipo de acto simplificado (tomar las primeras 2-3 palabras clave)
    const tipoActo = operacion.tipo_acto.toUpperCase();

    let titulo: string;
    if (apellidoVendedor && apellidoComprador) {
        titulo = `${apellidoVendedor} a ${apellidoComprador}`;
    } else if (apellidoVendedor) {
        titulo = apellidoVendedor;
    } else {
        titulo = carpeta.caratula?.replace(".pdf", "") || "Operación";
    }

    return { titulo, subtipo: tipoActo };
}

// --- Formatear fecha ---
function formatDate(dateStr: string): string {
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch {
        return "—";
    }
}

// --- Component ---
export default function CarpetaHero({ carpeta }: CarpetaHeroProps) {
    const { titulo, subtipo } = useMemo(() => generarCaratula(carpeta), [carpeta]);

    // Estado operativo — mapear ingesta + estado de carpeta
    const estadoKey = useMemo(() => {
        if (carpeta.ingesta_estado === "PROCESANDO") return "PROCESANDO";
        if (carpeta.estado === "INSCRIPTA") return "INSCRIPTA";
        if (carpeta.estado === "FIRMADA") return "FIRMADA";
        if (carpeta.estado === "LISTA_PARA_FIRMAR") return "LISTA_PARA_FIRMAR";
        return "ABIERTA";
    }, [carpeta.ingesta_estado, carpeta.estado]);

    const estadoCfg = ESTADO_CONFIG[estadoKey] || ESTADO_CONFIG.ABIERTA;
    const EstadoIcon = estadoCfg.icon;

    // Ubicación del inmueble
    const inmueble = carpeta.escrituras?.[0]?.inmuebles;
    const ubicacion = useMemo(() => {
        if (!inmueble) return null;
        const parts: string[] = [];
        if (inmueble.partido_id) parts.push(inmueble.partido_id);
        if (inmueble.nro_partida) parts.push(`Partida ${inmueble.nro_partida}`);
        return parts.length > 0 ? parts.join(" · ") : null;
    }, [inmueble]);

    const isProcessing = estadoKey === "PROCESANDO";

    return (
        <div className="space-y-4">
            {/* === ROW 1: Title + Badge === */}
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2 min-w-0 flex-1">
                    {/* Subtipo (tipo de acto) */}
                    {subtipo && (
                        <p className="text-sm font-semibold tracking-wide text-slate-500 uppercase truncate">
                            {subtipo}
                        </p>
                    )}

                    {/* Título principal */}
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
                        {isProcessing ? (
                            <span className="flex items-center gap-3 text-amber-700">
                                <Loader2 className="h-8 w-8 animate-spin" />
                                Procesando operación...
                            </span>
                        ) : (
                            titulo
                        )}
                    </h1>

                    {/* Metadatos de contexto */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                            <Hash className="h-3.5 w-3.5" />
                            Carpeta #{carpeta.nro_carpeta_interna}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(carpeta.created_at)}
                        </span>
                        {ubicacion && (
                            <span className="flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5" />
                                {ubicacion}
                            </span>
                        )}
                    </div>
                </div>

                {/* Badge de estado */}
                <Badge
                    className={`${estadoCfg.color} border text-sm px-3 py-1.5 gap-1.5 shrink-0 mt-1`}
                >
                    <EstadoIcon className={`h-4 w-4 ${isProcessing ? "animate-spin" : ""}`} />
                    {estadoCfg.label}
                </Badge>
            </div>

            {/* === ROW 2: Panel de Vencimientos Críticos === */}
            <Card className="border-slate-200 bg-slate-50/60 shadow-none">
                <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                        <Hourglass className="h-4 w-4 text-slate-500" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Vencimientos Críticos
                        </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {MOCK_VENCIMIENTOS.map((v) => {
                            const style = VENCIMIENTO_STYLES[v.status];
                            const VIcon = style.icon;
                            return (
                                <div
                                    key={v.label}
                                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${style.bg}`}
                                >
                                    <VIcon className={`h-4 w-4 shrink-0 ${style.color}`} />
                                    <div className="min-w-0">
                                        <p className="text-xs font-medium text-slate-700 truncate">{v.label}</p>
                                        <p className={`text-xs font-semibold ${style.color}`}>{v.text}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
