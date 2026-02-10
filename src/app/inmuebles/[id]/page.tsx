
import { getInmuebleWithRelations } from "@/app/actions/inmuebleRelations";
import { InmuebleDetailHeader } from "@/components/inmuebles/InmuebleDetailHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Folder, User, Copy, AlertCircle, FileText, BookOpen } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { InmuebleToolbar } from "@/components/inmuebles/InmuebleToolbar";


export default async function InmuebleDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    // Fetch data
    const result = await getInmuebleWithRelations(id);

    if (!result.success || !result.data) {
        // Handle error or redirect
        return (
            <div className="p-8">
                <div className="bg-red-50 text-red-600 p-4 rounded-md flex items-center gap-2">
                    <AlertCircle size={20} />
                    <p>No se pudo cargar el inmueble o no existe.</p>
                </div>
                <Link href="/inmuebles" className="mt-4 inline-block text-blue-600 hover:underline">
                    &larr; Volver
                </Link>
            </div>
        );
    }

    const { inmueble, carpetas, titularActual } = result.data;

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <InmuebleDetailHeader inmueble={inmueble} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* LEFT COLUMN: TRANSCRIPTION (2/3 width) */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="h-full border-slate-200 shadow-sm flex flex-col">
                        <CardHeader className="pb-3 border-b border-slate-100 bg-white rounded-t-lg">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-blue-50 rounded text-blue-600">
                                        <FileText size={18} />
                                    </div>
                                    <CardTitle className="text-base font-bold text-slate-800">
                                        Transcripción Literal
                                    </CardTitle>
                                </div>
                                <InmuebleToolbar inmueble={inmueble} />
                            </div>
                        </CardHeader>

                        <div className="flex-1 bg-slate-50/50 p-0">
                            {/* We use a large min-height to ensure it looks generous */}
                            <ScrollArea className="h-[600px] w-full p-6 text-justify text-sm leading-7 font-mono text-slate-700 whitespace-pre-wrap select-text selection:bg-blue-100">
                                {inmueble.transcripcion_literal || "No hay transcripción cargada."}
                            </ScrollArea>
                        </div>
                    </Card>

                    {/* TITULO ANTECEDENTE */}
                    {inmueble.titulo_antecedente && (
                        <Card className="border-amber-200 shadow-sm">
                            <CardHeader className="pb-3 border-b border-amber-100 bg-amber-50/50 rounded-t-lg">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-amber-100 rounded text-amber-700">
                                        <BookOpen size={18} />
                                    </div>
                                    <CardTitle className="text-base font-bold text-amber-900">
                                        Título Antecedente
                                    </CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="bg-amber-50/30 p-6">
                                <p className="text-sm leading-7 font-mono text-slate-700 whitespace-pre-wrap select-text selection:bg-amber-100 text-justify">
                                    {inmueble.titulo_antecedente}
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* RIGHT COLUMN: RELATIONS (1/3 width) */}
                <div className="space-y-6">

                    {/* TITULAR ACTUAL */}
                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <User size={14} /> Titular Actual (Inferido)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {titularActual && titularActual.length > 0 ? (
                                <div className="space-y-3">
                                    {titularActual.map((persona: any) => (
                                        <div key={persona.id} className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-lg shadow-sm hover:border-blue-200 transition-colors group">
                                            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600">
                                                <User size={16} />
                                            </div>
                                            <div className="overflow-hidden">
                                                <p className="text-sm font-semibold text-slate-900 truncate">
                                                    {/* For legal entities, check if name is in "Apellido, Nombre" format and fix it */}
                                                    {(persona.tipo_persona === 'JURIDICA' || persona.tipo_persona === 'FIDEICOMISO') && persona.nombre_completo?.includes(', ')
                                                        ? persona.nombre_completo.split(', ').reverse().join(' ')
                                                        : persona.nombre_completo}
                                                </p>
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    {/* Show CUIT for legal entities, only DNI for physical persons */}
                                                    {persona.tipo_persona === 'JURIDICA' || persona.tipo_persona === 'FIDEICOMISO' ? (
                                                        persona.cuit && <span>CUIT {persona.cuit}</span>
                                                    ) : (
                                                        persona.dni && <span>DNI {persona.dni}</span>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Link to client detail */}
                                            <Link href={`/clientes/${persona.dni || persona.id}`} className="ml-auto text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                &rarr;
                                            </Link>
                                        </div>
                                    ))}
                                    <p className="text-[10px] text-slate-400 mt-2 text-center">
                                        * Basado en la última operación de adquisición registrada.
                                    </p>
                                </div>
                            ) : (
                                <div className="text-center py-6 text-slate-400">
                                    <User className="mx-auto h-8 w-8 opacity-20 mb-2" />
                                    <p className="text-xs">No se encontró titularidad reciente.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* CARPETAS RELACIONADAS */}
                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <Folder size={14} /> Carpetas Relacionadas
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {carpetas && carpetas.length > 0 ? (
                                <div className="space-y-2">
                                    {carpetas.map((carpeta: any) => (
                                        <Link href={`/carpeta/${carpeta.id}`} key={carpeta.id}>
                                            <div className="flex items-center gap-3 p-3 text-sm bg-white border border-slate-100 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer group">
                                                <Folder size={16} className="text-yellow-500 group-hover:scale-110 transition-transform" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-slate-700 truncate group-hover:text-blue-700">
                                                        {carpeta.caratula || "Sin Carátula"}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        Carpeta Nº {carpeta.nro_carpeta_interna}
                                                    </p>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-slate-400">
                                    <Folder className="mx-auto h-8 w-8 opacity-20 mb-2" />
                                    <p className="text-xs">No hay carpetas vinculadas.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                </div>
            </div>
        </div>
    );
}
