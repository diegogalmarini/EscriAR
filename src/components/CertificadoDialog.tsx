"use client";

import { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Certificado, CertificadoInsert, TipoCertificado, EstadoCertificado, createCertificado, updateCertificado, uploadCertificadoPdf } from "@/app/actions/certificados";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, X } from "lucide-react";

interface CertificadoDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    carpetaId: string;
    certificado?: Certificado;
    onSuccess: () => void;
}

export function CertificadoDialog({ open, onOpenChange, carpetaId, certificado, onSuccess }: CertificadoDialogProps) {
    const [loading, setLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [formData, setFormData] = useState<Partial<CertificadoInsert>>({
        carpeta_id: carpetaId,
        tipo: "DOMINIO",
        estado: "PENDIENTE",
        fecha_solicitud: "",
        fecha_recepcion: "",
        fecha_vencimiento: "",
        nro_certificado: "",
        organismo: "",
        observaciones: "",
        pdf_url: ""
    });

    useEffect(() => {
        if (certificado) {
            setFormData(certificado);
        } else {
            setFormData({
                carpeta_id: carpetaId,
                tipo: "DOMINIO",
                estado: "PENDIENTE",
                fecha_solicitud: "",
                fecha_recepcion: "",
                fecha_vencimiento: "",
                nro_certificado: "",
                organismo: "",
                observaciones: "",
                pdf_url: ""
            });
        }
        setSelectedFile(null);
    }, [certificado, carpetaId, open]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value || null }));
    };

    const handleSelectChange = (name: keyof CertificadoInsert, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const dataToSave = { ...formData, carpeta_id: carpetaId } as CertificadoInsert;
            // Clean empty strings to null for date fields
            if (!dataToSave.fecha_solicitud) dataToSave.fecha_solicitud = null;
            if (!dataToSave.fecha_recepcion) dataToSave.fecha_recepcion = null;
            if (!dataToSave.fecha_vencimiento) dataToSave.fecha_vencimiento = null;

            let savedCert: Certificado;
            if (certificado?.id) {
                savedCert = await updateCertificado({ ...dataToSave, id: certificado.id });
            } else {
                savedCert = await createCertificado(dataToSave);
            }

            // Si hay archivo seleccionado, subirlo y disparar extracción IA
            if (selectedFile && savedCert.id) {
                const fd = new FormData();
                fd.append("file", selectedFile);
                await uploadCertificadoPdf(savedCert.id, fd);
            }

            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            alert("Error al guardar el certificado.");
        } finally {
            setLoading(false);
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] h-[90vh] sm:h-auto overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{certificado ? "Editar Certificado" : "Nuevo Certificado"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Tipo</Label>
                            <Select
                                value={formData.tipo}
                                onValueChange={(v) => handleSelectChange("tipo", v as TipoCertificado)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="DOMINIO">Dominio</SelectItem>
                                    <SelectItem value="INHIBICION">Inhibición</SelectItem>
                                    <SelectItem value="CATASTRAL">Catastral</SelectItem>
                                    <SelectItem value="DEUDA_MUNICIPAL">Deuda Municipal</SelectItem>
                                    <SelectItem value="DEUDA_ARBA">Deuda ARBA</SelectItem>
                                    <SelectItem value="RENTAS">Rentas</SelectItem>
                                    <SelectItem value="AFIP">AFIP / COTI</SelectItem>
                                    <SelectItem value="ANOTACIONES_PERSONALES">Anotaciones Personales</SelectItem>
                                    <SelectItem value="OTRO">Otro</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Estado</Label>
                            <Select
                                value={formData.estado}
                                onValueChange={(v) => handleSelectChange("estado", v as EstadoCertificado)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                                    <SelectItem value="SOLICITADO">Solicitado</SelectItem>
                                    <SelectItem value="RECIBIDO">Recibido</SelectItem>
                                    <SelectItem value="VENCIDO">Vencido</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Fecha Solicitud</Label>
                            <Input
                                type="date"
                                name="fecha_solicitud"
                                value={formData.fecha_solicitud || ""}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Fecha Recepción</Label>
                            <Input
                                type="date"
                                name="fecha_recepcion"
                                value={formData.fecha_recepcion || ""}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Fecha Vencimiento</Label>
                        <Input
                            type="date"
                            name="fecha_vencimiento"
                            value={formData.fecha_vencimiento || ""}
                            onChange={handleChange}
                        />
                        <p className="text-[10px] text-slate-500">
                            Usada para el semáforo automático de la carpeta.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>N° Certificado</Label>
                            <Input
                                name="nro_certificado"
                                placeholder="Ej: 12345/24"
                                value={formData.nro_certificado || ""}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Organismo</Label>
                            <Input
                                name="organismo"
                                placeholder="Ej: RPI Cap. Fed."
                                value={formData.organismo || ""}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Documento (PDF o imagen)</Label>
                        {certificado?.storage_path && !selectedFile && (
                            <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-2 rounded-md border border-green-200">
                                <FileText className="h-3.5 w-3.5" />
                                <span>Archivo subido</span>
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
                                        Arrastrá un PDF o imagen, o hacé clic para seleccionar
                                    </p>
                                </div>
                            )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                            La IA analizará el documento y extraerá datos automáticamente.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label>Observaciones</Label>
                        <Textarea
                            name="observaciones"
                            placeholder="Detalles, gravámenes detectados, etc."
                            value={formData.observaciones || ""}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Guardando..." : "Guardar Certificado"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
