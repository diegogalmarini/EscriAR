"use client";

import { useState } from "react";
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
    FileSignature, ClipboardCheck, Pencil, DollarSign, Home, Users,
    Search, UserPlus, Send, Briefcase, ArrowRight, X,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";  // ADDED
import { DeedEditor } from "./DeedEditor";
import { MinutaGenerator } from "./MinutaGenerator";
import { AMLCompliance } from "./AMLCompliance";
import { InscriptionTracker } from "./InscriptionTracker";
import { TaxBreakdownCard } from "./smart/TaxBreakdownCard";
import { PersonSearch } from "./PersonSearch";

/* ── Shared types ── */

interface FasePreEscrituraProps {
    currentEscritura: any;
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

export function FasePreEscritura({ currentEscritura }: FasePreEscrituraProps) {
    return (
        <div className="space-y-6">
            {/* Certificados */}
            <div className="border border-border rounded-lg bg-background p-6 space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4" /> Certificados
                </h3>
                <div className="space-y-3">
                    {[
                        { name: "Dominio e Inhibición", key: "dominio" },
                        { name: "Catastral", key: "catastral" },
                        { name: "Anotaciones Personales", key: "anotaciones" },
                        { name: "Libre Deuda Municipal", key: "municipal" },
                    ].map((cert) => (
                        <div key={cert.key} className="flex items-center gap-4 py-2 border-b border-border last:border-0">
                            <span className="text-sm text-foreground flex-1">{cert.name}</span>
                            <Input type="date" className="h-8 w-40 text-sm" />
                            <Badge variant="outline" className="text-xs px-2.5 py-1 text-muted-foreground gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-slate-300" />
                                Pendiente
                            </Badge>
                        </div>
                    ))}
                </div>
            </div>

            {/* Presupuesto Impositivo */}
            <TaxBreakdownCard taxData={currentEscritura?.analysis_metadata?.tax_calculation} />

            {/* Liquidación y Honorarios */}
            <div className="border border-border rounded-lg bg-background p-6 space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Liquidación y Honorarios
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="precio_real" className="text-sm">Precio Real de la Operación</Label>
                        <Input
                            id="precio_real"
                            type="number"
                            placeholder="Ej: 50000000"
                            className="h-9"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="honorarios" className="text-sm">Honorarios del Escribano</Label>
                        <Input
                            id="honorarios"
                            type="number"
                            placeholder="Ej: 1000000"
                            className="h-9"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════
   FASE 2 — Redacción
   Selector de acto + Constructor de Partes + Borrador IA
   ══════════════════════════════════════════════════════════ */

const MODELOS_ESCRITURA = [
    { value: "compraventa", label: "Compraventa Completa" },
    { value: "compraventa-hipoteca", label: "Compraventa con Hipoteca" },
    { value: "donacion", label: "Donación" },
    { value: "donacion-usufructo", label: "Donación con Usufructo" },
    { value: "poder-especial", label: "Poder Especial" },
    { value: "poder-general", label: "Poder General" },
];

export function FaseRedaccion({ currentEscritura, activeDeedId, carpeta }: FaseRedaccionProps) {
    const [tipoActo, setTipoActo] = useState<string>("");
    const [adquirentes, setAdquirentes] = useState<any[]>([]);
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Estado para gestionar los apoderados mapeados por DNI del adquirente (persona jurídica)
    // Guardamos la persona y un texto justificativo (los datos del poder)
    const [apoderados, setApoderados] = useState<Record<string, { persona: any, justificativo: string }>>({});
    // Estado para saber a qué adquirente le estamos buscando un apoderado
    const [isApoderadoSearchOpen, setIsApoderadoSearchOpen] = useState(false);
    const [selectedJuridicaForApoderado, setSelectedJuridicaForApoderado] = useState<string | null>(null);

    // Extraer inmueble principal y titulares/transmitentes del antecedente
    const inmueble = currentEscritura?.inmuebles;
    const participantes = currentEscritura?.operaciones?.flatMap(
        (op: any) => op.participantes_operacion || []
    ) || [];
    const titulares = participantes.filter((p: any) => {
        const rol = p.rol?.toUpperCase() || "";
        return rol.includes("COMPRADOR") || rol.includes("ADQUIRENTE") ||
            rol.includes("CESIONARIO") || rol.includes("DONATARIO") ||
            rol.includes("TITULAR");
    });

    const inmuebleLabel = inmueble
        ? [inmueble.partido_id, inmueble.nro_partida ? `Partida ${inmueble.nro_partida}` : null].filter(Boolean).join(" · ")
        : null;

    const removeAdquirente = (dni: string) => {
        setAdquirentes((prev) => prev.filter((a) => a.dni !== dni));
        // Si borramos un adquirente, también limpiamos su apoderado
        setApoderados((prev) => {
            const newApoderados = { ...prev };
            delete newApoderados[dni];
            return newApoderados;
        });
    };

    const removeApoderado = (adquirenteDni: string) => {
        setApoderados((prev) => {
            const newApoderados = { ...prev };
            delete newApoderados[adquirenteDni];
            return newApoderados;
        });
    };

    const canGenerate = !!tipoActo && !!activeDeedId && adquirentes.length > 0;

    return (
        <div className="space-y-6">
            {/* Mini-Contexto: Inmueble */}
            <div className="rounded-lg bg-muted/30 border border-border px-5 py-3 flex items-center gap-2">
                <Home className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground truncate">
                    {inmuebleLabel || <span className="text-muted-foreground">Sin inmueble vinculado</span>}
                </span>
            </div>

            {/* Selector de tipo de acto */}
            <div className="border border-border rounded-lg bg-background p-5 space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Tipo de Acto
                </h3>
                <Select value={tipoActo} onValueChange={setTipoActo}>
                    <SelectTrigger className="w-full max-w-md">
                        <SelectValue placeholder="Seleccione el tipo de acto a redactar..." />
                    </SelectTrigger>
                    <SelectContent>
                        {MODELOS_ESCRITURA.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                                {m.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

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
                                    <div key={persona?.id || idx} className="flex items-center gap-3 rounded-md border border-border bg-muted/20 px-3 py-2.5">
                                        <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-foreground truncate">
                                                {persona?.nombre_completo || "—"}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {persona?.dni ? `DNI ${persona.dni}` : persona?.cuit ? `CUIT ${persona.cuit}` : "Sin documento"}
                                                {" · "}
                                                <span className="font-medium">{t.rol}</span>
                                            </p>
                                        </div>
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
                                                {a.tipo_persona === "JURIDICA" && " · Persona Jurídica"}
                                                {apoderados[a.dni] && ` · Rep. por: ${apoderados[a.dni].persona.nombre_completo}`}
                                            </p>
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
                                        <div className="mt-2 pl-7">
                                            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
                                                Justificación de Personería (Datos del Poder)
                                            </Label>
                                            <Textarea
                                                className="min-h-[60px] text-xs resize-none"
                                                placeholder="Ej: Escritura de Poder General Nro 123, pasada ante el escribano Juan Perez el 10/10/2023..."
                                                value={apoderados[a.dni].justificativo}
                                                onChange={(e) => {
                                                    setApoderados(prev => ({
                                                        ...prev,
                                                        [a.dni]: {
                                                            ...prev[a.dni],
                                                            justificativo: e.target.value
                                                        }
                                                    }))
                                                }}
                                            />
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
                        onSelect={(person) => {
                            if (!adquirentes.find(a => a.dni === person.dni)) {
                                setAdquirentes(prev => [...prev, person]);
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
                                        justificativo: ""
                                    }
                                }));
                            }
                        }}
                    />
                </div>
            </div>

            {/* ── Generación IA ── */}
            <div className="border border-border rounded-lg bg-background p-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <FileSignature className="h-8 w-8 text-muted-foreground shrink-0" />
                        <div>
                            <h3 className="text-base font-semibold text-foreground">Borrador Inteligente</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {!tipoActo && "Seleccione un tipo de escritura"}
                                {tipoActo && adquirentes.length === 0 && "Agregue al menos un adquirente"}
                                {tipoActo && adquirentes.length > 0 && "Listo para generar"}
                            </p>
                        </div>
                    </div>
                    <Button size="lg" disabled={!canGenerate}>
                        <FileSignature className="h-4 w-4 mr-2" />
                        Generar Borrador con IA
                        <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                </div>
            </div>

            {/* Redacción Manual */}
            {activeDeedId && (
                <details>
                    <summary className="text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1.5">
                        <Pencil className="h-3.5 w-3.5" /> Redacción Manual
                    </summary>
                    <div className="mt-4 h-[500px] overflow-hidden rounded-lg border border-border">
                        <DeedEditor
                            escrituraId={activeDeedId}
                            initialContent={currentEscritura?.contenido_borrador}
                            dataSummary={currentEscritura}
                        />
                    </div>
                </details>
            )}
        </div>
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
