"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { User, Mail, Phone, FileText, Share2, Edit2, Trash2, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { SendFichaDialog } from "./SendFichaDialog";
import { EditarClienteDialog } from "./EditarClienteDialog";
import { DeleteClienteDialog } from "./DeleteClienteDialog";
import { TimelineAuditoria } from "./TimelineAuditoria";
import { cn, formatDateInstructions } from "@/lib/utils";
import { formatCUIT, isLegalEntity, formatPersonName } from "@/lib/utils/normalization";

interface ClientDetailHeaderProps {
    persona: {
        dni: string;
        nombre_completo: string;
        cuit?: string;
        nacionalidad?: string;
        fecha_nacimiento?: string;
        domicilio_real?: { literal?: string };
        estado_civil_detalle?: string;
        nombres_padres?: string;
        datos_conyuge?: { nombre?: string };
        contacto?: {
            telefono?: string;
            email?: string;
        };
        origen_dato?: string;
    };
    onClienteUpdated?: () => void;
}

export function ClientDetailHeader({ persona, onClienteUpdated }: ClientDetailHeaderProps) {
    const router = useRouter();

    return (
        <div className="space-y-4">
            {/* Back Button */}
            <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/clientes')}
                className="text-slate-600 hover:text-slate-900"
            >
                <ArrowLeft size={16} className="mr-2" />
                Volver a Clientes
            </Button>

            {/* Main Header Card */}
            <Card className="p-6 border-slate-200 shadow-sm">
                <div className="flex items-start justify-between">
                    {/* Left: Client Info */}
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-slate-100 rounded-full">
                            <User size={32} className="text-slate-600" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-bold text-slate-900">
                                    {isLegalEntity(persona) ? persona.nombre_completo.toUpperCase() : formatPersonName(persona.nombre_completo)}
                                </h1>
                                <div className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight border bg-slate-100 text-slate-600 border-slate-200">
                                    {persona.origen_dato || 'Manual'}
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-4 text-sm">
                                {!isLegalEntity(persona) && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] uppercase font-bold text-slate-400">DNI</span>
                                        <span className="font-mono text-slate-700">
                                            {persona.dni && (persona.dni.startsWith('SIN-DNI-') || persona.dni.startsWith('SIN_DNI_') || persona.dni.startsWith('TEMP-'))
                                                ? <Badge variant="outline" className="font-mono text-[10px] bg-slate-50 text-slate-500 border-dashed">Pendiente</Badge>
                                                : (persona.dni || 'N/A')}
                                        </span>
                                    </div>
                                )}
                                {(() => {
                                    const rawCuit = persona.cuit || (isLegalEntity(persona) ? persona.dni : null);
                                    const digits = rawCuit ? rawCuit.replace(/\D/g, '') : '';
                                    const isValid = digits.length >= 10 && digits.length <= 11 && ['20','23','24','27','30','33','34'].some(p => digits.startsWith(p));
                                    if (isValid) {
                                        return (
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] uppercase font-bold text-slate-400">CUIT</span>
                                                <span className="font-mono text-slate-700">{formatCUIT(digits)}</span>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                                {persona.fecha_nacimiento && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] uppercase font-bold text-slate-400">
                                            {isLegalEntity(persona) ? 'Const' : 'Nac'}
                                        </span>
                                        <span className="text-slate-600">{formatDateInstructions(persona.fecha_nacimiento)}</span>
                                    </div>
                                )}
                            </div>

                            {/* Contact Info */}
                            {(persona.contacto?.telefono || persona.contacto?.email) && (
                                <div className="flex flex-wrap gap-3 pt-2">
                                    {persona.contacto.telefono && (
                                        <a
                                            href={`tel:${persona.contacto.telefono}`}
                                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 text-slate-600 border border-slate-100 hover:bg-slate-100 hover:text-slate-900 transition-colors text-xs font-medium"
                                        >
                                            <Phone size={12} className="text-slate-400" />
                                            {persona.contacto.telefono}
                                        </a>
                                    )}
                                    {persona.contacto.email && (
                                        <a
                                            href={`mailto:${persona.contacto.email}`}
                                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 text-slate-600 border border-slate-100 hover:bg-slate-100 hover:text-slate-900 transition-colors text-xs font-medium"
                                        >
                                            <Mail size={12} className="text-slate-400" />
                                            {persona.contacto.email}
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Action Buttons */}
                    <div className="flex items-center gap-2">
                        {persona.dni && <TimelineAuditoria recordId={persona.dni} entityName="Cliente" />}
                        <SendFichaDialog persona={persona} />
                        <EditarClienteDialog persona={persona} />
                        <DeleteClienteDialog
                            personaId={persona.dni}
                            personaNombre={persona.nombre_completo}
                            onClienteDeleted={() => router.push('/clientes')}
                        />
                    </div>
                </div>
            </Card>
        </div>
    );
}
