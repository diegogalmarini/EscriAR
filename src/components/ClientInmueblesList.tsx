"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Building2, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";

interface ClientInmueble {
    id: string;
    calle: string | null;
    numero: string | null;
    nomenclatura: string | null;
    partido_id: string | null;
    nro_partida: string | null;
    valuacion_fiscal: number | null;
    rol: string | null;
    tipo_acto: string | null;
    nro_escritura: number | null;
    fecha_escritura: string | null;
}

interface ClientInmueblesListProps {
    inmuebles: ClientInmueble[];
}

export function ClientInmueblesList({ inmuebles }: ClientInmueblesListProps) {
    const router = useRouter();

    if (inmuebles.length === 0) {
        return (
            <Card className="border-slate-200 shadow-sm">
                <CardContent className="py-12 text-center">
                    <Building2 className="mx-auto h-12 w-12 opacity-20 text-slate-400 mb-4" />
                    <p className="text-slate-500 text-sm">No hay inmuebles vinculados a este cliente.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid gap-4 md:grid-cols-2">
            {inmuebles.map((inm) => {
                const direccion = inm.calle
                    ? `${inm.calle}${inm.numero ? ` ${inm.numero}` : ""}`
                    : null;

                return (
                    <Card
                        key={inm.id}
                        className="border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group"
                        onClick={() => router.push(`/inmuebles/${inm.id}`)}
                    >
                        <CardContent className="p-5 space-y-3">
                            {/* Header: direccion or nomenclatura */}
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2 min-w-0">
                                    <MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-slate-900 truncate">
                                            {direccion || inm.nomenclatura || "Sin dirección"}
                                        </p>
                                        {inm.partido_id && (
                                            <p className="text-xs text-slate-500 mt-0.5">{inm.partido_id}</p>
                                        )}
                                    </div>
                                </div>
                                <ExternalLink size={14} className="text-slate-300 group-hover:text-slate-500 shrink-0 mt-1" />
                            </div>

                            {/* Details */}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                {inm.nro_partida && (
                                    <span>Partida: <span className="font-mono text-slate-700">{inm.nro_partida}</span></span>
                                )}
                                {inm.nomenclatura && direccion && (
                                    <span className="truncate max-w-[200px]" title={inm.nomenclatura}>
                                        N.C.: {inm.nomenclatura}
                                    </span>
                                )}
                            </div>

                            {/* Badges: rol + tipo_acto */}
                            <div className="flex flex-wrap gap-2">
                                {inm.rol && (
                                    <Badge variant="outline" className="text-[10px] font-bold uppercase">
                                        {inm.rol}
                                    </Badge>
                                )}
                                {inm.tipo_acto && (
                                    <Badge variant="secondary" className="text-[10px]">
                                        {inm.tipo_acto}
                                    </Badge>
                                )}
                                {inm.nro_escritura && (
                                    <span className="text-[10px] text-slate-400">
                                        Esc. N° {inm.nro_escritura}
                                    </span>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
