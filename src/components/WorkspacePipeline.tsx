"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    FileSignature, ClipboardCheck, DollarSign, Users,
    Search, UserPlus, Send, Briefcase, X, Upload, Loader2,
    FileText, Download, AlertTriangle, ShieldAlert
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";  // ADDED
import { MinutaGenerator } from "./MinutaGenerator";
import { AMLCompliance } from "./AMLCompliance";
import { InscriptionTracker } from "./InscriptionTracker";
import { TaxBreakdownCard } from "./smart/TaxBreakdownCard";
import { LiquidacionPanel } from "./LiquidacionPanel";
import { PersonSearch } from "./PersonSearch";
import { CertificadosPanel } from "./CertificadosPanel";
import { supabase } from "@/lib/supabaseClient";
import { linkPersonToOperation, removePersonFromOperation } from "@/app/actions/carpeta";
import { toast } from "sonner";
import ActuacionesPanel from "./ActuacionesPanel";

import { EstudioDominioPanel } from "./EstudioDominioPanel";
import { EditarClienteDialog } from "./EditarClienteDialog";

/* ── Helper: campos OBLIGATORIOS según Art. 305 inc. b CCyC + Art. 3 bis Ley 17.801 ── */
/* Solo verifica datos que causan nulidad u observación registral.                        */
/* Profesión, nacionalidad, filiación = secundarios, NO disparan alerta.                  */
function fichaEscrituraIncompleta(p: any): string[] {
    if (!p) return ['datos'];
    const faltantes: string[] = [];
    if (!p.dni || p.dni.startsWith('SIN-DNI-') || p.dni.startsWith('TEMP_')) faltantes.push('DNI');
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

    const [isSearchOpen, setIsSearchOpen] = useState(false);

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

    // Transmitente: quien vende/dona/cede/transmite en esta operación
    const ROLES_TRANSMITENTE = [
        'VENDEDOR', 'TRANSMITENTE', 'DONANTE', 'CEDENTE', 'FIDUCIANTE',
        'TITULAR', 'CONDOMINO',
    ];
    const titulares = allParticipants.filter((p: any) => {
        const rol = p.rol?.toUpperCase() || "";
        return ROLES_TRANSMITENTE.includes(rol);
    });

    // Adquirente: quien compra/recibe/adquiere
    const ROLES_ADQUIRENTE = [
        'ADQUIRENTE', 'COMPRADOR', 'DONATARIO', 'CESIONARIO',
        'MUTUARIO', 'FIDEICOMISARIO',
    ];
    const adquirentesFromDB = allParticipants
        .filter((p: any) => ROLES_ADQUIRENTE.includes(p.rol?.toUpperCase() || ""))
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

    // ── Cross-check titularidad: vendedor TRAMITE vs titular INGESTA ──
    const titularidadAlerts = useMemo(() => {
        const alerts: { tipo: "vendedor_no_titular" | "titular_falta"; mensaje: string; detalle: string }[] = [];

        // Extraer titulares del antecedente (INGESTA)
        // En el antecedente, el COMPRADOR/ADQUIRENTE es el actual propietario
        const ingestaEsc = (carpeta.escrituras || []).find((e: any) => e.source === "INGESTA");
        if (!ingestaEsc) return alerts;

        const ingestaParticipants = ingestaEsc.operaciones?.flatMap(
            (op: any) => op.participantes_operacion || []
        ) || [];

        const ROLES_TITULAR_ANTECEDENTE = ["COMPRADOR", "ADQUIRENTE", "DONATARIO", "CESIONARIO", "FIDEICOMISARIO"];
        const titularesAntecedente = ingestaParticipants
            .filter((p: any) => ROLES_TITULAR_ANTECEDENTE.includes(p.rol?.toUpperCase() || ""))
            .map((p: any) => {
                const persona = p.persona || p.personas;
                return persona ? { dni: persona.dni, nombre: persona.nombre_completo } : null;
            })
            .filter(Boolean);

        if (titularesAntecedente.length === 0) return alerts;

        // Extraer apellidos de titulares antecedente para comparación flexible
        const apellidosTitular = titularesAntecedente.map((t: any) => {
            const name = (t.nombre || "").toUpperCase();
            return name.includes(",") ? name.split(",")[0].trim() : name.split(/\s+/).pop()?.trim() || "";
        }).filter(Boolean);

        // Verificar cada vendedor del TRAMITE
        for (const tit of titulares) {
            const persona = tit.persona || tit.personas;
            if (!persona) continue;
            const vendedorNombre = (persona.nombre_completo || "").toUpperCase();
            const vendedorApellido = vendedorNombre.includes(",")
                ? vendedorNombre.split(",")[0].trim()
                : vendedorNombre.split(/\s+/).pop()?.trim() || "";

            // ¿El vendedor coincide con algún titular del antecedente?
            const coincide = titularesAntecedente.some((t: any) =>
                t.dni === persona.dni ||
                apellidosTitular.some((ap: string) => ap === vendedorApellido)
            );

            if (!coincide && vendedorApellido) {
                alerts.push({
                    tipo: "vendedor_no_titular",
                    mensaje: `${persona.nombre_completo} figura como vendedor pero NO es titular según el antecedente`,
                    detalle: `Titulares en antecedente: ${titularesAntecedente.map((t: any) => t.nombre).join(", ")}`,
                });
            }
        }

        // ¿Hay titular del antecedente que no aparece como vendedor en TRAMITE?
        if (titulares.length > 0) {
            for (const tit of titularesAntecedente) {
                const titApellido = (tit.nombre || "").toUpperCase().includes(",")
                    ? (tit.nombre || "").toUpperCase().split(",")[0].trim()
                    : (tit.nombre || "").toUpperCase().split(/\s+/).pop()?.trim() || "";

                const figuraComo = titulares.some((v: any) => {
                    const p = v.persona || v.personas;
                    if (!p) return false;
                    return p.dni === tit.dni || (p.nombre_completo || "").toUpperCase().includes(titApellido);
                });

                if (!figuraComo && titApellido) {
                    alerts.push({
                        tipo: "titular_falta",
                        mensaje: `${tit.nombre} es titular según el antecedente pero no aparece como vendedor`,
                        detalle: "Verifique si el antecedente es correcto o si falta agregar al vendedor.",
                    });
                }
            }
        }

        return alerts;
    }, [carpeta.escrituras, titulares]);

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
                                Vende / Transmite
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
                                                    {persona?.dni && !persona.dni.startsWith('TEMP_') ? `DNI ${persona.dni}` : persona?.cuit ? `CUIT ${persona.cuit}` : <span className="text-amber-600 italic">DNI pendiente</span>}
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
                                Sin transmitentes agregados
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
                                                    {a.dni && !a.dni.startsWith('TEMP_') ? `DNI ${a.dni}` : "DNI pendiente"}
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

                {/* ── Alerta de titularidad (cross-check INGESTA vs TRAMITE) ── */}
                {titularidadAlerts.length > 0 && (
                    <div className="border border-amber-300 bg-amber-50 rounded-lg p-4 space-y-2">
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                            <h4 className="text-sm font-semibold text-amber-800">
                                Discrepancia de titularidad
                            </h4>
                        </div>
                        {titularidadAlerts.map((alert, i) => (
                            <div key={i} className="pl-6 space-y-0.5">
                                <p className="text-sm text-amber-800 flex items-start gap-1.5">
                                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                    {alert.mensaje}
                                </p>
                                <p className="text-xs text-amber-600 pl-5">{alert.detalle}</p>
                            </div>
                        ))}
                        <p className="text-[10px] text-amber-500 pl-6 pt-1">
                            Verifique que el documento del antecedente sea correcto o que los participantes estén bien asignados.
                        </p>
                    </div>
                )}

                {/* ── Actuaciones (Actos Privados + Protocolares) ── */}
                <ActuacionesPanel
                    carpetaId={carpeta.id}
                    orgId={carpeta.org_id}
                    operacionId={operacionId || null}
                    activeModelTypes={modelosEscritura.map(m => m.value)}
                    tipoActo={currentEscritura?.operaciones?.[0]?.tipo_acto}
                />
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
