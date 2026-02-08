"use server"; // Wait, this should likely be client for interactivity (Back button) - checked ClientDetailHeader, it is "use client"

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Home, MapPin, ArrowLeft, Ruler, Table2 } from "lucide-react";
import Link from "next/link";

interface InmuebleDetailHeaderProps {
    inmueble: any;
}

export async function InmuebleDetailHeader({ inmueble }: InmuebleDetailHeaderProps) {
    // Note: If using onClick for router.back, this must be a client component.
    // However, I can just use a Link to /inmuebles.

    return (
        <div className="space-y-4">
            {/* Back Button */}
            <Link href="/inmuebles" passHref>
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-600 hover:text-slate-900"
                >
                    <ArrowLeft size={16} className="mr-2" />
                    Volver a Inmuebles
                </Button>
            </Link>


            {/* Main Header Card */}
            <Card className="p-6 border-slate-200 shadow-sm bg-white">
                <div className="flex items-start justify-between">
                    {/* Left: Info */}
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-blue-50 rounded-full border border-blue-100">
                            <Home size={32} className="text-blue-600" />
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-3">
                                <h1 className="text-xl font-bold text-slate-900 leading-tight">
                                    {inmueble.calle ?
                                        `${inmueble.calle} ${inmueble.numero || ''}` :
                                        (inmueble.nomenclatura || 'Inmueble sin dirección')}
                                </h1>
                            </div>

                            <div className="flex flex-wrap gap-4 text-sm pt-1">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-slate-500 bg-slate-50 font-normal">
                                        <MapPin className="w-3 h-3 mr-1" />
                                        {inmueble.partido_id || 'Partido Desconocido'}
                                    </Badge>
                                </div>

                                {inmueble.nro_partida && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] uppercase font-bold text-slate-400">Partida</span>
                                        <span className="font-mono text-slate-700 font-medium">
                                            {inmueble.nro_partida}
                                        </span>
                                    </div>
                                )}

                                {inmueble.valuacion_fiscal && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] uppercase font-bold text-slate-400">Valuación</span>
                                        <span className="font-mono text-slate-700">
                                            ${inmueble.valuacion_fiscal.toLocaleString('es-AR')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}
