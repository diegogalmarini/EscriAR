"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Loader2,
    MapPin,
    Calendar,
    Hash,
    Hourglass,
    Trash2,
} from "lucide-react";

// --- Types ---
interface CarpetaHeroProps {
    carpeta: any;
    onDelete?: () => void;
    isDeleting?: boolean;
    children?: React.ReactNode;
}

// --- Estado Operativo → dot color + label ---
const ESTADO_CONFIG: Record<string, { label: string; dot: string }> = {
    PROCESANDO: { label: "Procesando", dot: "bg-amber-500" },
    ABIERTA: { label: "Pre-escriturario", dot: "bg-slate-400" },
    LISTA_PARA_FIRMAR: { label: "Lista para firmar", dot: "bg-blue-500" },
    FIRMADA: { label: "En Registro", dot: "bg-violet-500" },
    INSCRIPTA: { label: "Finalizada", dot: "bg-emerald-500" },
};

// --- Helper: Extraer apellido de nombre_completo ---
function extractApellido(nombreCompleto: string | null | undefined): string | null {
    if (!nombreCompleto?.trim()) return null;
    const trimmed = nombreCompleto.trim();

    // Formato DB estándar: "APELLIDO, Nombre"
    if (trimmed.includes(",")) {
        return trimmed.split(",")[0].trim() || null;
    }

    // Formato alternativo: "Nombre APELLIDO" — buscar palabra en MAYÚSCULAS
    const parts = trimmed.split(/\s+/);
    const upper = parts.filter(
        (p) => p.length > 1 && p === p.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(p)
    );
    if (upper.length > 0) return upper[0];

    // Fallback: última palabra en mayúsculas
    return parts[parts.length - 1]?.toUpperCase() || null;
}

// --- Helper: Generar carátula dinámica ---
function generarCaratula(carpeta: any): { titulo: string; subtipo: string } {
    const escritura = carpeta.escrituras?.[0];
    const operacion = escritura?.operaciones?.[0];

    // Subtítulo: tipo de acto normalizado o placeholder
    const rawActo = operacion?.tipo_acto?.toUpperCase()?.trim() || null;
    const tipoActoRaw = (rawActo === "POR_DEFINIR") ? null : rawActo;
    // Normalizar: extraer solo la palabra clave del acto (quitar "COMPLETA", "SIMPLE", etc.)
    const ACTOS_CONOCIDOS = [
        "COMPRAVENTA", "HIPOTECA", "DONACIÓN", "DONACION", "CESIÓN DE DERECHOS",
        "CESION DE DERECHOS", "PODER ESPECIAL", "PODER GENERAL", "CANCELACIÓN",
        "CANCELACION", "USUFRUCTO", "PERMUTA", "FIDEICOMISO", "AFECTACIÓN",
        "AFECTACION", "DESAFECTACIÓN", "DESAFECTACION",
    ];
    const tipoActo = tipoActoRaw
        ? (ACTOS_CONOCIDOS.find(a => tipoActoRaw.includes(a)) || tipoActoRaw)
        : null;
    const subtipo = tipoActo || "ACTO POR SELECCIONAR";

    // Estado procesando sin datos
    if (carpeta.ingesta_estado === "PROCESANDO" && !tipoActo) {
        return { titulo: "Procesando operación…", subtipo };
    }

    // Buscar partes según lógica de Mesa de Trabajo:
    // - Transmitente = actual propietario (fue COMPRADOR/TITULAR/CESIONARIO/DONATARIO en el antecedente)
    // - Adquirente = nuevo comprador (rol ADQUIRENTE, agregado manualmente)
    const participantes = operacion?.participantes_operacion || [];

    const transmitente = participantes.find((p: any) => {
        const rol = p.rol?.toUpperCase() || "";
        return rol.includes("COMPRADOR") || rol.includes("CESIONARIO") ||
            rol.includes("DONATARIO") || rol.includes("TITULAR");
    });

    const adquirente = participantes.find(
        (p: any) => p.rol?.toUpperCase() === "ADQUIRENTE"
    );

    const apellidoTransmitente = extractApellido(transmitente?.persona?.nombre_completo);
    const apellidoAdquirente = extractApellido(adquirente?.persona?.nombre_completo);

    // Título: perspectiva adquirente con "de"
    let titulo: string;
    if (apellidoAdquirente && apellidoTransmitente) {
        // Ambas partes: "ADQUIRENTE de TRANSMITENTE"
        titulo = `${apellidoAdquirente} de ${apellidoTransmitente}`;
    } else if (apellidoTransmitente) {
        // Solo transmitente: placeholder para adquirente
        titulo = `… de ${apellidoTransmitente}`;
    } else if (apellidoAdquirente) {
        titulo = apellidoAdquirente;
    } else {
        titulo = carpeta.caratula?.replace(".pdf", "") || "Nuevo trámite";
    }

    return { titulo, subtipo };
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
export default function CarpetaHero({ carpeta, onDelete, isDeleting, children }: CarpetaHeroProps) {
    const { titulo, subtipo } = useMemo(() => generarCaratula(carpeta), [carpeta]);

    const estadoKey = useMemo(() => {
        const tieneTipoActo = !!carpeta.escrituras?.[0]?.operaciones?.[0]?.tipo_acto;

        // Solo mantenemos visualmente "Procesando" si no hay datos todavía
        if (carpeta.ingesta_estado === "PROCESANDO" && !tieneTipoActo) return "PROCESANDO";

        if (carpeta.estado === "INSCRIPTA") return "INSCRIPTA";
        if (carpeta.estado === "FIRMADA") return "FIRMADA";
        if (carpeta.estado === "LISTA_PARA_FIRMAR") return "LISTA_PARA_FIRMAR";
        return "ABIERTA";
    }, [carpeta.ingesta_estado, carpeta.estado, carpeta.escrituras]);

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
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm pb-3 pt-6 border-b border-border space-y-4">
            {/* === Title + Status === */}
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1.5 min-w-0 flex-1">
                    <p className={`text-xs font-medium tracking-wider uppercase ${
                        subtipo === "ACTO A DEFINIR"
                            ? "text-muted-foreground/50 italic"
                            : "text-muted-foreground"
                    }`}>
                        {subtipo}
                    </p>

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

                {/* Badge + Delete */}
                <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-sm px-3 py-1.5 gap-2 text-muted-foreground">
                        {isProcessing ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                            <span className={`h-2 w-2 rounded-full ${estadoCfg.dot}`} />
                        )}
                        {estadoCfg.label}
                    </Badge>
                    {onDelete && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Eliminar esta carpeta</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Se borrarán todos los documentos, operaciones y participantes vinculados a este trámite. Esta acción no se puede deshacer.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={onDelete}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        disabled={isDeleting}
                                    >
                                        {isDeleting ? "Eliminando..." : "Eliminar"}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>
            </div>

            {/* === Vencimientos === */}
            <div className="border border-border rounded-lg bg-background p-3">
                <div className="flex items-center gap-2 mb-2.5">
                    <Hourglass className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Vencimientos
                    </span>
                </div>
                <p className="text-xs text-muted-foreground px-1 py-2">
                    Sin certificados cargados en Pre-Escriturario
                </p>
            </div>

            {/* === Tabs navigation === */}
            {children}
        </div>
    );
}
