"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Folder, ExternalLink } from "lucide-react";
import Link from "next/link";

interface DocumentoRelacionado {
    id: string;
    nro_protocolo: number | null;
    fecha_escritura: string | null;
    pdf_url: string | null;
    source: string | null;
    registro: string | null;
    notario_interviniente: string | null;
    carpeta_id: string | null;
    tipo_acto: string | null;
    rol: string | null;
}

interface Props {
    documentos: DocumentoRelacionado[];
}

const SOURCE_LABELS: Record<string, string> = {
    INGESTA: "Extracción IA",
    PROTOCOLO: "Protocolo",
    TRAMITE: "Trámite",
};

export function ClientDocumentosList({ documentos }: Props) {
    if (!documentos || documentos.length === 0) {
        return (
            <Card className="border-slate-200 shadow-sm">
                <CardContent className="py-12 text-center">
                    <FileText className="mx-auto h-12 w-12 opacity-20 text-slate-400 mb-4" />
                    <p className="text-slate-500 text-sm">No hay documentos vinculados a este cliente.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-3">
            {documentos.map((doc) => (
                <Card key={doc.id} className="border-slate-200 shadow-sm hover:border-slate-300 transition-colors">
                    <CardContent className="p-4 space-y-2">
                        {/* Header: Escritura number + rol badge */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-blue-50 rounded text-blue-600">
                                    <FileText size={16} />
                                </div>
                                <span className="font-semibold text-slate-800">
                                    Escritura N° {doc.nro_protocolo || "?"}
                                </span>
                                {doc.registro && (
                                    <span className="text-xs text-slate-400">Reg. {doc.registro}</span>
                                )}
                            </div>
                            {doc.rol && (
                                <Badge variant="secondary" className="text-[10px] font-bold uppercase">
                                    {doc.rol}
                                </Badge>
                            )}
                        </div>

                        {/* Details */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 pl-9">
                            {doc.tipo_acto && (
                                <>
                                    <span className="text-slate-400">Acto:</span>
                                    <span className="font-medium">{doc.tipo_acto}</span>
                                </>
                            )}
                            {doc.fecha_escritura && (
                                <>
                                    <span className="text-slate-400">Fecha:</span>
                                    <span>{new Date(doc.fecha_escritura).toLocaleDateString("es-AR")}</span>
                                </>
                            )}
                            {doc.notario_interviniente && (
                                <>
                                    <span className="text-slate-400">Notario:</span>
                                    <span>{doc.notario_interviniente}</span>
                                </>
                            )}
                        </div>

                        {/* Actions + source */}
                        <div className="flex items-center gap-3 pl-9 pt-1">
                            {doc.pdf_url && (
                                <a
                                    href={doc.pdf_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                    <FileText size={12} />
                                    Ver PDF
                                </a>
                            )}
                            {doc.carpeta_id && (
                                <Link
                                    href={`/carpeta/${doc.carpeta_id}`}
                                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 hover:underline"
                                >
                                    <Folder size={12} />
                                    Ver Carpeta
                                </Link>
                            )}
                            <span className="ml-auto text-[10px] text-slate-400">
                                Fuente: {SOURCE_LABELS[doc.source || ""] || doc.source || "Desconocido"}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
