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
import { FileSignature, ClipboardCheck, Pencil, DollarSign, Home, Users } from "lucide-react";
import { DeedEditor } from "./DeedEditor";
import { MinutaGenerator } from "./MinutaGenerator";
import { AMLCompliance } from "./AMLCompliance";
import { InscriptionTracker } from "./InscriptionTracker";
import { TaxBreakdownCard } from "./smart/TaxBreakdownCard";

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
   Borrador Inteligente (IA) + DeedEditor manual
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

    // Extraer inmueble principal y titulares/transmitentes
    const inmueble = currentEscritura?.inmuebles;
    const participantes = currentEscritura?.operaciones?.flatMap(
        (op: any) => op.participantes_operacion || []
    ) || [];
    const titulares = participantes.filter((p: any) => {
        const rol = p.rol?.toUpperCase() || "";
        return rol.includes("VENDEDOR") || rol.includes("TRANSMITENTE") ||
               rol.includes("CEDENTE") || rol.includes("DONANTE") || rol.includes("PODERDANTE");
    });

    const inmuebleLabel = inmueble
        ? [inmueble.partido_id, inmueble.nro_partida ? `Partida ${inmueble.nro_partida}` : null].filter(Boolean).join(" · ")
        : null;

    const titularesLabel = titulares.length > 0
        ? titulares.map((t: any) => t.persona?.nombre_completo || "—").join(", ")
        : null;

    return (
        <div className="space-y-6">
            {/* Mini-Contexto */}
            <div className="rounded-lg bg-muted/30 border border-border px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                <div className="flex items-center gap-2 min-w-0">
                    <Home className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground truncate">
                        {inmuebleLabel || <span className="text-muted-foreground">Sin inmueble vinculado</span>}
                    </span>
                </div>
                <div className="hidden sm:block h-4 w-px bg-border shrink-0" />
                <div className="flex items-center gap-2 min-w-0">
                    <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground truncate">
                        {titularesLabel || <span className="text-muted-foreground">Sin partes vinculadas</span>}
                    </span>
                </div>
            </div>

            {/* Borrador Inteligente */}
            <div className="border border-border rounded-lg bg-background p-8">
                <div className="text-center space-y-5">
                    <FileSignature className="h-10 w-10 text-muted-foreground mx-auto" />
                    <div>
                        <h3 className="text-base font-semibold text-foreground">Borrador Inteligente</h3>
                        <p className="text-sm text-muted-foreground mt-1">Genera un borrador de escritura basado en los datos extraídos</p>
                    </div>

                    {/* Selector de tipo de acto */}
                    <div className="max-w-sm mx-auto">
                        <Select value={tipoActo} onValueChange={setTipoActo}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Seleccione el tipo de escritura a redactar..." />
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

                    <Button size="lg" className="mt-2" disabled={!activeDeedId || !tipoActo}>
                        <FileSignature className="h-4 w-4 mr-2" />
                        Generar Borrador con IA
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
