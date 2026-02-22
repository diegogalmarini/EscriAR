"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Users, Home, Trash2, Pencil, Download, Eye, BookOpen, ChevronDown } from "lucide-react";
import { cn, formatDateInstructions } from "@/lib/utils";
import { formatCUIT, formatPersonName, isLegalEntity } from "@/lib/utils/normalization";

interface WorkspaceRadiographyProps {
    currentEscritura: any;
    optimisticOps: any[];
    storageFiles: any[];
    isLoadingStorage: boolean;
    carpetaEscrituras: any[];
    onEditDeed: (deed: any) => void;
    onEditPerson: (person: any) => void;
    onEditRepresentacion: (data: any) => void;
    onViewDocument: (url: string) => void;
    onDeleteStorageFile: (fileName: string) => void;
    resolveDocumentUrl: (pdfUrl: string) => Promise<string | null>;
}

const getRoleBadgeStyle = (rol?: string) => {
    const r = rol?.toUpperCase();
    if (r?.includes('VENDEDOR') || r?.includes('TRANSMITENTE')) return "bg-amber-100 text-amber-700 border-amber-200";
    if (r?.includes('CEDENTE')) return "bg-orange-100 text-orange-700 border-orange-200";
    if (r?.includes('CESIONARIO')) return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (r?.includes('CONDOMIN')) return "bg-teal-100 text-teal-700 border-teal-200";
    if (r?.includes('DONANTE')) return "bg-amber-100 text-amber-700 border-amber-200";
    if (r?.includes('DONATARIO')) return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (r?.includes('FIDUCIARIA') || r?.includes('FIDUCIANTE')) return "bg-indigo-100 text-indigo-700 border-indigo-200";
    if (r?.includes('ACREEDOR')) return "bg-blue-100 text-blue-700 border-blue-200";
    if (r?.includes('DEUDOR') || r?.includes('MUTUARIO')) return "bg-purple-100 text-purple-700 border-purple-200";
    if (r?.includes('FIADOR') || r?.includes('GARANTE')) return "bg-slate-100 text-slate-700 border-slate-200";
    if (r?.includes('CONYUGE') || r?.includes('CÓNYUGE')) return "bg-pink-100 text-pink-700 border-pink-200";
    if (r?.includes('APODERADO') || r?.includes('REPRESENTANTE')) return "bg-slate-100 text-slate-600 border-slate-200";
    if (r?.includes('COMPRADOR') || r?.includes('ADQUIRENTE')) return "bg-emerald-100 text-emerald-700 border-emerald-200";
    return "bg-gray-100 text-gray-700 border-gray-200";
};

const getRoleLabel = (rol?: string) => {
    const r = rol?.toUpperCase();
    if (r?.includes('VENDEDOR') || r?.includes('TRANSMITENTE')) return 'VENDEDOR / TRANSMITENTE';
    if (r?.includes('CEDENTE')) return 'CEDENTE';
    if (r?.includes('CESIONARIO')) return 'CESIONARIO';
    if (r?.includes('CONDOMIN')) return 'CONDÓMINO';
    if (r?.includes('DONANTE')) return 'DONANTE';
    if (r?.includes('DONATARIO')) return 'DONATARIO';
    if (r?.includes('FIDUCIARIA') || r?.includes('FIDUCIANTE')) return 'FIDUCIARIA';
    if (r?.includes('ACREEDOR')) return 'ACREEDOR HIPOTECARIO';
    if (r?.includes('DEUDOR') || r?.includes('MUTUARIO')) return 'DEUDOR / MUTUARIO';
    if (r?.includes('FIADOR') || r?.includes('GARANTE')) return 'FIADOR / GARANTE';
    if (r?.includes('CONYUGE') || r?.includes('CÓNYUGE')) return 'CÓNYUGE ASINTIENTE';
    if (r?.includes('APODERADO') || r?.includes('REPRESENTANTE')) return 'APODERADO';
    if (r?.includes('COMPRADOR') || r?.includes('ADQUIRENTE')) return 'COMPRADOR / ADQUIRENTE';
    return rol?.toUpperCase() || 'PARTE';
};

const participantOrder = (rol: string = '') => {
    const r = rol.toUpperCase();
    if (r.includes('COMPRADOR') || r.includes('DEUDOR') || r.includes('MUTUARIO') || r.includes('CESIONARIO') || r.includes('DONATARIO')) return 1;
    if (r.includes('VENDEDOR') || r.includes('ACREEDOR') || r.includes('CEDENTE') || r.includes('DONANTE') || r.includes('FIDUCIARIA') || r.includes('HIPOTECARIO')) return 2;
    if (r.includes('CONDOMINO') || r.includes('FIADOR') || r.includes('GARANTE')) return 3;
    if (r.includes('APODERADO') || r.includes('REPRESENTANTE')) return 4;
    return 3;
};

export function WorkspaceRadiography({
    currentEscritura,
    optimisticOps,
    storageFiles,
    isLoadingStorage,
    carpetaEscrituras,
    onEditDeed,
    onEditPerson,
    onEditRepresentacion,
    onViewDocument,
    onDeleteStorageFile,
    resolveDocumentUrl,
}: WorkspaceRadiographyProps) {
    const [expandedTitulo, setExpandedTitulo] = useState(false);
    const [expandedTranscripcion, setExpandedTranscripcion] = useState(false);

    return (
        <div className="space-y-6">

            {/* ── Documento Original ── */}
            {currentEscritura && (
                <div className="border border-border rounded-lg bg-background p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Documento</h3>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => onEditDeed({ ...currentEscritura, operacion: currentEscritura.operaciones?.[0] })}>
                            <Pencil className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                    <div className="space-y-3 text-sm">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs font-medium uppercase text-muted-foreground mb-0.5">Escritura Nº</p>
                                <p className="text-foreground font-semibold text-base">{currentEscritura.nro_protocolo || "—"}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium uppercase text-muted-foreground mb-0.5">Fecha</p>
                                <p className="text-foreground">{currentEscritura.fecha_escritura ? new Date(currentEscritura.fecha_escritura + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) : "—"}</p>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-medium uppercase text-muted-foreground mb-0.5">Escribano</p>
                            <p className="text-foreground">{currentEscritura.notario_interviniente || "—"}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs font-medium uppercase text-muted-foreground mb-0.5">Registro</p>
                                <p className="text-foreground">{currentEscritura.registro || "—"}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium uppercase text-muted-foreground mb-0.5">Código</p>
                                <p className="text-foreground font-mono">{currentEscritura.operaciones?.[0]?.codigo || "—"}</p>
                            </div>
                        </div>
                        <div className="flex gap-2 pt-3 border-t border-border">
                            <Button variant="outline" size="sm" className="text-sm flex-1"
                                onClick={async () => {
                                    if (currentEscritura.pdf_url) {
                                        const url = await resolveDocumentUrl(currentEscritura.pdf_url);
                                        if (url) onViewDocument(url);
                                    }
                                }}>
                                <Eye className="h-3.5 w-3.5 mr-1.5" /> Ver Documento
                            </Button>
                            <Button variant="outline" size="sm" className="text-sm flex-1"
                                onClick={async () => {
                                    if (currentEscritura.pdf_url) {
                                        const url = await resolveDocumentUrl(currentEscritura.pdf_url);
                                        if (url) window.open(url, '_blank');
                                    }
                                }}>
                                <Download className="h-3.5 w-3.5 mr-1.5" /> Descargar
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Inmueble ── */}
            {currentEscritura?.inmuebles && (
                <div className="border border-border rounded-lg bg-background p-6 space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Home className="h-4 w-4" /> Inmueble
                    </h3>
                    <div className="space-y-3 text-sm">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs font-medium uppercase text-muted-foreground mb-0.5">Partido</p>
                                <p className="text-foreground">{currentEscritura.inmuebles.partido_id || "—"}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium uppercase text-muted-foreground mb-0.5">Partida</p>
                                <p className="text-foreground font-mono">
                                    {currentEscritura.inmuebles.id ? (
                                        <Link href={`/inmuebles/${currentEscritura.inmuebles.id}`} className="text-blue-600 hover:underline">
                                            {currentEscritura.inmuebles.nro_partida || "—"}
                                        </Link>
                                    ) : (currentEscritura.inmuebles.nro_partida || "—")}
                                </p>
                            </div>
                        </div>
                        {currentEscritura.inmuebles.nomenclatura && (
                            <div>
                                <p className="text-xs font-medium uppercase text-muted-foreground mb-0.5">Nomenclatura</p>
                                <p className="text-sm text-muted-foreground leading-snug">{currentEscritura.inmuebles.nomenclatura}</p>
                            </div>
                        )}
                    </div>

                    {/* Título Antecedente — visible, line-clamp con "Ver más" */}
                    {currentEscritura.inmuebles.titulo_antecedente && (
                        <div className="space-y-2">
                            <p className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-1.5">
                                <BookOpen className="h-3.5 w-3.5" /> Título Antecedente
                            </p>
                            <p className={cn(
                                "text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap select-text border-l-2 border-border pl-3",
                                !expandedTitulo && "line-clamp-4"
                            )}>
                                {currentEscritura.inmuebles.titulo_antecedente}
                            </p>
                            {currentEscritura.inmuebles.titulo_antecedente.length > 200 && (
                                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-6 px-2"
                                    onClick={() => setExpandedTitulo(!expandedTitulo)}>
                                    <ChevronDown className={cn("h-3 w-3 mr-1 transition-transform", expandedTitulo && "rotate-180")} />
                                    {expandedTitulo ? "Ver menos" : "Ver más"}
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Transcripción Literal — visible, line-clamp con "Ver más" */}
                    {currentEscritura.inmuebles.transcripcion_literal && (
                        <div className="space-y-2">
                            <p className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5" /> Transcripción Literal
                            </p>
                            <p className={cn(
                                "text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap select-text border-l-2 border-border pl-3",
                                !expandedTranscripcion && "line-clamp-4"
                            )}>
                                {currentEscritura.inmuebles.transcripcion_literal}
                            </p>
                            {currentEscritura.inmuebles.transcripcion_literal.length > 200 && (
                                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-6 px-2"
                                    onClick={() => setExpandedTranscripcion(!expandedTranscripcion)}>
                                    <ChevronDown className={cn("h-3 w-3 mr-1 transition-transform", expandedTranscripcion && "rotate-180")} />
                                    {expandedTranscripcion ? "Ver menos" : "Ver más"}
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Partes Intervinientes — Descolapsadas ── */}
            <div className="border border-border rounded-lg bg-background p-6 space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4" /> Partes Intervinientes
                </h3>
                <div className="space-y-3">
                    {optimisticOps.flatMap((op: any) => {
                        const sorted = [...(op.participantes_operacion || [])].sort(
                            (a: any, b: any) => participantOrder(a.rol) - participantOrder(b.rol)
                        );
                        return sorted.map((p: any) => {
                            const person = p.persona || p.personas;
                            if (!person) return null;
                            const getSpouseName = (per: any) => {
                                if (per.datos_conyuge?.nombre || per.datos_conyuge?.nombre_completo) return per.datos_conyuge.nombre || per.datos_conyuge.nombre_completo;
                                const match = per.estado_civil_detalle?.match(/con\s+([A-ZÁÉÍÓÚÑa-záéíóúñ\s]+)/i);
                                return match?.[1]?.trim() || null;
                            };
                            const spouseName = getSpouseName(person);

                            return (
                                <div key={p.id} className="border border-border rounded-lg p-4 space-y-3">
                                    {/* Header: Rol + Nombre + Edit */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="space-y-1 min-w-0 flex-1">
                                            <Badge variant="outline" className={cn("text-xs px-2 py-0.5 font-semibold", getRoleBadgeStyle(p.rol))}>
                                                {getRoleLabel(p.rol)}
                                            </Badge>
                                            <p className="text-base font-semibold text-foreground leading-tight">
                                                {isLegalEntity(person) ? person.nombre_completo?.toUpperCase() : formatPersonName(person.nombre_completo)}
                                            </p>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
                                            onClick={() => onEditPerson(person)}>
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>

                                    {/* Always-visible: DNI + CUIT */}
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        {!isLegalEntity(person) && (
                                            <div>
                                                <p className="text-xs font-medium uppercase text-muted-foreground">DNI</p>
                                                <p className="font-medium text-foreground">{person.dni || "—"}</p>
                                            </div>
                                        )}
                                        <div className={isLegalEntity(person) ? "col-span-2" : ""}>
                                            <p className="text-xs font-medium uppercase text-muted-foreground">CUIT/CUIL</p>
                                            <p className="font-medium text-foreground">{formatCUIT(person.cuit) || "—"}</p>
                                        </div>
                                    </div>

                                    {/* Extra details */}
                                    {!isLegalEntity(person) && (
                                        <div className="space-y-2 text-sm text-muted-foreground border-t border-border pt-3">
                                            <p>
                                                {person.nacionalidad || "—"} &middot; Nac: {formatDateInstructions(person.fecha_nacimiento)}
                                            </p>
                                            {person.estado_civil_detalle && (
                                                <p>Estado civil: {person.estado_civil_detalle}</p>
                                            )}
                                            {spouseName && (
                                                <p>Cónyuge: <span className="text-foreground font-medium">{formatPersonName(spouseName)}</span></p>
                                            )}
                                            {person.nombres_padres && (
                                                <p>Filiación: {person.nombres_padres}</p>
                                            )}
                                            {person.domicilio_real?.literal && (
                                                <p className="italic">Domicilio: {person.domicilio_real.literal}</p>
                                            )}
                                        </div>
                                    )}
                                    {isLegalEntity(person) && (
                                        <p className="text-sm text-muted-foreground border-t border-border pt-3">
                                            Persona Jurídica &middot; Const: {formatDateInstructions(person.fecha_nacimiento)}
                                        </p>
                                    )}

                                    {/* Representación */}
                                    {(p.datos_representacion || p.rol?.toUpperCase().includes('APODERADO')) && (
                                        <div className="bg-muted/30 rounded-md p-3 space-y-1 text-sm">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="text-xs font-medium uppercase text-muted-foreground">Representando a</p>
                                                    <p className="text-foreground font-medium">{p.datos_representacion?.representa_a || "—"}</p>
                                                </div>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground shrink-0"
                                                    onClick={() => onEditRepresentacion({ participanteId: p.id, ...p.datos_representacion })}>
                                                    <Pencil className="h-3 w-3" />
                                                </Button>
                                            </div>
                                            {p.datos_representacion?.poder_detalle && (
                                                <p className="text-muted-foreground italic text-sm">{p.datos_representacion.poder_detalle}</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        });
                    })}
                    {carpetaEscrituras?.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-6">Sin partes extraídas</p>
                    )}
                </div>
            </div>

            {/* ── Archivos ── */}
            <div className="border border-border rounded-lg bg-background p-6 space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Archivos
                </h3>
                <div className="space-y-2">
                    {storageFiles.map((file) => {
                        const isLinked = carpetaEscrituras?.some((e: any) => e.pdf_url?.includes(file.name));
                        return (
                            <div key={file.id} className="flex items-center justify-between py-2 group">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <FileText className={cn("h-4 w-4 shrink-0", isLinked ? "text-muted-foreground" : "text-amber-500")} />
                                    <p className="text-sm truncate text-foreground">{file.name.replace(/^\d{13}_/, "")}</p>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                                    {!isLinked && (
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500"
                                            onClick={() => onDeleteStorageFile(file.name)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground"
                                        onClick={async () => {
                                            const doc = carpetaEscrituras?.find((e: any) => e.pdf_url?.includes(file.name));
                                            if (doc?.pdf_url) {
                                                const url = await resolveDocumentUrl(doc.pdf_url);
                                                if (url) onViewDocument(url);
                                            }
                                        }}>
                                        <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                    {storageFiles.length === 0 && !isLoadingStorage && (
                        <p className="text-sm text-muted-foreground text-center py-4 italic">Sin archivos</p>
                    )}
                </div>
            </div>
        </div>
    );
}
