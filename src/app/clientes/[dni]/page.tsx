import { getClientWithRelations } from "@/app/actions/clientRelations";
import { ClientDetailHeader } from "@/components/ClientDetailHeader";
import { ClientRelationsList } from "@/components/ClientRelationsList";
import { ClientPoderesList } from "@/components/ClientPoderesList";
import { ClientDocumentosList } from "@/components/ClientDocumentosList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Folder, FileText, Activity, FileSignature } from "lucide-react";
import { redirect } from "next/navigation";
import { formatDateInstructions, formatCUIT } from "@/lib/utils";
import { formatPersonName } from "@/lib/utils/normalization";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ClientDetailPage({ params }: { params: Promise<{ dni: string }> }) {
    const { dni } = await params;

    // Fetch client data with all relationships
    const result = await getClientWithRelations(dni);

    if (!result.success || !result.data) {
        redirect('/clientes');
    }

    const { persona, operaciones, escrituras, carpetas, documentos = [], poderesOtorgados = [], poderesActivos = [] } = result.data;

    return (
        <div className="p-8 space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <ClientDetailHeader persona={persona} />

            {/* Tabs */}
            <Tabs defaultValue="datos" className="w-full">
                <TabsList className="grid w-full grid-cols-5 lg:w-[900px]">
                    <TabsTrigger value="datos" className="flex items-center gap-2">
                        <User size={16} />
                        <span>Datos Personales</span>
                    </TabsTrigger>
                    <TabsTrigger value="relaciones" className="flex items-center gap-2">
                        <Folder size={16} />
                        <span className="flex items-center gap-1.5">
                            Carpetas
                            {carpetas.length > 0 && (
                                <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-slate-200 text-slate-700">
                                    {carpetas.length}
                                </span>
                            )}
                        </span>
                    </TabsTrigger>
                    <TabsTrigger value="poderes" className="flex items-center gap-2">
                        <FileSignature size={16} />
                        <span className="flex items-center gap-1.5">
                            Poderes
                            {(poderesActivos.length > 0 || poderesOtorgados.length > 0) && (
                                <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-slate-200 text-slate-700">
                                    {poderesActivos.length + poderesOtorgados.length}
                                </span>
                            )}
                        </span>
                    </TabsTrigger>
                    <TabsTrigger value="documentos" className="flex items-center gap-2">
                        <FileText size={16} />
                        <span className="flex items-center gap-1.5">
                            Documentos
                            {documentos.length > 0 && (
                                <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-slate-200 text-slate-700">
                                    {documentos.length}
                                </span>
                            )}
                        </span>
                    </TabsTrigger>
                    <TabsTrigger value="actividad" className="flex items-center gap-2">
                        <Activity size={16} />
                        <span>Actividad</span>
                    </TabsTrigger>
                </TabsList>

                {/* Tab: Datos Personales */}
                <TabsContent value="datos" className="mt-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Identification */}
                        <Card className="border-slate-200 shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-base font-bold text-slate-800">Identificación</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nombre Completo</p>
                                    <p className="text-sm text-slate-900 font-medium mt-1">{persona.nombre_completo}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">DNI</p>
                                    <p className="text-sm text-slate-900 font-mono mt-1">
                                        {persona.dni && (persona.dni.startsWith('SIN-DNI-') || persona.dni.startsWith('SIN_DNI_') || persona.dni.startsWith('TEMP-'))
                                            ? <span className="text-slate-400 italic">Pendiente</span>
                                            : (persona.dni || 'N/A')}
                                    </p>
                                </div>
                                {persona.cuit && (() => {
                                    const digits = persona.cuit.replace(/\D/g, '');
                                    const isValid = digits.length >= 10 && digits.length <= 11 && ['20','23','24','27','30','33','34'].some((p: string) => digits.startsWith(p));
                                    if (!isValid) return null;
                                    return (
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">CUIT/CUIL</p>
                                            <p className="text-sm text-slate-900 font-mono mt-1">{formatCUIT(digits)}</p>
                                        </div>
                                    );
                                })()}
                                {persona.nacionalidad && (
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nacionalidad</p>
                                        <p className="text-sm text-slate-900 mt-1">{persona.nacionalidad}</p>
                                    </div>
                                )}
                                {persona.fecha_nacimiento && (
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fecha de Nacimiento</p>
                                        <p className="text-sm text-slate-900 mt-1">{formatDateInstructions(persona.fecha_nacimiento)}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Contact & Address */}
                        <Card className="border-slate-200 shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-base font-bold text-slate-800">Contacto y Domicilio</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {persona.domicilio_real?.literal && (
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Domicilio Real</p>
                                        <p className="text-sm text-slate-900 mt-1">{persona.domicilio_real.literal}</p>
                                    </div>
                                )}
                                {persona.contacto?.telefono && (
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Teléfono</p>
                                        <a
                                            href={`tel:${persona.contacto.telefono}`}
                                            className="text-sm text-slate-900 hover:text-slate-600 mt-1 inline-block"
                                        >
                                            {persona.contacto.telefono}
                                        </a>
                                    </div>
                                )}
                                {persona.contacto?.email && (
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email</p>
                                        <a
                                            href={`mailto:${persona.contacto.email}`}
                                            className="text-sm text-slate-900 hover:text-slate-600 mt-1 inline-block"
                                        >
                                            {persona.contacto.email}
                                        </a>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Civil Status */}
                        {(persona.estado_civil_detalle || persona.nombres_padres || persona.datos_conyuge?.nombre) && (
                            <Card className="border-slate-200 shadow-sm md:col-span-2">
                                <CardHeader>
                                    <CardTitle className="text-base font-bold text-slate-800">Estado Civil y Filiación</CardTitle>
                                </CardHeader>
                                <CardContent className="grid gap-4 md:grid-cols-2">
                                    {persona.estado_civil_detalle && (
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estado Civil</p>
                                            <p className="text-sm text-slate-900 mt-1">{persona.estado_civil_detalle}</p>
                                        </div>
                                    )}
                                    {persona.nombres_padres && (
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filiación (Padres)</p>
                                            <p className="text-sm text-slate-900 mt-1">{persona.nombres_padres}</p>
                                        </div>
                                    )}
                                    {persona.datos_conyuge?.nombre && (
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cónyuge</p>
                                            <p className="text-sm text-slate-900 mt-1">{formatPersonName(persona.datos_conyuge.nombre)}</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </TabsContent>

                {/* Tab: Carpetas y Relaciones */}
                <TabsContent value="relaciones" className="mt-6">
                    <ClientRelationsList operaciones={operaciones} carpetas={carpetas} />
                </TabsContent>

                {/* Tab: Poderes */}
                <TabsContent value="poderes" className="mt-6">
                    <ClientPoderesList poderesActivos={poderesActivos} poderesOtorgados={poderesOtorgados} />
                </TabsContent>

                {/* Tab: Documentos Relacionados */}
                <TabsContent value="documentos" className="mt-6">
                    <ClientDocumentosList documentos={documentos} />
                </TabsContent>

                {/* Tab: Actividad */}
                <TabsContent value="actividad" className="mt-6">
                    <Card className="border-slate-200 shadow-sm">
                        <CardContent className="py-12 text-center">
                            <Activity className="mx-auto h-12 w-12 opacity-20 text-slate-400 mb-4" />
                            <p className="text-slate-500 text-sm">El historial de actividad estará disponible próximamente.</p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
