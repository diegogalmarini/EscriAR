"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { Certificado, getCertificadosPorCarpeta, deleteCertificado } from "@/app/actions/certificados";
import { CertificadoDialog } from "./CertificadoDialog";
import { Badge } from "@/components/ui/badge";

interface CertificadosPanelProps {
    carpetaId: string;
}

export function CertificadosPanel({ carpetaId }: CertificadosPanelProps) {
    const [certificados, setCertificados] = useState<Certificado[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedCert, setSelectedCert] = useState<Certificado | undefined>(undefined);

    const loadCertificados = async () => {
        setLoading(true);
        try {
            const data = await getCertificadosPorCarpeta(carpetaId);
            setCertificados(data);
        } catch (error) {
            console.error("Error loading certificados", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (carpetaId) {
            loadCertificados();
        }
    }, [carpetaId]);

    const handleDelete = async (id: string) => {
        if (confirm("¿Estás seguro que deseas eliminar este certificado?")) {
            await deleteCertificado(id);
            await loadCertificados();
        }
    };

    const getEstadoBadge = (estado: string, vto: string | null) => {
        if (estado === "PENDIENTE") return <Badge variant="secondary">Pendiente</Badge>;
        if (estado === "SOLICITADO") return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">Solicitado</Badge>;

        if (estado === "RECIBIDO" && vto) {
            const daysLeft = Math.ceil((new Date(vto).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
            if (daysLeft < 0) return <Badge variant="destructive">Vencido</Badge>;
            if (daysLeft <= 3) return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Por Vencer ({daysLeft}d)</Badge>;
            return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Vigente ({daysLeft}d)</Badge>;
        }

        if (estado === "RECIBIDO") return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Recibido (S/Vto)</Badge>;

        return <Badge variant="destructive">Vencido</Badge>;
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Certificados</h3>
                <Button variant="outline" size="sm" onClick={() => { setSelectedCert(undefined); setIsDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" /> Agregar Certificado
                </Button>
            </div>

            {loading ? (
                <p className="text-sm text-muted-foreground animate-pulse">Cargando certificados...</p>
            ) : certificados.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-lg border border-dashed">
                    <p className="text-sm text-muted-foreground">No hay certificados asociados a esta carpeta.</p>
                </div>
            ) : (
                <div className="grid gap-3">
                    {certificados.map(cert => (
                        <div key={cert.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-white border rounded-lg shadow-sm gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-sm">{cert.tipo.replace('_', ' ')}</span>
                                    {getEstadoBadge(cert.estado, cert.fecha_vencimiento)}
                                </div>
                                <div className="text-xs text-slate-500 space-y-1">
                                    {cert.organismo && <p>Organismo: {cert.organismo}</p>}
                                    {cert.nro_certificado && <p>N°: {cert.nro_certificado}</p>}
                                    {cert.fecha_vencimiento && <p>Vencimiento: {new Date(cert.fecha_vencimiento).toLocaleDateString()}</p>}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {cert.pdf_url && (
                                    <Button variant="outline" size="sm" asChild>
                                        <a href={cert.pdf_url} target="_blank" rel="noopener noreferrer">Ver PDF</a>
                                    </Button>
                                )}
                                <Button variant="ghost" size="icon" onClick={() => { setSelectedCert(cert); setIsDialogOpen(true); }}>
                                    <Edit2 className="h-4 w-4 text-slate-500" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(cert.id)}>
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <CertificadoDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                carpetaId={carpetaId}
                certificado={selectedCert}
                onSuccess={loadCertificados}
            />
        </div>
    );
}
