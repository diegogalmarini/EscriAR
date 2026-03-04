"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Activity, Download } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PersonForm } from "./PersonForm";
import { formatPersonName } from "@/lib/utils/normalization";
import { updateEscritura, updateOperacion, updateInmueble } from "@/app/actions/escritura";
import { updateRepresentacion } from "@/app/actions/carpeta";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

// ── Edit Person Dialog ──
export function EditPersonDialog({
    editingPerson,
    onClose,
    onSaved,
}: {
    editingPerson: any;
    onClose: () => void;
    onSaved: () => void;
}) {
    return (
        <Dialog open={!!editingPerson} onOpenChange={() => onClose()}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Editar Persona</DialogTitle>
                    <DialogDescription>
                        Modifica los datos personales y filiatorios. Los cambios se aplicarán globalmente.
                    </DialogDescription>
                </DialogHeader>
                {editingPerson && (
                    <PersonForm
                        initialData={editingPerson}
                        onSuccess={() => {
                            onClose();
                            onSaved();
                        }}
                        onCancel={onClose}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

// ── Edit Representacion Dialog ──
export function EditRepresentacionDialog({
    editingRepresentacion,
    onClose,
    onSaved,
}: {
    editingRepresentacion: any;
    onClose: () => void;
    onSaved: () => void;
}) {
    return (
        <Dialog open={!!editingRepresentacion} onOpenChange={() => onClose()}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Editar Representación</DialogTitle>
                    <DialogDescription>
                        Datos del poder y la persona/entidad representada.
                    </DialogDescription>
                </DialogHeader>
                {editingRepresentacion && (
                    <form
                        onSubmit={async (e) => {
                            e.preventDefault();
                            const form = e.target as HTMLFormElement;
                            const formData = new FormData(form);
                            const result = await updateRepresentacion(
                                editingRepresentacion.participanteId,
                                {
                                    representa_a: formData.get('representa_a') as string,
                                    caracter: formData.get('caracter') as string,
                                    poder_detalle: formData.get('poder_detalle') as string,
                                }
                            );
                            if (result.success) {
                                toast.success('Representación actualizada');
                                onClose();
                                onSaved();
                            } else {
                                toast.error(result.error || 'Error al actualizar');
                            }
                        }}
                        className="space-y-4"
                    >
                        <div className="space-y-2">
                            <Label htmlFor="representa_a">Representando a</Label>
                            <Input
                                id="representa_a"
                                name="representa_a"
                                defaultValue={editingRepresentacion.representa_a || ''}
                                placeholder="Ej: BANCO DE LA NACION ARGENTINA"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="caracter">Carácter</Label>
                            <Input
                                id="caracter"
                                name="caracter"
                                defaultValue={editingRepresentacion.caracter || ''}
                                placeholder="Ej: Apoderado, Presidente, Socio Gerente"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="poder_detalle">Poder Otorgado</Label>
                            <Textarea
                                id="poder_detalle"
                                name="poder_detalle"
                                rows={4}
                                defaultValue={editingRepresentacion.poder_detalle || ''}
                                placeholder="Ej: poder general amplio conferido por escritura número 100 de fecha 21/03/2018, ante escribano Santiago Alvarez Fourcade, folio 733 del Registro a su cargo"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={onClose}>
                                Cancelar
                            </Button>
                            <Button type="submit">
                                Guardar
                            </Button>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ── Transcription Dialog ──
export function TranscriptionDialog({
    open,
    onOpenChange,
    transcripcion,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    transcripcion?: string;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Transcripción Literal Completa del Inmueble</DialogTitle>
                    <DialogDescription>
                        Descripción técnica completa del inmueble extraída del documento original.
                    </DialogDescription>
                </DialogHeader>
                <div className="mt-4">
                    {transcripcion ? (
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                                {transcripcion}
                            </p>
                        </div>
                    ) : (
                        <div className="p-8 text-center text-slate-500">
                            <p className="text-sm">No hay transcripción literal disponible para este documento.</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ── Edit Deed Metadata Dialog ──
export function EditDeedDialog({
    editingDeed,
    onClose,
    onSaved,
}: {
    editingDeed: any;
    onClose: () => void;
    onSaved: () => void;
}) {
    return (
        <Dialog open={!!editingDeed} onOpenChange={() => onClose()}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Editar Datos del Documento</DialogTitle>
                    <DialogDescription>
                        Modifica los metadatos extraídos por IA. Los cambios se guardarán en la base de datos.
                    </DialogDescription>
                </DialogHeader>
                {editingDeed && (
                    <form
                        onSubmit={async (e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);

                            const escrituraResult = await updateEscritura(editingDeed.id, {
                                nro_protocolo: formData.get("nro_protocolo") ? parseInt(formData.get("nro_protocolo") as string) : null,
                                fecha_escritura: formData.get("fecha_escritura") as string || null,
                                notario_interviniente: formData.get("notario_interviniente") as string || null,
                                registro: formData.get("registro") as string || null,
                            });

                            if (editingDeed.operacion?.id) {
                                await updateOperacion(editingDeed.operacion.id, {
                                    tipo_acto: formData.get("tipo_acto") as string,
                                    codigo: formData.get("codigo") as string || null,
                                });
                            }

                            if (editingDeed.inmuebles?.id) {
                                await updateInmueble(editingDeed.inmuebles.id, {
                                    partido_id: formData.get("partido_id") as string,
                                    nro_partida: formData.get("nro_partida") as string,
                                });
                            }

                            if (escrituraResult.success) {
                                toast.success("Datos actualizados correctamente");
                                onClose();
                                onSaved();
                            } else {
                                toast.error("Error al actualizar: " + escrituraResult.error);
                            }
                        }}
                        className="space-y-4 mt-4"
                    >
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-slate-700">Datos del Inmueble</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="partido_id">Partido / Dpto</Label>
                                    <Input id="partido_id" name="partido_id" defaultValue={editingDeed.inmuebles?.partido_id || ""} placeholder="Ej: Bahía Blanca" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="nro_partida">Nro. Partida</Label>
                                    <Input id="nro_partida" name="nro_partida" defaultValue={editingDeed.inmuebles?.nro_partida || ""} placeholder="Ej: 186.636" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-slate-700">Datos de la Operación</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="tipo_acto">Tipo de Acto</Label>
                                    <Input id="tipo_acto" name="tipo_acto" defaultValue={editingDeed.operacion?.tipo_acto || "COMPRAVENTA"} placeholder="Ej: COMPRAVENTA" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="codigo">Código</Label>
                                    <Input id="codigo" name="codigo" defaultValue={editingDeed.operacion?.codigo || ""} placeholder="Ej: 100-00" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-slate-700">Datos de la Escritura</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="nro_protocolo">Escritura Nº</Label>
                                    <Input id="nro_protocolo" name="nro_protocolo" type="number" defaultValue={editingDeed.nro_protocolo || ""} placeholder="Ej: 240" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="fecha_escritura">Fecha</Label>
                                    <Input id="fecha_escritura" name="fecha_escritura" type="date" defaultValue={editingDeed.fecha_escritura || ""} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="notario_interviniente">Escribano</Label>
                                <Input id="notario_interviniente" name="notario_interviniente" defaultValue={editingDeed.notario_interviniente || ""} placeholder="Nombre completo del escribano" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="registro">Registro número</Label>
                                <Input id="registro" name="registro" defaultValue={editingDeed.registro || ""} placeholder="Ej: Registro 30 de Bahía Blanca" />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                            <Button type="submit">Guardar Cambios</Button>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ── Document Viewer Dialog ──
export function DocumentViewerDialog({
    viewingDocument,
    onClose,
}: {
    viewingDocument: string | null;
    onClose: () => void;
}) {
    const [viewerWidth, setViewerWidth] = useState(95);

    const handleResize = (startX: number, direction: 'left' | 'right') => (e: React.MouseEvent) => {
        e.preventDefault();
        const onMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = direction === 'right'
                ? moveEvent.clientX - startX
                : startX - moveEvent.clientX;
            const deltaVw = (deltaX / window.innerWidth) * 100 * 2;
            setViewerWidth(prev => Math.min(98, Math.max(40, 95 + deltaVw)));
        };
        const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    };

    return (
        <Dialog open={!!viewingDocument} onOpenChange={() => onClose()}>
            <DialogContent
                className="max-h-[96vh] h-[96vh] p-0 overflow-hidden bg-white border-slate-200 transition-none"
                style={{ maxWidth: `${viewerWidth}vw`, width: `${viewerWidth}vw` }}
                showCloseButton={false}
            >
                <div className="relative w-full h-full flex flex-col">
                    {/* Resizer handles */}
                    <div
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400/30 transition-colors z-50 group"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            const startX = e.clientX;
                            const startWidth = viewerWidth;
                            const onMouseMove = (moveEvent: MouseEvent) => {
                                const deltaX = moveEvent.clientX - startX;
                                const deltaVw = (deltaX / window.innerWidth) * 100 * 2;
                                const newWidth = Math.min(98, Math.max(40, startWidth + deltaVw));
                                setViewerWidth(newWidth);
                            };
                            const onMouseUp = () => {
                                document.removeEventListener("mousemove", onMouseMove);
                                document.removeEventListener("mouseup", onMouseUp);
                            };
                            document.addEventListener("mousemove", onMouseMove);
                            document.addEventListener("mouseup", onMouseUp);
                        }}
                    >
                        <div className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 w-0.5 h-8 bg-slate-300 group-hover:bg-blue-400 rounded-full" />
                    </div>
                    <div
                        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400/30 transition-colors z-50 group"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            const startX = e.clientX;
                            const startWidth = viewerWidth;
                            const onMouseMove = (moveEvent: MouseEvent) => {
                                const deltaX = startX - moveEvent.clientX;
                                const deltaVw = (deltaX / window.innerWidth) * 100 * 2;
                                const newWidth = Math.min(98, Math.max(40, startWidth + deltaVw));
                                setViewerWidth(newWidth);
                            };
                            const onMouseUp = () => {
                                document.removeEventListener("mousemove", onMouseMove);
                                document.removeEventListener("mouseup", onMouseUp);
                            };
                            document.addEventListener("mousemove", onMouseMove);
                            document.addEventListener("mouseup", onMouseUp);
                        }}
                    >
                        <div className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 w-0.5 h-8 bg-slate-300 group-hover:bg-blue-400 rounded-full" />
                    </div>

                    {/* Header */}
                    <div className="flex justify-between items-center p-3 bg-white border-b border-slate-200 text-slate-900">
                        <h3 className="text-sm font-semibold truncate pr-10 flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-600" />
                            {(() => {
                                if (!viewingDocument) return "Cargando...";
                                const rawName = viewingDocument.split('/').pop()?.split('?')[0] || "";
                                return rawName.replace(/^\d{13}_/, "");
                            })()}
                        </h3>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </Button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 bg-slate-100 flex justify-center items-center overflow-hidden p-0">
                        {viewingDocument && (() => {
                            const isPdf = viewingDocument.toLowerCase().includes(".pdf");
                            const isDocx = viewingDocument.toLowerCase().includes(".docx") || viewingDocument.toLowerCase().includes(".doc");

                            if (isPdf) {
                                return (
                                    <iframe
                                        src={viewingDocument}
                                        className="w-full h-full bg-white shadow-sm border-none"
                                        title="PDF Viewer"
                                    />
                                );
                            }

                            if (isDocx) {
                                return (
                                    <div className="w-full max-w-5xl h-full flex flex-col items-center justify-center gap-6 p-8">
                                        <div className="w-full flex-1 relative bg-white shadow-sm border rounded-xl overflow-hidden min-h-[400px]">
                                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 z-0">
                                                <Activity className="h-8 w-8 text-blue-500 animate-spin mb-4" />
                                                <p className="text-sm font-medium text-slate-600">Abriendo vista previa externa...</p>
                                                <p className="text-[10px] text-slate-400 mt-1">Los documentos Word pueden demorar unos segundos en renderizarse.</p>
                                            </div>
                                            <iframe
                                                src={`https://docs.google.com/viewer?url=${encodeURIComponent(viewingDocument)}&embedded=true`}
                                                className="relative w-full h-full bg-white z-10"
                                                title="Document Viewer"
                                            />
                                        </div>
                                        <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-2xl border shadow-sm w-full max-w-md">
                                            <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
                                                <Download size={24} />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm font-bold text-slate-800">¿El documento no carga?</p>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    Debido a restricciones de seguridad de los archivos Word, a veces el visor externo no puede acceder al documento privado.
                                                </p>
                                            </div>
                                            <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
                                                <a href={viewingDocument} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                                    <Download size={16} />
                                                    Descargar y Abrir Original
                                                </a>
                                            </Button>
                                            <p className="text-[10px] text-slate-400">
                                                Recomendación: Convierte tus archivos a PDF antes de subirlos para una visualización instantánea.
                                            </p>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div className="text-center p-10 bg-white rounded-lg shadow-sm border border-slate-200">
                                    <p className="text-slate-600 mb-4">El visualizador no es compatible con este tipo de archivo.</p>
                                    <Button asChild variant="outline">
                                        <a href={viewingDocument} target="_blank">Descargar Archivo</a>
                                    </Button>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ── Conflict Resolution Dialog ──
export function ConflictResolutionDialog({
    open,
    onOpenChange,
    conflicts,
    onResolve,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    conflicts: any[];
    onResolve: (resolutions: any[]) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-amber-600">
                        <Activity className="h-5 w-5" />
                        Detección de Cambios en Datos Maestros
                    </DialogTitle>
                    <DialogDescription>
                        El sistema detectó que existen registros previos para estas entidades, pero con datos diferentes en el nuevo documento.
                        Por favor, verifica qué versión deseas mantener.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 my-4">
                    {conflicts.map((conflict: any, idx: number) => (
                        <div key={idx} className="border rounded-xl p-4 bg-slate-50 space-y-3">
                            <div className="flex items-center justify-between">
                                <Badge variant="outline" className="bg-amber-100 text-amber-700">
                                    {conflict.type === 'PERSONA' ? 'CLIENTE / ENTIDAD' : 'INMUEBLE'}
                                </Badge>
                                <span className="text-xs font-mono text-slate-500">ID: {conflict.id}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <p className="text-[10px] uppercase font-bold text-slate-400">Dato Anterior (Base de Datos)</p>
                                    <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs">
                                        {conflict.type === 'PERSONA' ? (
                                            <div className="space-y-1">
                                                <p className="font-bold">{formatPersonName(conflict.existing.nombre_completo)}</p>
                                                <p>Domicilio: {conflict.existing.domicilio_real?.literal || 'No informado'}</p>
                                                <p>Estado Civil: {conflict.existing.estado_civil_detalle || 'No informado'}</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                <p className="font-bold">Partido: {conflict.existing.partido_id}</p>
                                                <p>Partida: {conflict.existing.nro_partida}</p>
                                                <p className="italic text-slate-500 line-clamp-2">{conflict.existing.transcripcion_literal}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-[10px] uppercase font-bold text-blue-400">Dato Nuevo (Extraído de Documento Analizado)</p>
                                    <div className="p-3 bg-blue-50/30 border border-blue-200 rounded-lg text-xs ring-2 ring-blue-500/20">
                                        {conflict.type === 'PERSONA' ? (
                                            <div className="space-y-1">
                                                <p className="font-bold text-blue-700">{formatPersonName(conflict.extracted.nombre_completo)}</p>
                                                <p>Domicilio: <span className="font-bold">{conflict.extracted.domicilio_real?.literal || 'No informado'}</span></p>
                                                <p>Estado Civil: <span className="font-bold">{conflict.extracted.estado_civil_detalle || 'No informado'}</span></p>
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                <p className="font-bold text-blue-700">Partido: {conflict.extracted.partido}</p>
                                                <p>Partida: {conflict.extracted.partida_inmobiliaria}</p>
                                                <p className="italic text-slate-500 line-clamp-2">{conflict.extracted.transcripcion_literal}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-end gap-3 mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Resolver más tarde</Button>
                    <Button
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                        onClick={() => onResolve([])}
                    >
                        Aplicar Todos los Cambios
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
