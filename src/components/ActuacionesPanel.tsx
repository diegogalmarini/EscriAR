"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    FileText, Download, Pencil, Trash2, Plus,
    Loader2, ChevronDown, ChevronRight, AlertCircle,
    BookOpen, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { SUPPORTED_ACT_TYPES } from "@/app/actions/modelos-types";
import type { Actuacion } from "@/app/actions/actuaciones-types";
import { categoriaForActType } from "@/app/actions/actuaciones-types";
import {
    getActuaciones,
    createActuacion,
    generateActuacion,
    deleteActuacion,
    getActuacionDownloadUrl,
} from "@/app/actions/actuaciones";
import GenerarActuacionDialog from "./GenerarActuacionDialog";
import DeedRichEditor from "./DeedRichEditor";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ActuacionesPanelProps {
    carpetaId: string;
    orgId: string;
    operacionId: string | null;
    /** Active model act_types (optional, to filter dialog options) */
    activeModelTypes?: string[];
    /** Current tipo_acto from the TRAMITE operación — used to auto-create actuación */
    tipoActo?: string | null;
}

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: Actuacion["status"] }) {
    switch (status) {
        case "DRAFT":
            return <Badge variant="outline" className="text-[10px]">Borrador</Badge>;
        case "GENERANDO":
            return (
                <Badge variant="secondary" className="text-[10px] gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Generando
                </Badge>
            );
        case "LISTO":
            return <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Listo</Badge>;
        case "ERROR":
            return (
                <Badge variant="destructive" className="text-[10px] gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Error
                </Badge>
            );
    }
}

function actTypeLabel(actType: string): string {
    return SUPPORTED_ACT_TYPES.find((t) => t.value === actType)?.label || actType;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ActuacionesPanel({
    carpetaId,
    orgId,
    operacionId,
    activeModelTypes,
    tipoActo,
}: ActuacionesPanelProps) {
    const [actuaciones, setActuaciones] = useState<Actuacion[]>([]);
    const [loading, setLoading] = useState(true);

    // Collapsible state
    const [privadosOpen, setPrivadosOpen] = useState(true);
    const [protocolaresOpen, setProtocolaresOpen] = useState(true);

    // Expanded preview
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogCategoria, setDialogCategoria] = useState<"PRIVADO" | "PROTOCOLAR">("PROTOCOLAR");

    // Editor state
    const [editorActuacion, setEditorActuacion] = useState<Actuacion | null>(null);

    // Delete confirmation
    const [deleteTarget, setDeleteTarget] = useState<Actuacion | null>(null);

    // Generating state (per actuacion)
    const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());

    // ── Fetch actuaciones ──
    const fetchActuaciones = useCallback(async () => {
        const result = await getActuaciones(carpetaId);
        if (result.success && result.data) {
            setActuaciones(result.data);
        }
        setLoading(false);
    }, [carpetaId]);

    useEffect(() => {
        fetchActuaciones();
    }, [fetchActuaciones]);

    // ── Auto-crear actuación si hay tipo_acto pero no existe actuación para ese tipo ──
    const [autoCreated, setAutoCreated] = useState(false);
    useEffect(() => {
        if (loading || autoCreated || !tipoActo || tipoActo === "POR_DEFINIR") return;
        const yaExiste = actuaciones.some((a) => a.act_type === tipoActo);
        if (yaExiste) return;

        const catRaw = categoriaForActType(tipoActo);
        if (catRaw === "HIDDEN") return;
        const categoria = catRaw === "AMBIGUO" ? "PROTOCOLAR" : catRaw;

        setAutoCreated(true);
        createActuacion(carpetaId, tipoActo, categoria, operacionId).then((res) => {
            if (res.success && res.data) {
                setActuaciones((prev) => [...prev, res.data!]);
            }
        });
    }, [loading, tipoActo, actuaciones, autoCreated, carpetaId, operacionId]);

    // ── Grouped ──
    const privados = actuaciones.filter((a) => a.categoria === "PRIVADO");
    const protocolares = actuaciones.filter((a) => a.categoria === "PROTOCOLAR");

    // ── Handlers ──

    const handleCreateAndGenerate = async (actType: string, categoria: "PRIVADO" | "PROTOCOLAR") => {
        // 1. Create DRAFT
        const createResult = await createActuacion(carpetaId, actType, categoria, operacionId);
        if (!createResult.success || !createResult.data) {
            toast.error(createResult.error || "Error al crear actuación");
            throw new Error(createResult.error);
        }

        const newActuacion = createResult.data;
        setActuaciones((prev) => [...prev, newActuacion]);
        toast.success(`${actTypeLabel(actType)} creado`);

        // 2. Generate immediately
        setGeneratingIds((prev) => new Set(prev).add(newActuacion.id));
        setActuaciones((prev) =>
            prev.map((a) => a.id === newActuacion.id ? { ...a, status: "GENERANDO" as const } : a)
        );

        const genResult = await generateActuacion(newActuacion.id);
        setGeneratingIds((prev) => {
            const next = new Set(prev);
            next.delete(newActuacion.id);
            return next;
        });

        if (genResult.success && genResult.data) {
            setActuaciones((prev) =>
                prev.map((a) => a.id === newActuacion.id ? genResult.data! : a)
            );
            toast.success(`${actTypeLabel(actType)} generado correctamente`);
        } else {
            setActuaciones((prev) =>
                prev.map((a) => a.id === newActuacion.id ? { ...a, status: "ERROR" as const } : a)
            );
            toast.error(genResult.error || "Error al generar documento");
        }
    };

    const handleRegenerate = async (actuacion: Actuacion) => {
        setGeneratingIds((prev) => new Set(prev).add(actuacion.id));
        setActuaciones((prev) =>
            prev.map((a) => a.id === actuacion.id ? { ...a, status: "GENERANDO" as const } : a)
        );

        const result = await generateActuacion(actuacion.id);
        setGeneratingIds((prev) => {
            const next = new Set(prev);
            next.delete(actuacion.id);
            return next;
        });

        if (result.success && result.data) {
            setActuaciones((prev) =>
                prev.map((a) => a.id === actuacion.id ? result.data! : a)
            );
            toast.success("Documento regenerado");
        } else {
            setActuaciones((prev) =>
                prev.map((a) => a.id === actuacion.id ? { ...a, status: "ERROR" as const } : a)
            );
            toast.error(result.error || "Error al regenerar");
        }
    };

    const handleDownload = async (actuacion: Actuacion) => {
        const result = await getActuacionDownloadUrl(actuacion.id);
        if (result.success && result.url) {
            window.open(result.url, "_blank");
        } else {
            toast.error(result.error || "Error al descargar");
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        const result = await deleteActuacion(deleteTarget.id);
        if (result.success) {
            setActuaciones((prev) => prev.filter((a) => a.id !== deleteTarget.id));
            toast.success("Actuación eliminada");
        } else {
            toast.error(result.error || "Error al eliminar");
        }
        setDeleteTarget(null);
    };

    // ── Render section ──

    const renderActuacionRow = (actuacion: Actuacion) => {
        const isExpanded = expandedId === actuacion.id;
        const isGenerating = generatingIds.has(actuacion.id);

        return (
            <div key={actuacion.id} className="border border-border rounded-md bg-background overflow-hidden">
                {/* Row header */}
                <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : actuacion.id)}
                >
                    {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm font-medium text-foreground flex-1 truncate">
                        {actTypeLabel(actuacion.act_type)}
                    </span>
                    <StatusBadge status={actuacion.status} />

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {actuacion.status === "DRAFT" && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                disabled={isGenerating}
                                onClick={() => handleRegenerate(actuacion)}
                            >
                                <FileText className="h-3 w-3" />
                                Generar
                            </Button>
                        )}
                        {actuacion.status === "ERROR" && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs gap-1 text-amber-600"
                                disabled={isGenerating}
                                onClick={() => handleRegenerate(actuacion)}
                            >
                                <RefreshCw className="h-3 w-3" />
                                Reintentar
                            </Button>
                        )}
                        {actuacion.status === "LISTO" && (
                            <>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs gap-1"
                                    disabled={isGenerating}
                                    onClick={() => handleRegenerate(actuacion)}
                                >
                                    <RefreshCw className="h-3 w-3" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs gap-1"
                                    onClick={() => setEditorActuacion(actuacion)}
                                >
                                    <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs gap-1"
                                    onClick={() => handleDownload(actuacion)}
                                >
                                    <Download className="h-3 w-3" />
                                </Button>
                            </>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(actuacion)}
                        >
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    </div>
                </div>

                {/* Expanded preview */}
                {isExpanded && actuacion.html_preview && (
                    <div className="border-t border-border">
                        <div
                            className="p-4 max-h-[400px] overflow-y-auto prose prose-sm max-w-none
                                prose-headings:mb-2 prose-headings:mt-4 prose-p:mb-1 prose-p:mt-0
                                text-[13px] leading-relaxed bg-white"
                            dangerouslySetInnerHTML={{ __html: actuacion.html_preview }}
                        />
                    </div>
                )}

                {/* Expanded: fuentes */}
                {isExpanded && actuacion.generation_context?.sources && (
                    <div className="border-t border-border px-4 py-3 bg-muted/20">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                            Fuentes utilizadas
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {(actuacion.generation_context.sources as any).vendedores?.length > 0 && (
                                <span>Transmitentes: {(actuacion.generation_context.sources as any).vendedores.join(", ")}</span>
                            )}
                            {(actuacion.generation_context.sources as any).compradores?.length > 0 && (
                                <span>Adquirentes: {(actuacion.generation_context.sources as any).compradores.join(", ")}</span>
                            )}
                            {(actuacion.generation_context.sources as any).inmueble && (
                                <span>Inmueble: {(actuacion.generation_context.sources as any).inmueble}</span>
                            )}
                            {(actuacion.generation_context.sources as any).monto && (
                                <span>Monto: ${new Intl.NumberFormat("es-AR").format((actuacion.generation_context.sources as any).monto)}</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Expanded: error detail */}
                {isExpanded && actuacion.status === "ERROR" && actuacion.metadata?.last_error && (
                    <div className="border-t border-border px-4 py-3 bg-red-50">
                        <p className="text-xs text-red-600">{actuacion.metadata.last_error}</p>
                    </div>
                )}
            </div>
        );
    };

    const renderSection = (
        title: string,
        items: Actuacion[],
        isOpen: boolean,
        setOpen: (v: boolean) => void,
        categoria: "PRIVADO" | "PROTOCOLAR"
    ) => (
        <div className="border border-border rounded-lg bg-background overflow-hidden">
            {/* Section header */}
            <div
                className="flex items-center gap-3 px-4 py-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setOpen(!isOpen)}
            >
                {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <BookOpen className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-semibold text-foreground flex-1">
                    {title}
                </span>
                <Badge variant="outline" className="text-[10px]">
                    {items.length}
                </Badge>
                {categoria === "PROTOCOLAR" && (
                    <Badge variant="secondary" className="text-[10px]">
                        Impacta Protocolo
                    </Badge>
                )}
                <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 shrink-0"
                    onClick={(e) => {
                        e.stopPropagation();
                        setDialogCategoria(categoria);
                        setDialogOpen(true);
                    }}
                >
                    <Plus className="h-3 w-3" />
                    Nuevo
                </Button>
            </div>

            {/* Section body */}
            {isOpen && (
                <div className="p-3 space-y-2">
                    {items.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">
                            Sin actos {categoria === "PRIVADO" ? "privados" : "protocolares"} generados
                        </p>
                    ) : (
                        items.map(renderActuacionRow)
                    )}
                </div>
            )}
        </div>
    );

    // ── Loading state ──
    if (loading) {
        return (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Cargando actuaciones...</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {renderSection("Actos Protocolares", protocolares, protocolaresOpen, setProtocolaresOpen, "PROTOCOLAR")}
            {renderSection("Actos Privados", privados, privadosOpen, setPrivadosOpen, "PRIVADO")}

            {/* Dialog para crear nueva actuación */}
            <GenerarActuacionDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                defaultCategoria={dialogCategoria}
                activeModelTypes={activeModelTypes}
                onConfirm={handleCreateAndGenerate}
            />

            {/* Editor fullscreen */}
            {editorActuacion && editorActuacion.html_preview && (
                <DeedRichEditor
                    html={editorActuacion.html_preview}
                    title={actTypeLabel(editorActuacion.act_type)}
                    onSave={(html) => {
                        setActuaciones((prev) =>
                            prev.map((a) =>
                                a.id === editorActuacion.id ? { ...a, html_preview: html } : a
                            )
                        );
                    }}
                    onClose={() => setEditorActuacion(null)}
                />
            )}

            {/* Delete confirmation */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar actuación</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se eliminará <strong>{deleteTarget && actTypeLabel(deleteTarget.act_type)}</strong> y su archivo generado.
                            Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
