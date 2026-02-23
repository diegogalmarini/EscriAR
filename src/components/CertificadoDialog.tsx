"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Certificado, CertificadoInsert, TipoCertificado, EstadoCertificado, createCertificado, updateCertificado } from "@/app/actions/certificados";
import { Textarea } from "@/components/ui/textarea";

interface CertificadoDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    carpetaId: string;
    certificado?: Certificado;
    onSuccess: () => void;
}

export function CertificadoDialog({ open, onOpenChange, carpetaId, certificado, onSuccess }: CertificadoDialogProps) {
    const [loading, setLoading] = useState(false);
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

            if (certificado?.id) {
                await updateCertificado({ ...dataToSave, id: certificado.id });
            } else {
                await createCertificado(dataToSave);
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
                        <Label>PDF URL</Label>
                        <Input
                            name="pdf_url"
                            type="url"
                            placeholder="Enlace al documento..."
                            value={formData.pdf_url || ""}
                            onChange={handleChange}
                        />
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
