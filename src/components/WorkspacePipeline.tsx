"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    FileSignature, ClipboardCheck, DollarSign, Users,
    Search, UserPlus, Send, Briefcase, ArrowRight, X, Upload, Loader2,
    FileText, Download, Pencil
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";  // ADDED
import DeedRichEditor from "./DeedRichEditor";
import { MinutaGenerator } from "./MinutaGenerator";
import { AMLCompliance } from "./AMLCompliance";
import { InscriptionTracker } from "./InscriptionTracker";
import { TaxBreakdownCard } from "./smart/TaxBreakdownCard";
import { LiquidacionPanel } from "./LiquidacionPanel";
import { PersonSearch } from "./PersonSearch";
import { CertificadosPanel } from "./CertificadosPanel";
import { supabase } from "@/lib/supabaseClient";
import { linkPersonToOperation, removePersonFromOperation } from "@/app/actions/carpeta";
import { renderTemplate, loadRenderedDocument } from "@/app/actions/template-render";
import { toast } from "sonner";

import { EstudioDominioPanel } from "./EstudioDominioPanel";
import { EditarClienteDialog } from "./EditarClienteDialog";

/* ── Helper: campos OBLIGATORIOS según Art. 305 inc. b CCyC + Art. 3 bis Ley 17.801 ── */
/* Solo verifica datos que causan nulidad u observación registral.                        */
/* Profesión, nacionalidad, filiación = secundarios, NO disparan alerta.                  */
function fichaEscrituraIncompleta(p: any): string[] {
    if (!p) return ['datos'];
    const faltantes: string[] = [];
    if (!p.dni || p.dni.startsWith('SIN-DNI-')) faltantes.push('DNI');
    if (!p.cuit) faltantes.push('CUIT/CUIL');
    if (!p.fecha_nacimiento) faltantes.push('fecha nac.');
    if (!p.estado_civil_detalle) faltantes.push('estado civil');
    if (!p.domicilio_real?.literal && typeof p.domicilio_real !== 'string') faltantes.push('domicilio');
    return faltantes;
}

/* ── Shared types ── */

interface FasePreEscrituraProps {
    currentEscritura: any;
    carpetaId: string;
    carpeta: any;
}

interface FaseRedaccionProps {
    currentEscritura: any;
    activeDeedId: string | null;
    carpeta: any;
}

interface FasePostEscrituraProps {
    currentEscritura: any;
    activeDeedId: string | null;
    carpetaEstado: string;
    isBlockedBySecurity: boolean;
}

/* ══════════════════════════════════════════════════════════
   FASE 1 — Pre-Escriturario
   Certificados + TaxBreakdown + Liquidación y Honorarios
   ══════════════════════════════════════════════════════════ */

export function FasePreEscritura({ currentEscritura, carpetaId, carpeta }: FasePreEscrituraProps) {
    // Extraer DNIs de todos los participantes involucrados en la carpeta
    const personasDni = carpeta?.escrituras
        ?.flatMap((esc: any) => esc.operaciones || [])
        ?.flatMap((op: any) => op.participantes_operacion || [])
        ?.map((p: any) => {
            const person = p.persona || p.personas;
            return person?.dni;
        })
        ?.filter(Boolean) || [];

    const uniqueDnis: string[] = Array.from(new Set(personasDni));

    // Extraer datos para liquidación
    const tipoActo = currentEscritura?.operaciones?.[0]?.tipo_acto || "";
    const valuacionFiscal = currentEscritura?.inmuebles?.valuacion_fiscal;

    return (
        <div className="space-y-6">
            {/* Certificados y Estudio de Dominio (Hitos 1.1 y 1.2) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-border rounded-lg bg-background p-6 space-y-4">
                    <CertificadosPanel carpetaId={carpetaId} />
                </div>
                <div className="border border-border rounded-lg bg-background p-6 space-y-4">
                    <EstudioDominioPanel carpetaId={carpetaId} carpetasDnis={uniqueDnis} />
                </div>
            </div>

            {/* Liquidación Impositiva y Honorarios (Hito 1.5) */}
            <div className="border border-border rounded-lg bg-background p-6">
                <LiquidacionPanel
                    tipoActo={tipoActo}
                    valuacionFiscalInicial={valuacionFiscal}
                />
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════
   FASE 2 — Redacción
   Selector de acto + Constructor de Partes + Borrador IA
   ══════════════════════════════════════════════════════════ */

/** Fallback básico por si la query a modelos_actos falla */
const MODELOS_ESCRITURA_FALLBACK = [
    { value: "compraventa", label: "Compraventa" },
    { value: "hipoteca", label: "Hipoteca" },
    { value: "donacion", label: "Donación" },
    { value: "cesion_derechos", label: "Cesión de Derechos" },
    { value: "poder_especial_venta", label: "Poder Especial para Venta" },
    { value: "poder_general_administracion", label: "Poder General de Administración" },
];

export function FaseRedaccion({ currentEscritura, activeDeedId, carpeta }: FaseRedaccionProps) {
    // ── Cargar modelos activos desde BD ──
    const [modelosEscritura, setModelosEscritura] = useState<{ value: string; label: string }[]>(MODELOS_ESCRITURA_FALLBACK);
    useEffect(() => {
        supabase
            .from("modelos_actos")
            .select("act_type, label")
            .eq("is_active", true)
            .order("label", { ascending: true })
            .then(({ data }) => {
                if (data && data.length > 0) {
                    setModelosEscritura(
                        data.map((m: any) => ({ value: m.act_type, label: m.label || m.act_type }))
                    );
                }
            });
    }, []);

    // Inicializar tipoActo desde BD si existe
    const existingTipoActo = currentEscritura?.operaciones?.[0]?.tipo_acto || "";
    const matchedValue = modelosEscritura.find(m =>
        existingTipoActo.toUpperCase().includes(m.label.toUpperCase().replace('Ó', 'O')) ||
        m.value === existingTipoActo
    )?.value || existingTipoActo;
    const [tipoActo, setTipoActo] = useState<string>(matchedValue);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isRendering, setIsRendering] = useState(false);
    const [renderResult, setRenderResult] = useState<{ url: string; path: string; html: string } | null>(null);
    const [showEditor, setShowEditor] = useState(false);
    const [isLoadingPrevious, setIsLoadingPrevious] = useState(false);

    // Load previously-rendered document from Storage on mount
    useEffect(() => {
        if (!carpeta?.id || !tipoActo || renderResult) return;
        let cancelled = false;
        setIsLoadingPrevious(true);
        loadRenderedDocument(carpeta.id, tipoActo).then((res) => {
            if (cancelled) return;
            if (res.success && res.downloadUrl) {
                setRenderResult({
                    url: res.downloadUrl,
                    path: res.storagePath || "",
                    html: res.htmlPreview || "",
                });
            }
        }).catch(() => {}).finally(() => {
            if (!cancelled) setIsLoadingPrevious(false);
        });
        return () => { cancelled = true; };
    }, [carpeta?.id, tipoActo]);

    // Estado para gestionar los apoderados mapeados por DNI del adquirente (persona jurídica)
    // Guardamos la persona y un objeto con los datos del poder
    const [apoderados, setApoderados] = useState<Record<string, {
        persona: any,
        poderData: {
            nro_escritura?: string;
            fecha_otorgamiento?: string;
            escribano_autorizante?: string;
            registro?: string;
            facultades_extracto?: string;
            pdf_file?: File | null;
            isSaving?: boolean;
        }
    }>>({});
    const [isApoderadoSearchOpen, setIsApoderadoSearchOpen] = useState(false);
    const [selectedJuridicaForApoderado, setSelectedJuridicaForApoderado] = useState<string | null>(null);
    const [isFichaPoderOpen, setIsFichaPoderOpen] = useState(false);
    const [selectedForFichaPoder, setSelectedForFichaPoder] = useState<string | null>(null);

    /* ── Extraer inmueble principal ── */
    const inmueble = currentEscritura?.inmuebles;

    /* ── Extraer operacionId principal ── */
    const operacionId = currentEscritura?.operaciones?.[0]?.id;

    /* ── Adquirentes: derivar de BD (persistidos) + estado local para carga ── */
    const allParticipants = currentEscritura?.operaciones?.flatMap(
        (op: any) => op.participantes_operacion || []
    ) || [];

    // Transmitentes: roles del antecedente (COMPRADOR, DONATARIO, TITULAR, etc.)
    const titulares = allParticipants.filter((p: any) => {
        const rol = p.rol?.toUpperCase() || "";
        return rol.includes("COMPRADOR") || rol.includes("CESIONARIO") ||
            rol.includes("DONATARIO") || rol.includes("TITULAR");
    });

    // Adquirentes: rol "ADQUIRENTE" (agregados manualmente desde Mesa de Trabajo)
    const adquirentesFromDB = allParticipants
        .filter((p: any) => p.rol?.toUpperCase() === 'ADQUIRENTE')
        .map((p: any) => {
            const persona = p.persona || p.personas;
            return persona ? { ...persona, _participanteId: p.id } : null;
        })
        .filter(Boolean);

    // Estado local optimista: muestra cambios antes de recargar
    const [optimisticAdds, setOptimisticAdds] = useState<any[]>([]);
    const [optimisticRemoves, setOptimisticRemoves] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Combinar: DB data + optimistic adds - optimistic removes
    const adquirentes = [
        ...adquirentesFromDB.filter((a: any) => !optimisticRemoves.includes(a.dni)),
        ...optimisticAdds.filter((a: any) => !adquirentesFromDB.some((d: any) => d.dni === a.dni))
    ];

    const inmuebleLabel = inmueble
        ? [inmueble.partido_id, inmueble.nro_partida ? `Partida ${inmueble.nro_partida}` : null].filter(Boolean).join(" · ")
        : null;

    const removeAdquirente = async (dni: string) => {
        // Optimistic remove
        setOptimisticRemoves(prev => [...prev, dni]);
        setApoderados(prev => {
            const newApoderados = { ...prev };
            delete newApoderados[dni];
            return newApoderados;
        });

        // Persist to DB
        if (operacionId) {
            const result = await removePersonFromOperation(operacionId, dni);
            if (!result.success) {
                toast.error('Error al quitar participante');
                setOptimisticRemoves(prev => prev.filter(d => d !== dni));
            } else {
                window.location.reload();
            }
        }
    };

    const removeApoderado = (adquirenteDni: string) => {
        setApoderados((prev) => {
            const newApoderados = { ...prev };
            delete newApoderados[adquirenteDni];
            return newApoderados;
        });
    };

    const handleSavePoder = async () => {
        if (!selectedForFichaPoder) return;
        const apoderadoRec = apoderados[selectedForFichaPoder];
        if (!apoderadoRec) return;

        setApoderados(prev => ({
            ...prev,
            [selectedForFichaPoder]: {
                ...prev[selectedForFichaPoder],
                poderData: { ...prev[selectedForFichaPoder].poderData, isSaving: true }
            }
        }));

        try {
            // Upload file if selected
            let finalPdfUrl = null;
            if (apoderadoRec.poderData.pdf_file) {
                const file = apoderadoRec.poderData.pdf_file;
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `poderes/${selectedForFichaPoder}/${fileName}`; // otorgante/filename

                const { error: uploadError, data: uploadData } = await supabase.storage
                    .from('documentos')
                    .upload(filePath, file);

                if (uploadError) {
                    toast.error("Error al subir el documento. Reintente.");
                    console.error("Upload error:", uploadError);
                } else if (uploadData) {
                    const { data: publicUrlData } = supabase.storage
                        .from('documentos')
                        .getPublicUrl(uploadData.path);
                    finalPdfUrl = publicUrlData.publicUrl;
                }
            }

            const { data, error } = await supabase
                .from("poderes")
                .insert({
                    otorgante_dni: selectedForFichaPoder, // La Persona Jurídica
                    apoderado_dni: apoderadoRec.persona.dni, // El Representante
                    nro_escritura: apoderadoRec.poderData.nro_escritura || null,
                    fecha_otorgamiento: apoderadoRec.poderData.fecha_otorgamiento || null,
                    escribano_autorizante: apoderadoRec.poderData.escribano_autorizante || null,
                    registro: apoderadoRec.poderData.registro || null,
                    facultades_extracto: apoderadoRec.poderData.facultades_extracto || null,
                    pdf_url: finalPdfUrl
                });

            if (error) {
                throw error;
            }

            toast.success("Ficha del Poder registrada exitosamente.");
            setIsFichaPoderOpen(false);
        } catch (err: any) {
            console.error("Error saving poder:", err);
            toast.error("Error al guardar la Ficha del Poder: " + err.message);
        } finally {
            setApoderados(prev => ({
                ...prev,
                [selectedForFichaPoder]: {
                    ...prev[selectedForFichaPoder],
                    poderData: { ...prev[selectedForFichaPoder].poderData, isSaving: false }
                }
            }));
        }
    };

    const canGenerate = !!tipoActo && !!activeDeedId && adquirentes.length > 0;

    return (
        <>
            <div className="space-y-6">
                {/* ── Configuración de Partes ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Tarjeta Izquierda — Parte Transmitente */}
                    <div className="border border-border rounded-lg bg-background p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                Parte Transmitente
                            </h3>
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 text-muted-foreground">
                                Origen: Antecedente
                            </Badge>
                        </div>

                        {titulares.length > 0 ? (
                            <div className="space-y-2">
                                {titulares.map((t: any, idx: number) => {
                                    const persona = t.persona || t.personas;
                                    return (
                                        <div key={persona?.id || idx} className="group flex items-center gap-3 rounded-md border border-border bg-muted/20 px-3 py-2.5 hover:bg-muted/40 transition-colors">
                                            <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-foreground truncate">
                                                    {persona?.nombre_completo || "—"}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {persona?.dni ? `DNI ${persona.dni}` : persona?.cuit ? `CUIT ${persona.cuit}` : "Sin documento"}
                                                    {persona?.profesion && ` · ${persona.profesion}`}
                                                    {" · "}
                                                    <span className="font-medium">{t.rol}</span>
                                                </p>
                                                {(() => {
                                                    const faltantes = fichaEscrituraIncompleta(persona);
                                                    return faltantes.length > 0 ? (
                                                        <p className="text-[10px] text-amber-600 mt-0.5">⚠ Faltan: {faltantes.join(', ')}</p>
                                                    ) : null;
                                                })()}
                                            </div>
                                            {persona && (
                                                <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <EditarClienteDialog persona={persona} />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground py-4 text-center">
                                Sin titulares en el antecedente
                            </p>
                        )}
                    </div>

                    {/* Tarjeta Derecha — Parte Adquirente */}
                    <div className="border border-border rounded-lg bg-background p-5 space-y-4">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                            Parte Adquirente
                        </h3>

                        {/* Adquirentes agregados */}
                        {adquirentes.length > 0 && (
                            <div className="space-y-3">
                                {adquirentes.map((a) => (
                                    <div key={a.dni || Math.random().toString()} className="flex flex-col rounded-md border border-border bg-muted/20 px-3 py-2.5">
                                        <div className="flex items-center gap-3 w-full">
                                            <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-foreground truncate">{a.nombre_completo}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {a.dni ? `DNI ${a.dni}` : "Sin documento"}
                                                    {a.profesion && ` · ${a.profesion}`}
                                                    {a.tipo_persona === "JURIDICA" && " · Persona Jurídica"}
                                                    {apoderados[a.dni] && ` · Rep. por: ${apoderados[a.dni].persona.nombre_completo}`}
                                                </p>
                                                {a.tipo_persona !== "JURIDICA" && (() => {
                                                    const faltantes = fichaEscrituraIncompleta(a);
                                                    return faltantes.length > 0 ? (
                                                        <p className="text-[10px] text-amber-600 mt-0.5">⚠ Faltan: {faltantes.join(', ')}</p>
                                                    ) : null;
                                                })()}
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                {a.tipo_persona === "JURIDICA" && !apoderados[a.dni] && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                                                        onClick={() => {
                                                            setSelectedJuridicaForApoderado(a.dni);
                                                            setIsApoderadoSearchOpen(true);
                                                        }}
                                                    >
                                                        <Briefcase className="h-3 w-3" />
                                                        + Apoderado / Representante
                                                    </Button>
                                                )}
                                                {a.tipo_persona === "JURIDICA" && apoderados[a.dni] && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1"
                                                        onClick={() => removeApoderado(a.dni)}
                                                    >
                                                        <Briefcase className="h-3 w-3" />
                                                        Quitar Representante
                                                    </Button>
                                                )}
                                                <EditarClienteDialog persona={a} />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                    onClick={() => removeAdquirente(a.dni)}
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                        {apoderados[a.dni] && (
                                            <div className="mt-2 pl-7 flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 text-xs gap-1"
                                                    onClick={() => {
                                                        setSelectedForFichaPoder(a.dni);
                                                        setIsFichaPoderOpen(true);
                                                    }}
                                                >
                                                    <FileSignature className="h-3 w-3" />
                                                    Ficha del Poder / Documento
                                                </Button>
                                                {apoderados[a.dni].poderData.facultades_extracto && (
                                                    <Badge variant="secondary" className="h-7 text-[10px] font-normal flex items-center">
                                                        Datos completos ✓
                                                    </Badge>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Zona vacía / Botones de acción */}
                        {adquirentes.length === 0 && (
                            <div className="border-2 border-dashed border-border rounded-lg py-6 px-4 text-center space-y-3">
                                <Users className="h-8 w-8 text-muted-foreground/50 mx-auto" />
                                <p className="text-sm text-muted-foreground">
                                    Agregue al comprador o adquirente
                                </p>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 gap-1.5"
                                onClick={() => setIsSearchOpen(true)}
                            >
                                <UserPlus className="h-3.5 w-3.5" />
                                Buscar o Seleccionar Cliente
                            </Button>
                        </div>

                        <PersonSearch
                            open={isSearchOpen}
                            setOpen={setIsSearchOpen}
                            onSelect={async (person: any) => {
                                if (adquirentes.find((a: any) => a.dni === person.dni)) return;
                                // Optimistic add
                                setOptimisticAdds(prev => [...prev, person]);
                                // Persist to DB
                                if (operacionId) {
                                    setIsSaving(true);
                                    const result = await linkPersonToOperation(operacionId, person.dni, 'ADQUIRENTE');
                                    setIsSaving(false);
                                    if (!result.success) {
                                        toast.error('Error al agregar participante: ' + result.error);
                                        setOptimisticAdds(prev => prev.filter((a: any) => a.dni !== person.dni));
                                    } else {
                                        toast.success(`${person.nombre_completo} agregado como adquirente`);
                                        window.location.reload();
                                    }
                                } else {
                                    toast.error('No hay operación disponible para vincular');
                                }
                            }}
                        />

                        <PersonSearch
                            open={isApoderadoSearchOpen}
                            setOpen={setIsApoderadoSearchOpen}
                            onSelect={(person) => {
                                if (selectedJuridicaForApoderado) {
                                    setApoderados(prev => ({
                                        ...prev,
                                        [selectedJuridicaForApoderado]: {
                                            persona: person,
                                            poderData: {}
                                        }
                                    }));
                                }
                            }}
                        />
                    </div>
                </div>

                {/* Selector de tipo de acto */}
                <div className="border border-border rounded-lg bg-background p-5 space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Tipo de Acto
                    </h3>
                    <Select value={tipoActo} onValueChange={async (val) => {
                        setTipoActo(val);
                        // Persistir en BD — guardamos el act_type (value) como tipo_acto
                        const opId = currentEscritura?.operaciones?.[0]?.id;
                        if (opId) {
                            await supabase.from('operaciones').update({ tipo_acto: val }).eq('id', opId);
                        }
                    }}>
                        <SelectTrigger className="w-full max-w-md">
                            <SelectValue placeholder="Seleccione el tipo de acto a redactar..." />
                        </SelectTrigger>
                        <SelectContent>
                            {modelosEscritura.map((m) => (
                                <SelectItem key={m.value} value={m.value}>
                                    {m.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>


                {/* ── Generación desde Template ── */}
                <div className="border border-primary/20 rounded-lg bg-primary/5 p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <FileText className="h-8 w-8 text-primary shrink-0" />
                            <div>
                                <h3 className="text-base font-semibold text-foreground">Generar Escritura desde Modelo</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {!tipoActo && "Seleccione un tipo de acto"}
                                    {tipoActo && adquirentes.length === 0 && "Agregue al menos un participante"}
                                    {tipoActo && adquirentes.length > 0 && !renderResult && !isLoadingPrevious && (
                                        `Modelo: ${modelosEscritura.find(m => m.value === tipoActo)?.label || tipoActo}`
                                    )}
                                    {isLoadingPrevious && !renderResult && "Cargando documento anterior…"}
                                    {renderResult && "✓ Documento generado — revise abajo"}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                size="lg"
                                disabled={!canGenerate || isRendering}
                                onClick={async () => {
                                    if (!carpeta?.id || !tipoActo) return;
                                    setIsRendering(true);
                                    setRenderResult(null);
                                    try {
                                        const result = await renderTemplate(carpeta.id, tipoActo);
                                        if (result.success && result.downloadUrl) {
                                            setRenderResult({
                                                url: result.downloadUrl,
                                                path: result.storagePath || "",
                                                html: result.htmlPreview || "",
                                            });
                                            toast.success("Escritura generada correctamente");
                                        } else {
                                            toast.error(result.error || "Error al generar la escritura");
                                        }
                                    } catch (err: any) {
                                        toast.error(err.message || "Error inesperado");
                                    } finally {
                                        setIsRendering(false);
                                    }
                                }}
                            >
                                {isRendering ? (
                                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generando...</>
                                ) : (
                                    <><FileText className="h-4 w-4 mr-2" /> {renderResult ? "Regenerar" : "Generar desde Modelo"}<ArrowRight className="h-4 w-4 ml-2" /></>
                                )}
                            </Button>
                            {renderResult && (
                                <Button size="lg" variant="outline" onClick={() => setShowEditor(true)}>
                                    <Pencil className="h-4 w-4 mr-2" /> Editar
                                </Button>
                            )}
                            {renderResult && (
                                <Button size="lg" variant="outline" asChild>
                                    <a href={renderResult.url} download>
                                        <Download className="h-4 w-4 mr-2" /> Descargar
                                    </a>
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* ── Loading previous render ── */}
                    {isLoadingPrevious && !renderResult && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Buscando documento generado anteriormente…
                        </div>
                    )}

                    {/* ── Preview inline del documento generado ── */}
                    {renderResult?.html && (
                        <div className="border border-border rounded-lg bg-white">
                            <div className="flex items-center px-4 py-2 bg-muted/50 border-b border-border rounded-t-lg">
                                <span className="text-xs font-medium text-muted-foreground">
                                    Vista previa del documento
                                </span>
                            </div>
                            <div
                                className="p-6 max-h-[500px] overflow-y-auto prose prose-sm max-w-none
                                    prose-headings:mb-2 prose-headings:mt-4 prose-p:mb-1 prose-p:mt-0
                                    text-[13px] leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: renderResult.html }}
                            />
                        </div>
                    )}
                </div>

                {/* ── Editor fullscreen ── */}
                {showEditor && renderResult?.html && (
                    <DeedRichEditor
                        html={renderResult.html}
                        title={modelosEscritura.find(m => m.value === tipoActo)?.label || tipoActo}
                        onSave={(html) => setRenderResult(prev => prev ? { ...prev, html } : prev)}
                        onClose={() => setShowEditor(false)}
                    />
                )}
            </div>

            {/* Modal de Ficha de Poder */}
            <Dialog open={isFichaPoderOpen} onOpenChange={setIsFichaPoderOpen}>
                <DialogContent className="sm:max-w-[550px]">
                    <DialogHeader>
                        <DialogTitle>Ficha del Poder / Representación</DialogTitle>
                        <DialogDescription>
                            Ingrese los datos registrales del poder o adjunte el documento digital.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedForFichaPoder && apoderados[selectedForFichaPoder] && (
                        <div className="space-y-4 py-2">
                            <div className="bg-muted/30 p-3 rounded-md border border-border">
                                <p className="text-sm font-medium">Representante Legal (Apoderado)</p>
                                <p className="text-xs text-muted-foreground">{apoderados[selectedForFichaPoder].persona.nombre_completo}</p>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">N° de Escritura / Poder</Label>
                                        <Input
                                            placeholder="Ej: No. 1234"
                                            className="h-8 text-xs"
                                            value={apoderados[selectedForFichaPoder].poderData.nro_escritura || ''}
                                            onChange={(e) => setApoderados(prev => ({
                                                ...prev,
                                                [selectedForFichaPoder]: {
                                                    ...prev[selectedForFichaPoder],
                                                    poderData: { ...prev[selectedForFichaPoder].poderData, nro_escritura: e.target.value }
                                                }
                                            }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Fecha Otorgamiento</Label>
                                        <Input
                                            type="date"
                                            className="h-8 text-xs"
                                            value={apoderados[selectedForFichaPoder].poderData.fecha_otorgamiento || ''}
                                            onChange={(e) => setApoderados(prev => ({
                                                ...prev,
                                                [selectedForFichaPoder]: {
                                                    ...prev[selectedForFichaPoder],
                                                    poderData: { ...prev[selectedForFichaPoder].poderData, fecha_otorgamiento: e.target.value }
                                                }
                                            }))}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">Escribano Autorizante / Registro</Label>
                                    <Input
                                        placeholder="Ej: Registro 15, Juan Perez"
                                        className="h-8 text-xs"
                                        value={apoderados[selectedForFichaPoder].poderData.escribano_autorizante || ''}
                                        onChange={(e) => setApoderados(prev => ({
                                            ...prev,
                                            [selectedForFichaPoder]: {
                                                ...prev[selectedForFichaPoder],
                                                poderData: { ...prev[selectedForFichaPoder].poderData, escribano_autorizante: e.target.value }
                                            }
                                        }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">Extracto de Facultades (Literal o Resumen)</Label>
                                    <Textarea
                                        className="min-h-[100px] text-xs resize-none"
                                        placeholder="Pegue aquí el extracto de facultades si no dispone del PDF original..."
                                        value={apoderados[selectedForFichaPoder].poderData.facultades_extracto || ''}
                                        onChange={(e) => {
                                            setApoderados(prev => ({
                                                ...prev,
                                                [selectedForFichaPoder]: {
                                                    ...prev[selectedForFichaPoder],
                                                    poderData: { ...prev[selectedForFichaPoder].poderData, facultades_extracto: e.target.value }
                                                }
                                            }))
                                        }}
                                    />
                                </div>

                                <div className="border border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors relative">
                                    <input
                                        type="file"
                                        accept=".pdf,.doc,.docx"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                setApoderados(prev => ({
                                                    ...prev,
                                                    [selectedForFichaPoder]: {
                                                        ...prev[selectedForFichaPoder],
                                                        poderData: { ...prev[selectedForFichaPoder].poderData, pdf_file: file }
                                                    }
                                                }));
                                            }
                                        }}
                                    />
                                    <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                                    {apoderados[selectedForFichaPoder].poderData.pdf_file ? (
                                        <p className="text-sm font-medium text-blue-600">{apoderados[selectedForFichaPoder].poderData.pdf_file?.name}</p>
                                    ) : (
                                        <>
                                            <p className="text-sm font-medium">Subir Documento (PDF/DOCX)</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Asocie el archivo digital del poder a este representante
                                            </p>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end pt-2">
                                <Button
                                    onClick={handleSavePoder}
                                    disabled={apoderados[selectedForFichaPoder].poderData.isSaving}
                                    className="gap-2"
                                >
                                    {apoderados[selectedForFichaPoder].poderData.isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                                    Guardar Ficha
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

/* ══════════════════════════════════════════════════════════
   FASE 3 — Post-Escritura / Cierre Registral
   Minuta + AMLCompliance + InscriptionTracker
   ══════════════════════════════════════════════════════════ */

export function FasePostEscritura({
    currentEscritura,
    activeDeedId,
    carpetaEstado,
    isBlockedBySecurity,
}: FasePostEscrituraProps) {
    return (
        <div className="space-y-6">
            {/* Minuta */}
            <MinutaGenerator data={currentEscritura} isBlocked={isBlockedBySecurity} />

            {/* Compliance */}
            <AMLCompliance escrituraId={activeDeedId!} />

            {/* Inscripción */}
            {(carpetaEstado === "FIRMADA" || carpetaEstado === "INSCRIPTA") && (
                <InscriptionTracker data={currentEscritura} />
            )}
        </div>
    );
}
