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

                            <div className="flex flex-wrap gap-6 text-sm pt-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Partido</span>
                                    <span className="font-semibold text-slate-700">
                                        {inmueble.partido_id || 'Desconocido'}
                                    </span>
                                </div>

                                {inmueble.nro_partida && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] uppercase font-bold text-slate-400">Partida</span>
                                        <div className="font-mono text-slate-700 font-medium space-y-0.5">
                                            {inmueble.nro_partida.split(/[;,]/).map((p: string, idx: number) => {
                                                // Format with dot separator: 141931 → 141.931
                                                const trimmed = p.trim();
                                                const formatted = trimmed.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                                                return <div key={idx}>{formatted}</div>;
                                            })}
                                        </div>
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
