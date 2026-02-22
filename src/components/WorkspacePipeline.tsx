"use client";

import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileSignature, ClipboardCheck, Pencil, DollarSign } from "lucide-react";
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

export function FaseRedaccion({ currentEscritura, activeDeedId }: FaseRedaccionProps) {
    return (
        <div className="space-y-6">
            {/* Borrador Inteligente */}
            <div className="border border-border rounded-lg bg-background p-8">
                <div className="text-center space-y-4">
                    <FileSignature className="h-10 w-10 text-muted-foreground mx-auto" />
                    <div>
                        <h3 className="text-base font-semibold text-foreground">Borrador Inteligente</h3>
                        <p className="text-sm text-muted-foreground mt-1">Genera un borrador de escritura basado en los datos extraídos</p>
                    </div>
                    <Button size="lg" className="mt-2" disabled={!activeDeedId}>
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
