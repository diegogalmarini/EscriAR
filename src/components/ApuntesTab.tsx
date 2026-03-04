"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    StickyNote, Send, Loader2, CheckCircle2, XCircle,
    Clock, AlertTriangle, Sparkles, ThumbsUp, ThumbsDown,
    Trash2
} from "lucide-react";
import { createApunte, listApuntes, deleteApunte } from "@/app/actions/apuntes";
import { listSugerencias, acceptSuggestion, rejectSuggestion } from "@/app/actions/sugerencias";
import { toast } from "sonner";

interface ApuntesTabProps {
    carpetaId: string;
}

const IA_STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
    PENDIENTE: {
        label: "Pendiente",
        icon: <Clock className="h-3 w-3" />,
        className: "bg-slate-100 text-slate-600 border-slate-200",
    },
    PROCESANDO: {
        label: "Procesando",
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
        className: "bg-amber-100 text-amber-700 border-amber-200",
    },
    COMPLETADO: {
        label: "Procesado",
        icon: <CheckCircle2 className="h-3 w-3" />,
        className: "bg-emerald-100 text-emerald-700 border-emerald-200",
    },
    ERROR: {
        label: "Error",
        icon: <AlertTriangle className="h-3 w-3" />,
        className: "bg-red-100 text-red-700 border-red-200",
    },
};

const ESTADO_SUGERENCIA: Record<string, { label: string; className: string }> = {
    PROPOSED: { label: "Pendiente", className: "bg-blue-100 text-blue-700 border-blue-200" },
    ACCEPTED: { label: "Aceptada", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    REJECTED: { label: "Rechazada", className: "bg-red-100 text-red-700 border-red-200" },
};

function formatRelativeTime(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "ahora";
    if (diffMin < 60) return `hace ${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `hace ${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `hace ${diffD}d`;
    return date.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

export default function ApuntesTab({ carpetaId }: ApuntesTabProps) {
    const [contenido, setContenido] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [apuntes, setApuntes] = useState<any[]>([]);
    const [sugerencias, setSugerencias] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        const [apRes, sugRes] = await Promise.all([
            listApuntes(carpetaId),
            listSugerencias(carpetaId),
        ]);
        if (apRes.success) setApuntes(apRes.apuntes);
        if (sugRes.success) setSugerencias(sugRes.sugerencias);
        setIsLoading(false);
    }, [carpetaId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSave = async () => {
        if (!contenido.trim()) return;
        setIsSaving(true);
        const result = await createApunte(carpetaId, contenido);
        if (result.success) {
            setContenido("");
            toast.success("Apunte guardado");
            fetchData();
        } else {
            toast.error(result.error || "Error al guardar apunte");
        }
        setIsSaving(false);
    };

    const handleDelete = async (apunteId: string) => {
        const result = await deleteApunte(apunteId);
        if (result.success) {
            toast.success("Apunte eliminado");
            fetchData();
        } else {
            toast.error(result.error || "Error al eliminar");
        }
    };

    const handleAccept = async (sugerenciaId: string) => {
        const result = await acceptSuggestion(sugerenciaId, carpetaId);
        if (result.success) {
            toast.success("Sugerencia aceptada");
            fetchData();
        } else {
            toast.error(result.error || "Error");
        }
    };

    const handleReject = async (sugerenciaId: string) => {
        const result = await rejectSuggestion(sugerenciaId, carpetaId);
        if (result.success) {
            toast.success("Sugerencia rechazada");
            fetchData();
        } else {
            toast.error(result.error || "Error");
        }
    };

    const pendingSugerencias = sugerencias.filter(s => s.estado === "PROPOSED");
    const resolvedSugerencias = sugerencias.filter(s => s.estado !== "PROPOSED");

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ── Panel izquierdo: Apuntes ── */}
            <div className="lg:col-span-2 space-y-4">
                {/* Editor */}
                <div className="border border-border rounded-lg bg-background p-5 space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <StickyNote className="h-4 w-4" />
                        Nuevo apunte
                    </h3>
                    <Textarea
                        placeholder="Escriba instrucciones, observaciones o datos para esta carpeta... (Ej: 'El comprador paga con cheque de pago diferido del Banco Nación', 'Verificar inhibición del vendedor')"
                        value={contenido}
                        onChange={(e) => setContenido(e.target.value)}
                        rows={3}
                        className="resize-none"
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                                e.preventDefault();
                                handleSave();
                            }
                        }}
                    />
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                            Ctrl+Enter para guardar
                        </span>
                        <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={!contenido.trim() || isSaving}
                        >
                            {isSaving ? (
                                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4 mr-1.5" />
                            )}
                            Guardar
                        </Button>
                    </div>
                </div>

                {/* Lista de apuntes */}
                <div className="border border-border rounded-lg bg-background">
                    <div className="px-5 py-3 border-b border-border">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                            Apuntes ({apuntes.length})
                        </h3>
                    </div>

                    {isLoading ? (
                        <div className="p-8 flex justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : apuntes.length === 0 ? (
                        <div className="p-8 text-center">
                            <StickyNote className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                            <p className="text-sm text-muted-foreground">
                                No hay apuntes todavia. Escriba una nota arriba para empezar.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {apuntes.map((apunte) => {
                                const statusCfg = IA_STATUS_CONFIG[apunte.ia_status] || IA_STATUS_CONFIG.PENDIENTE;
                                return (
                                    <div key={apunte.id} className="px-5 py-3 group">
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="text-sm text-foreground whitespace-pre-wrap flex-1">
                                                {apunte.contenido}
                                            </p>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <Badge variant="outline" className={`text-[10px] gap-1 ${statusCfg.className}`}>
                                                    {statusCfg.icon}
                                                    {statusCfg.label}
                                                </Badge>
                                                <button
                                                    onClick={() => handleDelete(apunte.id)}
                                                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-all text-muted-foreground hover:text-red-500"
                                                    title="Eliminar apunte"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-1">
                                            {formatRelativeTime(apunte.created_at)}
                                            {apunte.ia_last_error && (
                                                <span className="ml-2 text-red-500">{apunte.ia_last_error}</span>
                                            )}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Panel derecho: Sugerencias ── */}
            <div className="space-y-4">
                <div className="border border-border rounded-lg bg-background">
                    <div className="px-5 py-3 border-b border-border">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            Sugerencias NotiAR
                            {pendingSugerencias.length > 0 && (
                                <Badge className="bg-blue-500 text-white text-[10px] ml-1">
                                    {pendingSugerencias.length}
                                </Badge>
                            )}
                        </h3>
                    </div>

                    {isLoading ? (
                        <div className="p-8 flex justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : sugerencias.length === 0 ? (
                        <div className="p-8 text-center">
                            <Sparkles className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                            <p className="text-sm text-muted-foreground">
                                Las sugerencias de NotiAR aparecen aqui cuando procesemos sus apuntes.
                            </p>
                            <p className="text-xs text-muted-foreground/60 mt-1">
                                Escriba un apunte para comenzar.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {/* Pendientes primero */}
                            {pendingSugerencias.map((sug) => (
                                <div key={sug.id} className="px-5 py-3 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                                            {sug.tipo}
                                        </Badge>
                                        {sug.confianza && (
                                            <Badge variant="outline" className="text-[10px]">
                                                {sug.confianza}
                                            </Badge>
                                        )}
                                    </div>
                                    {sug.evidencia_texto && (
                                        <p className="text-xs text-muted-foreground italic">
                                            &ldquo;{sug.evidencia_texto}&rdquo;
                                        </p>
                                    )}
                                    <div className="text-sm">
                                        {renderPayload(sug.payload)}
                                    </div>
                                    <div className="flex gap-2 pt-1">
                                        <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                            onClick={() => handleAccept(sug.id)}>
                                            <ThumbsUp className="h-3 w-3 mr-1" /> Aceptar
                                        </Button>
                                        <Button size="sm" variant="outline" className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                                            onClick={() => handleReject(sug.id)}>
                                            <ThumbsDown className="h-3 w-3 mr-1" /> Rechazar
                                        </Button>
                                    </div>
                                </div>
                            ))}

                            {/* Resueltas */}
                            {resolvedSugerencias.map((sug) => {
                                const estadoCfg = ESTADO_SUGERENCIA[sug.estado] || ESTADO_SUGERENCIA.PROPOSED;
                                return (
                                    <div key={sug.id} className="px-5 py-3 opacity-60">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-[10px]">
                                                {sug.tipo}
                                            </Badge>
                                            <Badge variant="outline" className={`text-[10px] ${estadoCfg.className}`}>
                                                {sug.estado === "ACCEPTED" ? <CheckCircle2 className="h-3 w-3 mr-0.5" /> : <XCircle className="h-3 w-3 mr-0.5" />}
                                                {estadoCfg.label}
                                            </Badge>
                                        </div>
                                        <div className="text-sm mt-1">
                                            {renderPayload(sug.payload)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/** Renderiza el payload de una sugerencia de forma legible */
function renderPayload(payload: any): React.ReactNode {
    if (!payload) return null;

    // Si tiene un campo "descripcion" o "description", mostrarlo
    if (payload.descripcion) return <p>{payload.descripcion}</p>;
    if (payload.description) return <p>{payload.description}</p>;

    // Si tiene campo/valor (sugerencia tipo campo)
    if (payload.campo && payload.valor !== undefined) {
        return (
            <p>
                <span className="font-medium">{payload.campo}</span>: {String(payload.valor)}
            </p>
        );
    }

    // Fallback: mostrar JSON legible
    return <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(payload, null, 2)}</pre>;
}
