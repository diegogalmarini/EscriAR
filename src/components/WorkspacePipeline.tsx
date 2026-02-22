"use client";

import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FileSignature, ClipboardCheck, Pencil } from "lucide-react";
import { DeedEditor } from "./DeedEditor";
import { MinutaGenerator } from "./MinutaGenerator";
import { AMLCompliance } from "./AMLCompliance";
import { InscriptionTracker } from "./InscriptionTracker";
import { TaxBreakdownCard } from "./smart/TaxBreakdownCard";

interface WorkspacePipelineProps {
    currentEscritura: any;
    activeDeedId: string | null;
    carpetaEstado: string;
    isBlockedBySecurity: boolean;
}

function PhaseHeader({ number, title }: { number: number; title: string }) {
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-3">
                <span className="flex items-center justify-center h-8 w-8 rounded-full bg-foreground text-background text-sm font-bold shrink-0">
                    {number}
                </span>
                <h2 className="text-xl font-semibold text-foreground">{title}</h2>
            </div>
            <Separator />
        </div>
    );
}

export function WorkspacePipeline({
    currentEscritura,
    activeDeedId,
    carpetaEstado,
    isBlockedBySecurity,
}: WorkspacePipelineProps) {
    return (
        <div className="lg:col-span-8 space-y-16">

            {/* ═══ FASE 1: Pre-Escriturario ═══ */}
            <div className="space-y-6">
                <PhaseHeader number={1} title="Control Pre-Escriturario" />

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

                {/* Presupuesto */}
                <TaxBreakdownCard taxData={currentEscritura?.analysis_metadata?.tax_calculation} />
            </div>

            {/* ═══ FASE 2: Redacción ═══ */}
            <div className="space-y-6">
                <PhaseHeader number={2} title="Redacción" />

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

            {/* ═══ FASE 3: Cierre Registral ═══ */}
            <div className="space-y-6">
                <PhaseHeader number={3} title="Cierre Registral" />

                {/* Minuta */}
                <MinutaGenerator data={currentEscritura} isBlocked={isBlockedBySecurity} />

                {/* Compliance */}
                <AMLCompliance escrituraId={activeDeedId!} />

                {/* Inscripción */}
                {(carpetaEstado === 'FIRMADA' || carpetaEstado === 'INSCRIPTA') && (
                    <InscriptionTracker data={currentEscritura} />
                )}
            </div>
        </div>
    );
}
