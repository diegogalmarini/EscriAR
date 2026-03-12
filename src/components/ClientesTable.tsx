"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Mail, Eye, ArrowUpDown, Users } from "lucide-react";
import { SendFichaDialog } from "@/components/SendFichaDialog";
import { EditarClienteDialog } from "@/components/EditarClienteDialog";
import { DeleteClienteDialog } from "@/components/DeleteClienteDialog";
import { formatDateInstructions, formatCUIT } from "@/lib/utils";
import { isLegalEntity, formatClienteDisplayName } from "@/lib/utils/normalization";

interface ClientesTableProps {
    data: any[];
    onClienteDeleted: () => void;
}

type SortKey = "nombre" | "documento" | "origen";
type SortDirection = "asc" | "desc";

interface SortConfig {
    key: SortKey;
    direction: SortDirection;
}

export function ClientesTable({ data, onClienteDeleted }: ClientesTableProps) {
    const router = useRouter();
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "nombre", direction: "asc" });

    // --- Data Processing for Sorting ---
    const processedData = data.map(item => ({
        ...item,
        displayName: formatClienteDisplayName(item),
        displayDocument: isLegalEntity(item) ? item.cuit : item.dni,
        isLegal: isLegalEntity(item)
    }));

    const sortedData = [...processedData].sort((a, b) => {
        const { key, direction } = sortConfig;
        const multiplier = direction === "asc" ? 1 : -1;

        if (key === "nombre") {
            return a.displayName.localeCompare(b.displayName) * multiplier;
        }

        if (key === "documento") {
            const docA = (a.displayDocument || "").toString();
            const docB = (b.displayDocument || "").toString();
            return docA.localeCompare(docB) * multiplier;
        }

        if (key === "origen") {
            const orgA = a.origen_dato || "";
            const orgB = b.origen_dato || "";
            return orgA.localeCompare(orgB) * multiplier;
        }

        return 0;
    });

    const handleSort = (key: SortKey) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === "asc" ? "desc" : "asc"
        }));
    };

    return (
        <Table>
            <TableHeader>
                <TableRow className="bg-slate-50/50">
                    <TableHead className="w-[30%]">
                        <Button
                            variant="ghost"
                            onClick={() => handleSort("nombre")}
                            className="h-8 text-xs font-normal text-muted-foreground hover:bg-slate-100 px-2 -ml-2"
                        >
                            Nombre Completo
                            <ArrowUpDown className="ml-2 h-3 w-3" />
                        </Button>
                    </TableHead>
                    <TableHead className="w-[20%]">
                        <Button
                            variant="ghost"
                            onClick={() => handleSort("documento")}
                            className="h-8 text-xs font-normal text-muted-foreground hover:bg-slate-100 px-2 -ml-2"
                        >
                            Documento
                            <ArrowUpDown className="ml-2 h-3 w-3" />
                        </Button>
                    </TableHead>
                    <TableHead className="w-[25%] text-xs font-normal text-muted-foreground">Contacto</TableHead>
                    <TableHead className="w-[10%] text-center">
                        <Button
                            variant="ghost"
                            onClick={() => handleSort("origen")}
                            className="h-8 text-xs font-normal text-muted-foreground hover:bg-slate-100 px-2"
                        >
                            Origen
                            <ArrowUpDown className="ml-2 h-3 w-3" />
                        </Button>
                    </TableHead>
                    <TableHead className="text-right w-[15%] text-xs font-normal text-muted-foreground">Acciones</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {sortedData.map((persona) => (
                    <TableRow key={persona.dni} className="group hover:bg-slate-50/50">
                        <TableCell className="py-2.5">
                            <div className="flex flex-col">
                                <span className="text-sm font-normal text-slate-700 leading-tight">
                                    {persona.displayName}
                                </span>
                                {persona.fecha_nacimiento && (
                                    <span className="text-[9px] text-muted-foreground font-light uppercase tracking-tighter">
                                        {persona.isLegal ? 'Const:' : 'Nac:'} {formatDateInstructions(persona.fecha_nacimiento)}
                                    </span>
                                )}
                            </div>
                        </TableCell>
                        <TableCell className="py-2.5">
                            <div className="flex flex-col gap-0.5">
                                {!persona.isLegal && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[9px] uppercase font-normal text-slate-400">DNI</span>
                                        <span className="font-mono text-[11px] font-light text-slate-700">
                                            {persona.dni && (persona.dni.startsWith('SIN-DNI-') || persona.dni.startsWith('SIN_DNI_') || persona.dni.startsWith('TEMP-'))
                                                ? <Badge variant="outline" className="font-mono text-[9px] px-1 py-0 h-4 bg-slate-50 text-slate-500 border-dashed font-light">Pendiente</Badge>
                                                : (persona.dni || 'N/A')}
                                        </span>
                                    </div>
                                )}
                                {(() => {
                                    // Determine the best CUIT to display
                                    const rawCuit = persona.cuit || (persona.isLegal ? persona.dni : null);
                                    const digits = rawCuit ? rawCuit.replace(/\D/g, '') : '';
                                    const isValidCuit = digits.length >= 10 && digits.length <= 11 && ['20','23','24','27','30','33','34'].some((p: string) => digits.startsWith(p));

                                    if (isValidCuit) {
                                        return (
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[9px] uppercase font-normal text-slate-400">CUIT</span>
                                                <span className="font-mono text-[11px] font-light text-slate-700">{formatCUIT(digits)}</span>
                                            </div>
                                        );
                                    } else if (persona.isLegal) {
                                        return (
                                            <div className="flex items-center gap-1.5">
                                                <Badge variant="outline" className="font-mono text-[9px] px-1 py-0 h-4 bg-amber-50 text-amber-600 border-dashed font-light">Sin CUIT</Badge>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>
                        </TableCell>
                        <TableCell className="py-2.5">
                            <div className="flex flex-wrap gap-1">
                                {persona.contacto?.telefono && (
                                    <a
                                        href={`tel:${persona.contacto.telefono}`}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-100 hover:bg-slate-100 hover:text-slate-900 transition-colors text-[10px] font-light"
                                        title="Llamar"
                                    >
                                        <Phone size={10} className="text-slate-400" />
                                        {persona.contacto.telefono}
                                    </a>
                                )}
                                {persona.contacto?.email && (
                                    <a
                                        href={`mailto:${persona.contacto.email}`}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-100 hover:bg-slate-100 hover:text-slate-900 transition-colors text-[10px] font-light"
                                        title="Email"
                                    >
                                        <Mail size={10} className="text-slate-400" />
                                        {persona.contacto.email}
                                    </a>
                                )}
                            </div>
                        </TableCell>
                        <TableCell className="text-center py-2.5">
                            <div className="inline-flex items-center px-1 py-0 h-4 rounded text-[9px] font-light uppercase tracking-tight border bg-slate-100 text-slate-600 border-slate-200">
                                {persona.origen_dato || 'Manual'}
                            </div>
                        </TableCell>
                        <TableCell className="text-right py-2.5">
                            <div className="flex justify-end gap-0.5 px-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => router.push(`/clientes/${persona.dni}`)}
                                    className="h-7 w-7 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                                    title="Ver detalles"
                                >
                                    <Eye size={14} />
                                </Button>
                                <SendFichaDialog persona={persona} />
                                <EditarClienteDialog persona={persona} />
                                <DeleteClienteDialog
                                    personaId={persona.dni}
                                    personaNombre={persona.nombre_completo}
                                    onClienteDeleted={onClienteDeleted}
                                />
                            </div>
                        </TableCell>
                    </TableRow>
                ))}
                {sortedData.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center py-20 text-muted-foreground">
                            <Users className="mx-auto h-12 w-12 opacity-20 mb-4" />
                            No se encontraron clientes.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    );
}
