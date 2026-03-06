"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, X, Loader2, CheckCircle2, AlertCircle, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import {
    ProtocoloRegistro,
    ProtocoloRegistroInsert,
    EscrituraExtractionData,
    createProtocoloRegistro,
    updateProtocoloRegistro,
    uploadEscrituraPdf,
    confirmEscrituraExtraction,
    retryEscrituraExtraction,
    getProtocoloRegistro,
} from "@/app/actions/protocolo";
import { toast } from "sonner";
import { classifyActo } from "@/lib/actClassifier";

interface EscrituraDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    registro?: ProtocoloRegistro;
    anio: number;
    nextNro: number;
    onSuccess: () => void;
}

const EMPTY_FORM: Omit<ProtocoloRegistroInsert, "anio"> = {
    nro_escritura: null,
    folios: "",
    dia: null,
    mes: null,
    tipo_acto: "",
    es_errose: false,
    vendedor_acreedor: "",
    comprador_deudor: "",
    codigo_acto: "",
    notas: "",
};

export function EscrituraDialog({ open, onOpenChange, registro, anio, nextNro, onSuccess }: EscrituraDialogProps) {
    const [loading, setLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [formData, setFormData] = useState<Omit<ProtocoloRegistroInsert, "anio">>({ ...EMPTY_FORM, nro_escritura: nextNro });
    const [liveRegistro, setLiveRegistro] = useState<ProtocoloRegistro | undefined>(registro);
    const [showEvidence, setShowEvidence] = useState(false);

    // Reset form when dialog opens/closes or registro changes
    useEffect(() => {
        if (registro) {
            setFormData({
                nro_escritura: registro.nro_escritura,
                folios: registro.folios || "",
                dia: registro.dia,
                mes: registro.mes,
                tipo_acto: registro.tipo_acto || "",
                es_errose: registro.es_errose,
                vendedor_acreedor: registro.vendedor_acreedor || "",
                comprador_deudor: registro.comprador_deudor || "",
                codigo_acto: registro.codigo_acto || "",
                notas: registro.notas || "",
            });
            setLiveRegistro(registro);
        } else {
            setFormData({ ...EMPTY_FORM, nro_escritura: nextNro });
            setLiveRegistro(undefined);
        }
        setSelectedFile(null);
        setShowEvidence(false);
    }, [registro, nextNro, open]);

    // Poll for extraction updates
    useEffect(() => {
        if (!open || !liveRegistro?.id) return;
        const status = liveRegistro.extraction_status;
        if (status !== "PENDIENTE" && status !== "PROCESANDO") return;

        const interval = setInterval(async () => {
            try {
                const updated = await getProtocoloRegistro(liveRegistro.id);
                setLiveRegistro(updated);

                // Auto-fill form from extraction if COMPLETADO
                if (updated.extraction_status === "COMPLETADO" && updated.extraction_data) {
                    const ex = updated.extraction_data;
                    setFormData(prev => ({
                        ...prev,
                        nro_escritura: prev.nro_escritura || ex.nro_escritura || prev.nro_escritura,
                        tipo_acto: prev.tipo_acto || ex.tipo_acto || prev.tipo_acto,
                        vendedor_acreedor: prev.vendedor_acreedor || ex.vendedor_acreedor || prev.vendedor_acreedor,
                        comprador_deudor: prev.comprador_deudor || ex.comprador_deudor || prev.comprador_deudor,
                        codigo_acto: prev.codigo_acto || ex.codigo_acto || prev.codigo_acto,
                        dia: prev.dia ?? (ex.fecha ? parseInt(ex.fecha.split("-")[2]) : null),
                        mes: prev.mes ?? (ex.fecha ? parseInt(ex.fecha.split("-")[1]) : null),
                    }));
                }
            } catch { /* ignore polling errors */ }
        }, 5000);

        return () => clearInterval(interval);
    }, [open, liveRegistro?.id, liveRegistro?.extraction_status]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const numFields = ["nro_escritura", "dia", "mes"];
        setFormData(prev => {
            const next = {
                ...prev,
                [name]: numFields.includes(name) ? (value ? parseInt(value) : null) : value || null,
            };
            // Auto-suggest codigo_acto when tipo_acto changes
            if (name === "tipo_acto" && value) {
                const suggested = classifyActo(value);
                if (suggested && !prev.codigo_acto) {
                    next.codigo_acto = suggested;
                }
            }
            return next;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload: ProtocoloRegistroInsert = {
                ...formData,
                anio,
                vendedor_acreedor: formData.vendedor_acreedor || null,
                comprador_deudor: formData.comprador_deudor || null,
                tipo_acto: formData.tipo_acto || null,
                folios: formData.folios || null,
                codigo_acto: formData.codigo_acto || null,
                notas: formData.notas || null,
            };

            let saved: ProtocoloRegistro;
            if (registro?.id) {
                saved = await updateProtocoloRegistro(registro.id, payload);
            } else {
                saved = await createProtocoloRegistro(payload);
            }

            // Upload PDF if selected
            if (selectedFile && saved.id) {
                const fd = new FormData();
                fd.append("file", selectedFile);
                saved = await uploadEscrituraPdf(saved.id, fd);
                setLiveRegistro(saved);
                toast.success("PDF subido — extracción IA en curso...");
                // Don't close dialog — let user see extraction progress
                setLoading(false);
                return;
            }

            toast.success(registro?.id ? "Registro actualizado" : "Escritura creada");
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Error al guardar");
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmExtraction = async () => {
        if (!liveRegistro?.id) return;
        try {
            await confirmEscrituraExtraction(liveRegistro.id, {
                nro_escritura: formData.nro_escritura,
                dia: formData.dia,
                mes: formData.mes,
                tipo_acto: formData.tipo_acto || null,
                vendedor_acreedor: formData.vendedor_acreedor || null,
                comprador_deudor: formData.comprador_deudor || null,
                codigo_acto: formData.codigo_acto || null,
                notas: formData.notas || null,
            });
            toast.success("Extracción confirmada");
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            toast.error(error.message || "Error al confirmar");
        }
    };

    const handleRetry = async () => {
        if (!liveRegistro?.id) return;
        try {
            const updated = await retryEscrituraExtraction(liveRegistro.id);
            setLiveRegistro(updated);
            toast.info("Re-analizando PDF...");
        } catch (error: any) {
            toast.error(error.message || "Error al reintentar");
        }
    };

    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) setSelectedFile(file);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setSelectedFile(file);
    };

    const isEditing = !!registro?.id;
    const extractionStatus = liveRegistro?.extraction_status ?? null;
    const extractionData = liveRegistro?.extraction_data ?? null;
    const extractionEvidence = liveRegistro?.extraction_evidence ?? null;
    const isExtracting = extractionStatus === "PENDIENTE" || extractionStatus === "PROCESANDO";
    const isExtracted = extractionStatus === "COMPLETADO";
    const isConfirmed = !!liveRegistro?.confirmed_at;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {isEditing
                            ? formData.es_errose
                                ? `Editar Errose (folios ${formData.folios || "..."})`
                                : `Editar Escritura N° ${formData.nro_escritura || "..."}`
                            : "Nueva Escritura"
                        }
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    {/* Row 1: Nro + Folios */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>N° Escritura</Label>
                            <Input
                                type="number"
                                name="nro_escritura"
                                value={formData.nro_escritura ?? ""}
                                onChange={handleChange}
                                placeholder={formData.es_errose ? "Opcional" : "Ej: 15"}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Folios</Label>
                            <Input
                                name="folios"
                                value={formData.folios || ""}
                                onChange={handleChange}
                                placeholder="Ej: 001/005"
                            />
                            <p className="text-[10px] text-slate-500">
                                Ingresá manualmente (no se extrae del PDF).
                            </p>
                        </div>
                    </div>

                    {/* Row 2: Día + Mes + Año */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Día</Label>
                            <Input
                                type="number"
                                name="dia"
                                min={1}
                                max={31}
                                value={formData.dia ?? ""}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Mes</Label>
                            <Input
                                type="number"
                                name="mes"
                                min={1}
                                max={12}
                                value={formData.mes ?? ""}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Año</Label>
                            <Input
                                type="number"
                                value={anio}
                                disabled
                                className="bg-slate-50"
                            />
                        </div>
                    </div>

                    {/* Row 3: Tipo Acto + Código */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Tipo de Acto</Label>
                            <Input
                                name="tipo_acto"
                                value={formData.tipo_acto || ""}
                                onChange={handleChange}
                                placeholder="Ej: Compraventa"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Código Acto</Label>
                            <Input
                                name="codigo_acto"
                                value={formData.codigo_acto || ""}
                                onChange={handleChange}
                                placeholder="Ej: 1.1.1"
                            />
                        </div>
                    </div>

                    {/* Row 4: Vendedor */}
                    <div className="space-y-2">
                        <Label>Vendedor / Acreedor / Poderdante</Label>
                        <Input
                            name="vendedor_acreedor"
                            value={formData.vendedor_acreedor || ""}
                            onChange={handleChange}
                            placeholder="Nombre(s)..."
                        />
                    </div>

                    {/* Row 5: Comprador */}
                    <div className="space-y-2">
                        <Label>Comprador / Deudor / Apoderado</Label>
                        <Input
                            name="comprador_deudor"
                            value={formData.comprador_deudor || ""}
                            onChange={handleChange}
                            placeholder="Nombre(s)..."
                        />
                    </div>

                    {/* Errose checkbox */}
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="es_errose"
                            checked={formData.es_errose}
                            onCheckedChange={(checked) => {
                                setFormData(prev => ({
                                    ...prev,
                                    es_errose: !!checked,
                                    tipo_acto: checked ? "errose" : prev.tipo_acto === "errose" ? "" : prev.tipo_acto,
                                }));
                            }}
                        />
                        <Label htmlFor="es_errose" className="text-sm font-normal cursor-pointer">
                            Es errose (folios inutilizados)
                        </Label>
                    </div>

                    {/* PDF upload zone */}
                    <div className="space-y-2">
                        <Label>PDF de la Escritura</Label>
                        {liveRegistro?.pdf_storage_path && !selectedFile && (
                            <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-2 rounded-md border border-green-200">
                                <FileText className="h-3.5 w-3.5" />
                                <span>PDF cargado</span>
                            </div>
                        )}
                        <div
                            className="relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-slate-50 transition-colors"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleFileDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,image/png,image/jpeg,image/webp"
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                            {selectedFile ? (
                                <div className="flex items-center justify-center gap-2">
                                    <FileText className="h-4 w-4 text-primary" />
                                    <span className="text-sm font-medium">{selectedFile.name}</span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5"
                                        onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                                    <p className="text-xs text-muted-foreground">
                                        Arrastrá el PDF de la escritura, o hacé clic para seleccionar
                                    </p>
                                </div>
                            )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                            La IA extraerá automáticamente: tipo de acto, partes, fecha y código.
                        </p>
                    </div>

                    {/* Extraction status card */}
                    {extractionStatus && (
                        <ExtractionStatusCard
                            status={extractionStatus}
                            data={extractionData}
                            evidence={extractionEvidence}
                            error={liveRegistro?.extraction_error ?? null}
                            isConfirmed={isConfirmed}
                            showEvidence={showEvidence}
                            onToggleEvidence={() => setShowEvidence(!showEvidence)}
                            onConfirm={handleConfirmExtraction}
                            onRetry={handleRetry}
                        />
                    )}

                    {/* Notas */}
                    <div className="space-y-2">
                        <Label>Notas</Label>
                        <Textarea
                            name="notas"
                            placeholder="Observaciones adicionales..."
                            value={formData.notas || ""}
                            onChange={handleChange}
                            rows={2}
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading || isExtracting}>
                            {loading ? (
                                <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Guardando...</>
                            ) : isEditing ? (
                                "Guardar Cambios"
                            ) : (
                                "Crear Escritura"
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ── Extraction Status Sub-component ──

function ExtractionStatusCard({
    status,
    data,
    evidence,
    error,
    isConfirmed,
    showEvidence,
    onToggleEvidence,
    onConfirm,
    onRetry,
}: {
    status: string;
    data: EscrituraExtractionData | null;
    evidence: { fragmentos: { campo: string; texto: string; confianza: "HIGH" | "MED" | "LOW" }[] } | null;
    error: string | null | undefined;
    isConfirmed: boolean;
    showEvidence: boolean;
    onToggleEvidence: () => void;
    onConfirm: () => void;
    onRetry: () => void;
}) {
    if (status === "PENDIENTE" || status === "PROCESANDO") {
        return (
            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Loader2 className="h-5 w-5 text-blue-500 animate-spin shrink-0" />
                <div>
                    <p className="text-sm font-medium text-blue-700">Analizando documento con IA...</p>
                    <p className="text-xs text-blue-500">Los campos se completarán automáticamente.</p>
                </div>
            </div>
        );
    }

    if (status === "ERROR") {
        return (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium text-red-700">Error en extracción</span>
                </div>
                {error && <p className="text-xs text-red-600">{error}</p>}
                <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5" /> Reintentar
                </Button>
            </div>
        );
    }

    if (status === "COMPLETADO" && data) {
        return (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span className="text-sm font-medium text-emerald-700">
                            {isConfirmed ? "Extracción confirmada" : "Datos extraídos por IA"}
                        </span>
                    </div>
                    {isConfirmed && (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-[10px]">
                            Confirmado
                        </Badge>
                    )}
                </div>

                {/* Extracted data summary */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {data.tipo_acto && (
                        <><span className="text-slate-500">Acto:</span><span className="font-medium">{data.tipo_acto}</span></>
                    )}
                    {data.vendedor_acreedor && (
                        <><span className="text-slate-500">Vendedor:</span><span className="font-medium truncate">{data.vendedor_acreedor}</span></>
                    )}
                    {data.comprador_deudor && (
                        <><span className="text-slate-500">Comprador:</span><span className="font-medium truncate">{data.comprador_deudor}</span></>
                    )}
                    {data.fecha && (
                        <><span className="text-slate-500">Fecha:</span><span className="font-medium">{data.fecha}</span></>
                    )}
                    {data.codigo_acto && (
                        <><span className="text-slate-500">Código:</span><span className="font-medium">{data.codigo_acto}</span></>
                    )}
                    {data.inmueble_descripcion && (
                        <><span className="text-slate-500 col-span-2 mt-1">Inmueble:</span><span className="font-medium col-span-2 text-[11px]">{data.inmueble_descripcion}</span></>
                    )}
                </div>

                {data.observaciones_ia && (
                    <div className="text-xs text-amber-700 bg-amber-50 px-2 py-1.5 rounded border border-amber-200">
                        {data.observaciones_ia}
                    </div>
                )}

                {/* Evidence toggle */}
                {evidence?.fragmentos && evidence.fragmentos.length > 0 && (
                    <div>
                        <button
                            type="button"
                            onClick={onToggleEvidence}
                            className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                        >
                            {showEvidence ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            Evidencia ({evidence.fragmentos.length} fragmentos)
                        </button>
                        {showEvidence && (
                            <div className="mt-2 space-y-1.5 max-h-[200px] overflow-y-auto">
                                {evidence.fragmentos.map((f, i) => (
                                    <div key={i} className="text-[11px] flex gap-2 items-start">
                                        <Badge
                                            variant="secondary"
                                            className={
                                                f.confianza === "HIGH"
                                                    ? "bg-green-100 text-green-700 text-[9px] shrink-0"
                                                    : f.confianza === "MED"
                                                        ? "bg-yellow-100 text-yellow-700 text-[9px] shrink-0"
                                                        : "bg-red-100 text-red-700 text-[9px] shrink-0"
                                            }
                                        >
                                            {f.confianza}
                                        </Badge>
                                        <span className="text-slate-500 shrink-0 w-20">{f.campo}</span>
                                        <span className="text-slate-700 italic">&ldquo;{f.texto}&rdquo;</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Actions */}
                {!isConfirmed && (
                    <div className="flex gap-2">
                        <Button type="button" size="sm" onClick={onConfirm} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Confirmar extracción
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
                            <RotateCcw className="h-3.5 w-3.5" /> Re-analizar
                        </Button>
                    </div>
                )}
            </div>
        );
    }

    return null;
}
