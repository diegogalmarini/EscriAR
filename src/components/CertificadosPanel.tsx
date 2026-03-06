"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2, Loader2, CheckCircle2, AlertCircle, RotateCcw, ChevronDown, ChevronUp, Eye } from "lucide-react";
import {
    Certificado,
    ExtractionData,
    getCertificadosPorCarpeta,
    deleteCertificado,
    confirmCertificadoExtraction,
    retryCertExtraction,
    getCertificadoSignedUrl,
} from "@/app/actions/certificados";
import { CertificadoDialog } from "./CertificadoDialog";
import { Badge } from "@/components/ui/badge";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CertificadosPanelProps {
    carpetaId: string;
}

// ── Extraction card para mostrar datos extraídos + confirmar/corregir ──

function ExtractionCard({ cert, onConfirm, onRetry }: {
    cert: Certificado;
    onConfirm: (certId: string, data: Parameters<typeof confirmCertificadoExtraction>[1]) => Promise<void>;
    onRetry: (certId: string) => Promise<void>;
}) {
    const [expanded, setExpanded] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [retrying, setRetrying] = useState(false);

    const data = cert.extraction_data as ExtractionData | null;
    const evidence = cert.extraction_evidence as { fragmentos: { campo: string; texto: string; confianza: string }[] } | null;

    if (cert.extraction_status === "PENDIENTE" || cert.extraction_status === "PROCESANDO") {
        return (
            <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-blue-50 rounded-md border border-blue-200">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                <span className="text-xs text-blue-600">Analizando documento con IA...</span>
            </div>
        );
    }

    if (cert.extraction_status === "ERROR") {
        return (
            <div className="mt-2 px-3 py-2 bg-red-50 rounded-md border border-red-200 space-y-2">
                <div className="flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-xs text-red-600">Error en extracción</span>
                </div>
                {cert.extraction_error && (
                    <p className="text-[10px] text-red-500">{cert.extraction_error}</p>
                )}
                <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={retrying}
                    onClick={async () => {
                        setRetrying(true);
                        try { await onRetry(cert.id); } finally { setRetrying(false); }
                    }}
                >
                    {retrying ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RotateCcw className="h-3 w-3 mr-1" />}
                    Reintentar
                </Button>
            </div>
        );
    }

    if (cert.extraction_status === "COMPLETADO" && data) {
        const isConfirmed = !!cert.confirmed_at;

        // Campos relevantes a mostrar
        const displayFields: { label: string; value: string | number | null | undefined }[] = [
            { label: "Titular", value: data.titular },
            { label: "Inscripción", value: data.inscripcion },
            { label: "N° Certificado", value: data.numero_certificado },
            { label: "Organismo", value: data.organismo },
            { label: "Emisión", value: data.fecha_emision },
            { label: "Vencimiento", value: data.fecha_vencimiento },
            { label: "Nomenclatura", value: data.nomenclatura },
            { label: "Superficie", value: data.superficie },
            { label: "Val. Fiscal", value: data.valuacion_fiscal },
            { label: "Estado Deuda", value: data.estado_deuda },
            { label: "Monto Adeudado", value: data.monto_adeudado },
        ].filter(f => f.value != null);

        const gravamenesArr = data.gravamenes?.filter(Boolean) || [];
        const inhibicionesArr = data.inhibiciones?.filter(Boolean) || [];

        return (
            <div className="mt-2 space-y-2">
                <button
                    type="button"
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center gap-2 w-full text-left"
                >
                    {isConfirmed ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                    )}
                    <span className="text-xs font-medium">
                        {isConfirmed ? "Extracción confirmada" : "Extracción IA — pendiente de confirmación"}
                    </span>
                    {expanded ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
                </button>

                {expanded && (
                    <div className="bg-slate-50 rounded-md border p-3 space-y-3">
                        {/* Campos extraídos */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                            {displayFields.map(f => (
                                <div key={f.label} className="text-xs">
                                    <span className="text-muted-foreground">{f.label}:</span>{" "}
                                    <span className="font-medium">{String(f.value)}</span>
                                </div>
                            ))}
                        </div>

                        {/* Gravámenes */}
                        {gravamenesArr.length > 0 && (
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-red-600">Gravámenes ({gravamenesArr.length})</p>
                                {gravamenesArr.map((g, i) => (
                                    <p key={i} className="text-[10px] text-red-500 pl-2 border-l-2 border-red-200">{g}</p>
                                ))}
                            </div>
                        )}

                        {/* Inhibiciones */}
                        {inhibicionesArr.length > 0 && (
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-orange-600">Inhibiciones ({inhibicionesArr.length})</p>
                                {inhibicionesArr.map((h, i) => (
                                    <p key={i} className="text-[10px] text-orange-500 pl-2 border-l-2 border-orange-200">{h}</p>
                                ))}
                            </div>
                        )}

                        {/* Evidencia */}
                        {evidence?.fragmentos && evidence.fragmentos.length > 0 && (
                            <details className="text-[10px]">
                                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                    Ver evidencia ({evidence.fragmentos.length} fragmentos)
                                </summary>
                                <div className="mt-1.5 space-y-1 max-h-40 overflow-y-auto">
                                    {evidence.fragmentos.map((frag, i) => (
                                        <div key={i} className="bg-white p-1.5 rounded border">
                                            <span className="font-medium">{frag.campo}</span>
                                            <Badge variant="outline" className="ml-1.5 text-[8px] h-4">
                                                {frag.confianza}
                                            </Badge>
                                            <p className="text-muted-foreground mt-0.5 italic">"{frag.texto}"</p>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        )}

                        {/* Observaciones IA */}
                        {data.observaciones_ia && (
                            <p className="text-[10px] text-muted-foreground italic bg-amber-50 p-2 rounded border border-amber-200">
                                IA: {data.observaciones_ia}
                            </p>
                        )}

                        {/* Botón confirmar */}
                        {!isConfirmed && (
                            <div className="flex gap-2 pt-1">
                                <Button
                                    variant="default"
                                    size="sm"
                                    className="h-7 text-xs"
                                    disabled={confirming}
                                    onClick={async () => {
                                        setConfirming(true);
                                        try {
                                            await onConfirm(cert.id, {
                                                fecha_vencimiento: data.fecha_vencimiento || cert.fecha_vencimiento || null,
                                                nro_certificado: data.numero_certificado || cert.nro_certificado || null,
                                                organismo: data.organismo || cert.organismo || null,
                                                estado: data.fecha_vencimiento ? "RECIBIDO" : cert.estado,
                                            });
                                        } finally {
                                            setConfirming(false);
                                        }
                                    }}
                                >
                                    {confirming ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                                    Confirmar extracción
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    disabled={retrying}
                                    onClick={async () => {
                                        setRetrying(true);
                                        try { await onRetry(cert.id); } finally { setRetrying(false); }
                                    }}
                                >
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    Re-analizar
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    return null;
}

// ── Panel principal ──

export function CertificadosPanel({ carpetaId }: CertificadosPanelProps) {
    const [certificados, setCertificados] = useState<Certificado[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedCert, setSelectedCert] = useState<Certificado | undefined>(undefined);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

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

    // Polling para extracciones en progreso
    useEffect(() => {
        const hasInProgress = certificados.some(
            c => c.extraction_status === "PENDIENTE" || c.extraction_status === "PROCESANDO"
        );
        if (!hasInProgress) return;

        const interval = setInterval(loadCertificados, 5000);
        return () => clearInterval(interval);
    }, [certificados, carpetaId]);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        await deleteCertificado(deleteTarget);
        setDeleteTarget(null);
        await loadCertificados();
    };

    const handleConfirm = async (certId: string, data: Parameters<typeof confirmCertificadoExtraction>[1]) => {
        await confirmCertificadoExtraction(certId, data);
        await loadCertificados();
    };

    const handleRetry = async (certId: string) => {
        await retryCertExtraction(certId);
        await loadCertificados();
    };

    const handleViewPdf = async (cert: Certificado) => {
        try {
            if (cert.storage_path) {
                const url = await getCertificadoSignedUrl(cert.storage_path);
                window.open(url, "_blank");
            } else if (cert.pdf_url) {
                window.open(cert.pdf_url, "_blank");
            }
        } catch (error) {
            console.error("Error obteniendo URL del PDF:", error);
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

    const getExtractionBadge = (cert: Certificado) => {
        if (!cert.extraction_status) return null;
        if (cert.extraction_status === "PENDIENTE" || cert.extraction_status === "PROCESANDO") {
            return <Badge variant="outline" className="text-blue-500 border-blue-200 bg-blue-50 text-[10px] h-5"><Loader2 className="h-2.5 w-2.5 animate-spin mr-1" />IA</Badge>;
        }
        if (cert.extraction_status === "COMPLETADO" && cert.confirmed_at) {
            return <Badge variant="outline" className="text-green-500 border-green-200 bg-green-50 text-[10px] h-5"><CheckCircle2 className="h-2.5 w-2.5 mr-1" />IA ✓</Badge>;
        }
        if (cert.extraction_status === "COMPLETADO") {
            return <Badge variant="outline" className="text-amber-500 border-amber-200 bg-amber-50 text-[10px] h-5">IA pendiente</Badge>;
        }
        if (cert.extraction_status === "ERROR") {
            return <Badge variant="outline" className="text-red-500 border-red-200 bg-red-50 text-[10px] h-5"><AlertCircle className="h-2.5 w-2.5 mr-1" />Error</Badge>;
        }
        return null;
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
                        <div key={cert.id} className="p-4 bg-white border rounded-lg shadow-sm space-y-2">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className="font-medium text-sm">{cert.tipo.replace('_', ' ')}</span>
                                        {getEstadoBadge(cert.estado, cert.fecha_vencimiento)}
                                        {getExtractionBadge(cert)}
                                    </div>
                                    <div className="text-xs text-slate-500 space-y-1">
                                        {cert.organismo && <p>Organismo: {cert.organismo}</p>}
                                        {cert.nro_certificado && <p>N°: {cert.nro_certificado}</p>}
                                        {cert.fecha_vencimiento && <p>Vencimiento: {new Date(cert.fecha_vencimiento).toLocaleDateString()}</p>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {(cert.storage_path || cert.pdf_url) && (
                                        <Button variant="outline" size="sm" onClick={() => handleViewPdf(cert)}>
                                            <Eye className="h-3.5 w-3.5 mr-1.5" /> Ver PDF
                                        </Button>
                                    )}
                                    <Button variant="ghost" size="icon" onClick={() => { setSelectedCert(cert); setIsDialogOpen(true); }}>
                                        <Edit2 className="h-4 w-4 text-slate-500" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(cert.id)}>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                </div>
                            </div>

                            {/* Extraction card: muestra datos IA + confirmación */}
                            {cert.extraction_status && (
                                <ExtractionCard cert={cert} onConfirm={handleConfirm} onRetry={handleRetry} />
                            )}
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

            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar certificado</AlertDialogTitle>
                        <AlertDialogDescription>
                            ¿Estás seguro que deseas eliminar este certificado? Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
