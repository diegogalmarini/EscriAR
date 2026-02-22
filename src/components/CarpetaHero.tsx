"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
    Loader2,
    MapPin,
    Calendar,
    Hash,
    ShieldAlert,
    ShieldCheck,
    Clock,
    Hourglass,
} from "lucide-react";

// --- Types ---
interface CarpetaHeroProps {
    carpeta: any;
}

// --- Estado Operativo → dot color + label ---
const ESTADO_CONFIG: Record<string, { label: string; dot: string }> = {
    PROCESANDO: { label: "Procesando", dot: "bg-amber-500" },
    ABIERTA: { label: "Pre-escriturario", dot: "bg-slate-400" },
    LISTA_PARA_FIRMAR: { label: "Lista para firmar", dot: "bg-blue-500" },
    FIRMADA: { label: "En Registro", dot: "bg-violet-500" },
    INSCRIPTA: { label: "Finalizada", dot: "bg-emerald-500" },
};

// --- Mock vencimientos ---
const MOCK_VENCIMIENTOS = [
    { label: "Cert. de Dominio", status: "warning" as const, text: "Vence en 5 días" },
    { label: "Cert. Catastral", status: "ok" as const, text: "Vigente" },
    { label: "Cert. de Inhibición", status: "danger" as const, text: "Vencido" },
];

const VENCIMIENTO_ICON = {
    ok: { icon: ShieldCheck, color: "text-muted-foreground" },
    warning: { icon: Clock, color: "text-amber-600" },
    danger: { icon: ShieldAlert, color: "text-red-500" },
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

    const participantes = operacion?.participantes_operacion || [];

    const vendedor = participantes.find(
        (p: any) =>
            p.rol?.toUpperCase().includes("VENDEDOR") ||
            p.rol?.toUpperCase().includes("TRANSMITENTE") ||
            p.rol?.toUpperCase().includes("CEDENTE") ||
            p.rol?.toUpperCase().includes("DONANTE")
    );

    const comprador = participantes.find(
        (p: any) =>
            p.rol?.toUpperCase().includes("COMPRADOR") ||
            p.rol?.toUpperCase().includes("ADQUIRENTE") ||
            p.rol?.toUpperCase().includes("CESIONARIO") ||
            p.rol?.toUpperCase().includes("DONATARIO")
    );

    const apellidoVendedor = vendedor?.persona?.nombre_completo?.split(" ").pop() || null;
    const apellidoComprador = comprador?.persona?.nombre_completo?.split(" ").pop() || null;

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

    const estadoKey = useMemo(() => {
        if (carpeta.ingesta_estado === "PROCESANDO") return "PROCESANDO";
        if (carpeta.estado === "INSCRIPTA") return "INSCRIPTA";
        if (carpeta.estado === "FIRMADA") return "FIRMADA";
        if (carpeta.estado === "LISTA_PARA_FIRMAR") return "LISTA_PARA_FIRMAR";
        return "ABIERTA";
    }, [carpeta.ingesta_estado, carpeta.estado]);

    const estadoCfg = ESTADO_CONFIG[estadoKey] || ESTADO_CONFIG.ABIERTA;
    const isProcessing = estadoKey === "PROCESANDO";

    const inmueble = carpeta.escrituras?.[0]?.inmuebles;
    const ubicacion = useMemo(() => {
        if (!inmueble) return null;
        const parts: string[] = [];
        if (inmueble.partido_id) parts.push(inmueble.partido_id);
        if (inmueble.nro_partida) parts.push(`Partida ${inmueble.nro_partida}`);
        return parts.length > 0 ? parts.join(" · ") : null;
    }, [inmueble]);

    return (
        <div className="space-y-4">
            {/* === Title + Status === */}
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1.5 min-w-0 flex-1">
                    {subtipo && (
                        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                            {subtipo}
                        </p>
                    )}

                    <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground leading-tight">
                        {isProcessing ? (
                            <span className="flex items-center gap-2.5 text-muted-foreground">
                                <Loader2 className="h-6 w-6 animate-spin" />
                                Procesando operación...
                            </span>
                        ) : (
                            titulo
                        )}
                    </h1>

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

                {/* Badge: outline + dot */}
                <Badge variant="outline" className="text-sm px-3 py-1.5 gap-2 shrink-0 text-muted-foreground">
                    {isProcessing ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                        <span className={`h-2 w-2 rounded-full ${estadoCfg.dot}`} />
                    )}
                    {estadoCfg.label}
                </Badge>
            </div>

            {/* === Vencimientos === */}
            <div className="border border-border rounded-lg bg-background p-3">
                <div className="flex items-center gap-2 mb-2.5">
                    <Hourglass className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Vencimientos
                    </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {MOCK_VENCIMIENTOS.map((v) => {
                        const cfg = VENCIMIENTO_ICON[v.status];
                        const VIcon = cfg.icon;
                        return (
                            <div
                                key={v.label}
                                className="flex items-center gap-2.5 rounded-md border border-border bg-background px-3 py-2"
                            >
                                <VIcon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
                                <div className="min-w-0">
                                    <p className="text-xs text-muted-foreground truncate">{v.label}</p>
                                    <p className={`text-xs font-medium ${v.status === "ok" ? "text-foreground" : cfg.color}`}>
                                        {v.text}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
