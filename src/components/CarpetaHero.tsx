"use client";

import { useMemo, useEffect, useState } from "react";
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
    ShieldCheck,
    ShieldAlert,
    ShieldX,
    Clock,
    BookOpen,
} from "lucide-react";
import { Certificado, getCertificadosPorCarpeta } from "@/app/actions/certificados";
import CarpetaInfoPopover from "@/components/CarpetaInfoPopover";
import { publishToProtocolo } from "@/app/actions/protocolo";
import { toast } from "sonner";
import { generarCaratula } from "@/lib/caratula";

// --- Types ---
interface CarpetaHeroProps {
    carpeta: any;
    onDelete?: () => void;
    isDeleting?: boolean;
    onNavigateTab?: (tab: string) => void;
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

function formatDate(dateStr: string): string {
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch {
        return "—";
    }
}

// --- Component ---
export default function CarpetaHero({ carpeta, onDelete, isDeleting, onNavigateTab, children }: CarpetaHeroProps) {
    const { titulo, subtipo } = useMemo(() => generarCaratula(carpeta), [carpeta]);
    const [certificados, setCertificados] = useState<Certificado[]>([]);
    const [isPublishing, setIsPublishing] = useState(false);

    // Fetch certificados para los chips de vencimiento
    useEffect(() => {
        if (carpeta?.id) {
            getCertificadosPorCarpeta(carpeta.id)
                .then(setCertificados)
                .catch(() => setCertificados([]));
        }
    }, [carpeta?.id, carpeta]);

    // Calcular resumen de certificados
    const certResumen = useMemo(() => {
        const now = new Date();
        let vencidos = 0, porVencer = 0, vigentes = 0, pendientes = 0, sinConfirmar = 0;

        for (const c of certificados) {
            if (c.estado === "PENDIENTE" || c.estado === "SOLICITADO") {
                pendientes++;
                continue;
            }
            if (c.estado === "VENCIDO") { vencidos++; continue; }
            if (c.estado === "RECIBIDO" && c.fecha_vencimiento) {
                const days = Math.ceil((new Date(c.fecha_vencimiento).getTime() - now.getTime()) / (1000 * 3600 * 24));
                if (days < 0) vencidos++;
                else if (days <= 3) porVencer++;
                else vigentes++;
            } else if (c.estado === "RECIBIDO") {
                vigentes++;
            }
            if (c.extraction_status === "COMPLETADO" && !c.confirmed_at) sinConfirmar++;
        }

        return { total: certificados.length, vencidos, porVencer, vigentes, pendientes, sinConfirmar };
    }, [certificados]);

    const estadoKey = useMemo(() => {
        const tramite = carpeta.escrituras?.find((e: any) => e.source === 'TRAMITE') || carpeta.escrituras?.[0];
        const tieneTipoActo = !!tramite?.operaciones?.[0]?.tipo_acto;

        // Solo mantenemos visualmente "Procesando" si no hay datos todavía
        if (carpeta.ingesta_estado === "PROCESANDO" && !tieneTipoActo) return "PROCESANDO";

        if (carpeta.estado === "INSCRIPTA") return "INSCRIPTA";
        if (carpeta.estado === "FIRMADA") return "FIRMADA";
        if (carpeta.estado === "LISTA_PARA_FIRMAR") return "LISTA_PARA_FIRMAR";
        return "ABIERTA";
    }, [carpeta.ingesta_estado, carpeta.estado, carpeta.escrituras]);

    const estadoCfg = ESTADO_CONFIG[estadoKey] || ESTADO_CONFIG.ABIERTA;
    const isProcessing = estadoKey === "PROCESANDO";
    const canPublishProtocolo = estadoKey === "FIRMADA" || estadoKey === "INSCRIPTA";

    const handlePublishProtocolo = async () => {
        setIsPublishing(true);
        const res = await publishToProtocolo(carpeta.id);
        setIsPublishing(false);
        if (res.success) {
            toast.success(res.isUpdate ? "Registro de protocolo actualizado" : "Publicado en protocolo");
        } else {
            toast.error(res.error || "Error al publicar en protocolo");
        }
    };

    // Inmueble: preferir TRAMITE, fallback a INGESTA
    const tramiteEsc = carpeta.escrituras?.find((e: any) => e.source === 'TRAMITE');
    const ingestaEsc = carpeta.escrituras?.find((e: any) => e.source === 'INGESTA');
    const inmueble = tramiteEsc?.inmuebles || ingestaEsc?.inmuebles || carpeta.escrituras?.[0]?.inmuebles;
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
                    <p className={`text-xs font-medium tracking-wider uppercase ${subtipo === "ACTO POR SELECCIONAR"
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

                {/* Badge + Info + Delete */}
                <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-sm px-3 py-1.5 gap-2 text-muted-foreground">
                        {isProcessing ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                            <span className={`h-2 w-2 rounded-full ${estadoCfg.dot}`} />
                        )}
                        {estadoCfg.label}
                    </Badge>
                    <CarpetaInfoPopover carpetaId={carpeta.id} createdAt={carpeta.created_at} />
                    {canPublishProtocolo && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            onClick={handlePublishProtocolo}
                            disabled={isPublishing}
                        >
                            {isPublishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}
                            Protocolo
                        </Button>
                    )}
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
                <button
                    type="button"
                    onClick={() => onNavigateTab?.("pre-escritura")}
                    className="flex items-center gap-2 mb-1 group cursor-pointer"
                >
                    <Hourglass className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
                        Certificados
                    </span>
                </button>
                {certResumen.total === 0 ? (
                    <p className="text-xs text-muted-foreground px-1 py-2">
                        Sin certificados cargados en Pre-Escriturario
                    </p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {certResumen.vencidos > 0 && (
                            <Badge variant="destructive" className="gap-1.5 text-xs">
                                <ShieldX className="h-3 w-3" />
                                {certResumen.vencidos} vencido{certResumen.vencidos !== 1 ? "s" : ""}
                            </Badge>
                        )}
                        {certResumen.porVencer > 0 && (
                            <Badge variant="outline" className="gap-1.5 text-xs text-amber-600 border-amber-200 bg-amber-50">
                                <Clock className="h-3 w-3" />
                                {certResumen.porVencer} por vencer
                            </Badge>
                        )}
                        {certResumen.vigentes > 0 && (
                            <Badge variant="outline" className="gap-1.5 text-xs text-green-600 border-green-200 bg-green-50">
                                <ShieldCheck className="h-3 w-3" />
                                {certResumen.vigentes} vigente{certResumen.vigentes !== 1 ? "s" : ""}
                            </Badge>
                        )}
                        {certResumen.pendientes > 0 && (
                            <Badge variant="secondary" className="gap-1.5 text-xs">
                                {certResumen.pendientes} pendiente{certResumen.pendientes !== 1 ? "s" : ""}
                            </Badge>
                        )}
                        {certResumen.sinConfirmar > 0 && (
                            <Badge variant="outline" className="gap-1.5 text-xs text-blue-600 border-blue-200 bg-blue-50">
                                <ShieldAlert className="h-3 w-3" />
                                {certResumen.sinConfirmar} sin confirmar
                            </Badge>
                        )}
                    </div>
                )}
            </div>

            {/* === Tabs navigation === */}
            {children}
        </div>
    );
}
