"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
    StickyNote, Send, Loader2, CheckCircle2, XCircle,
    Clock, AlertTriangle, Sparkles, ThumbsUp, ThumbsDown,
    Trash2, Mic, MicOff, Lightbulb, ArrowRight, RefreshCw
} from "lucide-react";
import { createApunte, listApuntes, deleteApunte, retryNoteAnalysis } from "@/app/actions/apuntes";
import { listSugerencias, acceptSuggestion, rejectSuggestion } from "@/app/actions/sugerencias";
import { supabase } from "@/lib/supabaseClient";
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
        label: "Analizando...",
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

/**
 * Procesa texto dictado: convierte comandos de voz en puntuación/acciones.
 * "coma" → ,  "punto" → .  "borrar" → elimina última palabra, etc.
 */
function processVoiceCommands(raw: string): string {
    let text = raw;

    // 1. Reemplazos de puntuación (orden importa: frases largas primero)
    const punctuation: [RegExp, string][] = [
        [/\bpunto y aparte\b/gi, ".\n"],
        [/\bpunto seguido\b/gi, ". "],
        [/\bpunto y coma\b/gi, ";"],
        [/\bpuntos suspensivos\b/gi, "..."],
        [/\bdos puntos\b/gi, ":"],
        [/\bsigno de exclamaci[oó]n\b/gi, "!"],
        [/\bsigno de interrogaci[oó]n\b/gi, "?"],
        [/\babrir interrogaci[oó]n\b/gi, "\u00BF"],
        [/\bcerrar interrogaci[oó]n\b/gi, "?"],
        [/\babrir exclamaci[oó]n\b/gi, "\u00A1"],
        [/\bcerrar exclamaci[oó]n\b/gi, "!"],
        [/\babrir par[eé]ntesis\b/gi, " ("],
        [/\bcerrar par[eé]ntesis\b/gi, ") "],
        [/\babrir comillas\b/gi, ' "'],
        [/\bcerrar comillas\b/gi, '" '],
        [/\bnueva l[ií]nea\b/gi, "\n"],
        [/\bnuevo p[aá]rrafo\b/gi, "\n\n"],
        [/\bpunto\b/gi, ". "],
        [/\bcoma\b/gi, ", "],
        [/\bguion\b/gi, " - "],
    ];

    for (const [pattern, replacement] of punctuation) {
        text = text.replace(pattern, replacement);
    }

    // 2. Comandos de borrado
    // "borrar última frase" / "borrar ultima frase"
    text = text.replace(/\s*borrar [uú]ltima frase\s*/gi, (_, offset) => {
        const before = text.substring(0, offset);
        // Buscar el último punto/salto de línea y borrar desde ahí
        const lastSentenceEnd = Math.max(before.lastIndexOf(". "), before.lastIndexOf(".\n"), before.lastIndexOf("\n"));
        if (lastSentenceEnd >= 0) {
            text = text.substring(0, lastSentenceEnd + 1) + " ";
            return "";
        }
        return "";
    });

    // "borrar" → elimina última palabra
    while (/\s*borrar\b/i.test(text)) {
        // Elimina "borrar" + la palabra anterior
        text = text.replace(/(\S+)\s+borrar\b/i, "");
        // Si "borrar" está al inicio (nada antes)
        text = text.replace(/^\s*borrar\b/i, "");
    }

    // 3. "mayúscula" → capitaliza la siguiente palabra
    text = text.replace(/\bmay[uú]scula\s+(\w)/gi, (_, letter) => letter.toUpperCase());

    // 4. Capitalizar después de ". " o ".\n" o inicio de texto
    text = text.replace(/(^|[.!?]\s+|\n)(\w)/g, (_, prefix, letter) => prefix + letter.toUpperCase());

    // 5. Limpiar espacios múltiples
    text = text.replace(/  +/g, " ");
    text = text.replace(/ ([.,;:!?)])/g, "$1"); // quitar espacio antes de puntuación
    text = text.replace(/([(\u00BF\u00A1"]) /g, "$1"); // quitar espacio después de apertura

    return text.trim();
}

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
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // Delete confirmation
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Dictation
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);
    const baseTextRef = useRef(""); // texto que había antes de empezar a dictar
    const finalChunksRef = useRef(""); // chunks finales acumulados durante dictado

    const fetchData = useCallback(async () => {
        const [apRes, sugRes, userRes] = await Promise.all([
            listApuntes(carpetaId),
            listSugerencias(carpetaId),
            supabase.auth.getUser(),
        ]);
        if (apRes.success) setApuntes(apRes.apuntes);
        if (sugRes.success) setSugerencias(sugRes.sugerencias);
        setCurrentUserId(userRes.data.user?.id || null);
        setIsLoading(false);
    }, [carpetaId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Polling: refrescar cuando hay apuntes en PROCESANDO
    const hasProcessing = apuntes.some(a => a.ia_status === "PROCESANDO");
    useEffect(() => {
        if (!hasProcessing) return;
        const interval = setInterval(() => fetchData(), 5000);
        return () => clearInterval(interval);
    }, [hasProcessing, fetchData]);

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

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        const result = await deleteApunte(deleteTarget);
        if (result.success) {
            toast.success("Apunte eliminado");
            fetchData();
        } else {
            toast.error(result.error || "Error al eliminar");
        }
        setIsDeleting(false);
        setDeleteTarget(null);
    };

    const [acceptingId, setAcceptingId] = useState<string | null>(null);

    const handleAccept = async (sugerenciaId: string) => {
        setAcceptingId(sugerenciaId);
        const result = await acceptSuggestion(sugerenciaId, carpetaId);
        if (result.success) {
            const changes = result.applied_changes;
            const detail = changes?.persona_dni
                ? ` — ${changes.nombre || changes.persona_dni} (${changes.rol})`
                : changes?.tipo
                    ? ` — Certificado ${changes.tipo}`
                    : "";
            toast.success(`Sugerencia aplicada${detail}`);
            fetchData();
        } else {
            toast.error(result.error || "Error al aplicar sugerencia", { duration: 6000 });
            fetchData();
        }
        setAcceptingId(null);
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

    const handleRetry = async (apunteId: string) => {
        const result = await retryNoteAnalysis(apunteId, carpetaId);
        if (result.success) {
            toast.success("Reintentando analisis...");
            fetchData();
        } else {
            toast.error(result.error || "Error al reintentar");
        }
    };

    // ── Web Speech API dictation ──
    const toggleDictation = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            toast.error("Tu navegador no soporta dictado por voz. Usa Chrome o Edge.");
            return;
        }

        // Snapshot del texto actual como base
        baseTextRef.current = contenido;
        finalChunksRef.current = "";

        const recognition = new SpeechRecognition();
        recognition.lang = "es-AR";
        recognition.continuous = true;
        recognition.interimResults = true;
        recognitionRef.current = recognition;

        recognition.onresult = (event: any) => {
            let currentInterim = "";
            let allFinals = "";
            for (let i = 0; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    allFinals += event.results[i][0].transcript + " ";
                } else {
                    currentInterim += event.results[i][0].transcript;
                }
            }
            finalChunksRef.current = allFinals;

            // Procesar comandos de voz en los finals
            const processed = processVoiceCommands(allFinals);
            const base = baseTextRef.current;
            const separator = base && !base.endsWith(" ") && !base.endsWith("\n") && processed ? " " : "";
            // Mostrar interim sin procesar (se ve en gris, se procesa al finalizar)
            const interimDisplay = currentInterim ? " " + currentInterim : "";
            setContenido(base + separator + processed + interimDisplay);
        };

        recognition.onerror = (event: any) => {
            if (event.error !== "aborted") {
                toast.error(`Error de dictado: ${event.error}`);
            }
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
            const base = baseTextRef.current;
            const finals = finalChunksRef.current.trim();
            if (finals) {
                const processed = processVoiceCommands(finals);
                const separator = base && !base.endsWith(" ") && !base.endsWith("\n") && processed ? " " : "";
                setContenido(base + separator + processed);
            }
        };

        recognition.start();
        setIsListening(true);
    };

    const getAuthorLabel = (autorId: string | null) => {
        if (!autorId) return null;
        if (autorId === currentUserId) return "Yo";
        return null; // future: resolve from user_profiles
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
                        placeholder="Escriba instrucciones, observaciones o datos para esta carpeta... (Ej: 'El comprador paga con cheque de pago diferido del Banco Nacion', 'Verificar inhibicion del vendedor')"
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
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                                Ctrl+Enter para guardar
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant={isListening ? "destructive" : "outline"}
                                onClick={toggleDictation}
                                title={isListening ? "Detener dictado" : "Dictar por voz"}
                            >
                                {isListening ? (
                                    <>
                                        <MicOff className="h-4 w-4 mr-1.5" />
                                        Detener
                                    </>
                                ) : (
                                    <>
                                        <Mic className="h-4 w-4 mr-1.5" />
                                        Dictar
                                    </>
                                )}
                            </Button>
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
                    {isListening && (
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs text-red-500 animate-pulse">
                                <span className="h-2 w-2 rounded-full bg-red-500" />
                                Escuchando... hable con claridad
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                                Comandos: &quot;punto&quot;, &quot;coma&quot;, &quot;punto y aparte&quot;, &quot;dos puntos&quot;, &quot;mayuscula&quot;, &quot;borrar&quot;, &quot;borrar ultima frase&quot;
                            </p>
                        </div>
                    )}
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
                                No hay apuntes todavia. Escriba una nota o use el dictado por voz.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {apuntes.map((apunte) => {
                                const statusCfg = IA_STATUS_CONFIG[apunte.ia_status] || IA_STATUS_CONFIG.PENDIENTE;
                                const authorLabel = getAuthorLabel(apunte.autor_id);
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
                                                {apunte.ia_status === "ERROR" && (
                                                    <button
                                                        onClick={() => handleRetry(apunte.id)}
                                                        className="p-1 rounded hover:bg-amber-50 transition-all text-amber-600 hover:text-amber-700"
                                                        title="Reintentar analisis"
                                                    >
                                                        <RefreshCw className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setDeleteTarget(apunte.id)}
                                                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-all text-muted-foreground hover:text-red-500"
                                                    title="Eliminar apunte"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-1">
                                            {authorLabel && (
                                                <span className="font-medium text-foreground/70">{authorLabel}</span>
                                            )}
                                            {authorLabel && " \u00B7 "}
                                            {formatRelativeTime(apunte.created_at)}
                                            {apunte.origen === "voz" && (
                                                <span className="ml-1.5 inline-flex items-center gap-0.5">
                                                    <Mic className="h-3 w-3" /> voz
                                                </span>
                                            )}
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
                    ) : hasProcessing && sugerencias.length === 0 ? (
                        <div className="px-5 py-4 space-y-3">
                            <div className="flex items-center gap-2 text-xs text-amber-600">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Analizando apuntes...
                            </div>
                            {[1, 2].map(i => (
                                <div key={i} className="space-y-2 animate-pulse">
                                    <div className="flex gap-2">
                                        <div className="h-5 w-28 bg-muted rounded" />
                                        <div className="h-5 w-12 bg-muted rounded" />
                                    </div>
                                    <div className="h-4 w-full bg-muted/60 rounded" />
                                    <div className="h-4 w-3/4 bg-muted/40 rounded" />
                                </div>
                            ))}
                        </div>
                    ) : sugerencias.length === 0 ? (
                        <div className="px-5 py-6 space-y-4">
                            {/* Empty state pro */}
                            <div className="text-center">
                                <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-blue-50 to-violet-50 flex items-center justify-center mb-3">
                                    <Sparkles className="h-6 w-6 text-blue-400" />
                                </div>
                                <p className="text-sm font-medium text-foreground">
                                    Asistente inteligente
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    NotiAR analiza sus apuntes y sugiere acciones para completar la carpeta.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-start gap-2.5 p-2.5 rounded-md bg-muted/30 border border-border/50">
                                    <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-medium text-foreground">Completar datos</p>
                                        <p className="text-[11px] text-muted-foreground">Detecta datos faltantes de partes, inmueble o acto.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2.5 p-2.5 rounded-md bg-muted/30 border border-border/50">
                                    <ArrowRight className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-medium text-foreground">Acciones sugeridas</p>
                                        <p className="text-[11px] text-muted-foreground">Propone agregar personas, certificados o datos del inmueble.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2.5 p-2.5 rounded-md bg-muted/30 border border-border/50">
                                    <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-medium text-foreground">Alertas</p>
                                        <p className="text-[11px] text-muted-foreground">Advierte sobre inconsistencias o datos a verificar.</p>
                                    </div>
                                </div>
                            </div>

                            <p className="text-[11px] text-center text-muted-foreground/60 pt-1">
                                Escriba un apunte para activar las sugerencias.
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
                                    {sug.apply_error && (
                                        <p className="text-[11px] text-red-500 bg-red-50 rounded px-2 py-1">
                                            {sug.apply_error}
                                        </p>
                                    )}
                                    <div className="flex gap-2 pt-1">
                                        <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                            onClick={() => handleAccept(sug.id)}
                                            disabled={acceptingId === sug.id}>
                                            {acceptingId === sug.id ? (
                                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                            ) : (
                                                <ThumbsUp className="h-3 w-3 mr-1" />
                                            )}
                                            {acceptingId === sug.id ? "Aplicando..." : "Aceptar"}
                                        </Button>
                                        <Button size="sm" variant="outline" className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                                            onClick={() => handleReject(sug.id)}
                                            disabled={!!acceptingId}>
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
                                        {sug.apply_error && (
                                            <p className="text-[11px] text-red-500 mt-1">{sug.apply_error}</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Modal confirmación borrado ── */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar apunte</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta accion es irreversible. El apunte y las sugerencias asociadas se eliminaran permanentemente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? (
                                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                            ) : (
                                <Trash2 className="h-4 w-4 mr-1.5" />
                            )}
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

/** Renderiza el payload de una sugerencia de forma legible */
function renderPayload(payload: any): React.ReactNode {
    if (!payload) return null;

    if (payload.descripcion) return <p>{payload.descripcion}</p>;
    if (payload.description) return <p>{payload.description}</p>;

    if (payload.campo && payload.valor !== undefined) {
        return (
            <p>
                <span className="font-medium">{payload.campo}</span>: {String(payload.valor)}
            </p>
        );
    }

    return <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(payload, null, 2)}</pre>;
}
