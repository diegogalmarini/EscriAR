"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileSignature, UserCheck, ExternalLink } from "lucide-react";

interface Poder {
    id: string;
    apoderado_dni: string;
    otorgante_dni: string;
    nro_escritura?: string;
    fecha_otorgamiento?: string;
    escribano_autorizante?: string;
    registro?: string;
    facultades_extracto?: string;
    pdf_url?: string;
    apoderado?: { nombre_completo: string; dni: string };
    otorgante?: { nombre_completo: string; dni: string };
    estado?: string;
}

interface ClientPoderesListProps {
    poderesOtorgados: Poder[];
    poderesActivos: Poder[];
}

export function ClientPoderesList({ poderesOtorgados, poderesActivos }: ClientPoderesListProps) {
    const renderPoderesList = (poderes: Poder[], rol: "OTORGANTE" | "APODERADO") => {
        if (poderes.length === 0) {
            return (
                <div className="py-8 text-center text-slate-500 text-sm">
                    No se encontraron poderes en este rol.
                </div>
            );
        }

        return (
            <div className="space-y-4 mt-4">
                {poderes.map((poder) => (
                    <Card key={poder.id} className="border-slate-200 shadow-sm hover:shadow-md transition-all duration-200">
                        <CardHeader className="py-3 bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FileSignature className="h-4 w-4 text-slate-500" />
                                <CardTitle className="text-sm font-semibold text-slate-800">
                                    Poder / Escritura N° {poder.nro_escritura || 'S/N'}
                                </CardTitle>
                                {poder.estado === 'HISTORICO' && (
                                    <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-500 ml-2">Histórico</Badge>
                                )}
                            </div>
                            {poder.pdf_url && (
                                <a href={poder.pdf_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-xs font-medium">
                                    Ver Documento
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            )}
                        </CardHeader>
                        <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    {rol === "OTORGANTE" ? "Apoderado (Representante)" : "Otorgante (Mandante)"}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="bg-slate-100 p-1.5 rounded-md">
                                        <UserCheck className="h-3 w-3 text-slate-600" />
                                    </div>
                                    <span className="text-sm font-medium text-slate-900">
                                        {rol === "OTORGANTE"
                                            ? poder.apoderado?.nombre_completo || poder.apoderado_dni
                                            : poder.otorgante?.nombre_completo || poder.otorgante_dni}
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <span className="text-slate-500 font-medium block">Fecha</span>
                                        <span className="text-slate-900">{poder.fecha_otorgamiento || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 font-medium block">Escribano</span>
                                        <span className="text-slate-900">{poder.escribano_autorizante || 'N/A'}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-slate-500 font-medium block">Registro</span>
                                        <span className="text-slate-900">{poder.registro || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                            {poder.facultades_extracto && (
                                <div className="col-span-1 md:col-span-2 mt-2 bg-amber-50 rounded-md p-3 border border-amber-100">
                                    <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">Extracto de Facultades</p>
                                    <p className="text-xs text-amber-900 whitespace-pre-wrap">{poder.facultades_extracto}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    };

    const hasPoderes = poderesOtorgados.length > 0 || poderesActivos.length > 0;

    if (!hasPoderes) {
        return (
            <Card className="border-slate-200 shadow-sm">
                <CardContent className="py-16 text-center">
                    <FileSignature className="mx-auto h-16 w-16 opacity-10 text-slate-400 mb-4" />
                    <p className="text-slate-500 text-sm font-medium">Este cliente no registra poderes ni representaciones vigentes en el sistema.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-8">
            <section>
                <div className="flex items-center gap-2 border-b border-border pb-2">
                    <h3 className="text-base font-semibold text-slate-800">Poderes Activos (Donde es Apoderado)</h3>
                    <Badge variant="secondary" className="text-xs">{poderesActivos.length}</Badge>
                </div>
                {renderPoderesList(poderesActivos, "APODERADO")}
            </section>

            <section>
                <div className="flex items-center gap-2 border-b border-border pb-2">
                    <h3 className="text-base font-semibold text-slate-800">Poderes Otorgados (Delegados a Terceros)</h3>
                    <Badge variant="secondary" className="text-xs">{poderesOtorgados.length}</Badge>
                </div>
                {renderPoderesList(poderesOtorgados, "OTORGANTE")}
            </section>
        </div>
    );
}
