"use server"; // Wait, this should likely be client for interactivity (Back button) - checked ClientDetailHeader, it is "use client"

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Home, MapPin, ArrowLeft, Ruler, Table2 } from "lucide-react";
import Link from "next/link";

import { DeleteInmuebleDialog } from "@/components/DeleteInmuebleDialog";

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
                        {/* ICON REMOVED AS PER USER REQUEST */}
                        <div className="space-y-1">
                            <div className="flex items-center gap-3">
                                <h1 className="text-xl font-bold text-slate-900 leading-tight">
                                    {inmueble.calle ?
                                        `${inmueble.calle} ${inmueble.numero || ''}` :
                                        (inmueble.nomenclatura || 'Inmueble sin dirección')}
                                </h1>
                            </div>

                            <div className="flex flex-row items-baseline text-sm pt-2 gap-4">
                                {/* PARTIDO */}
                                <div className="flex gap-2 items-baseline">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Partido</span>
                                    <span className="font-semibold text-slate-700">
                                        {inmueble.partido_id || 'Desconocido'}
                                    </span>
                                </div>

                                {/* SEPARATOR */}
                                {inmueble.nro_partida && <div className="text-slate-300">|</div>}

                                {/* PARTIDA */}
                                {inmueble.nro_partida && (
                                    <div className="flex gap-2 items-baseline">
                                        <span className="text-[10px] uppercase font-bold text-slate-400">Partida</span>
                                        <div className="flex flex-col font-mono text-slate-700 font-medium space-y-0.5">
                                            {inmueble.nro_partida.split(/[;,]/).map((p: string, idx: number) => {
                                                const formatted = p.trim().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                                                return <div key={idx}>{formatted}</div>;
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* SEPARATOR */}
                                {inmueble.valuacion_fiscal && <div className="text-slate-300">|</div>}

                                {/* VALUACION */}
                                {inmueble.valuacion_fiscal && (
                                    <div className="flex gap-2 items-baseline">
                                        <span className="text-[10px] uppercase font-bold text-slate-400">Valuación</span>
                                        <span className="font-mono text-slate-700">
                                            ${inmueble.valuacion_fiscal.toLocaleString('es-AR')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <DeleteInmuebleDialog
                        inmuebleId={inmueble.id}
                        nomenclatura={inmueble.nomenclatura}
                        redirectTo="/inmuebles"
                    />
                </div>
            </Card>
        </div>
    );
}
