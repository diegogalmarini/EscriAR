"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileText, ArrowUpDown, FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";

interface CarpetasTableProps {
    data: any[];
}

type SortKey = "numero" | "acto" | "partes";
type SortDirection = "asc" | "desc";

interface SortConfig {
    key: SortKey;
    direction: SortDirection;
}

export function CarpetasTable({ data }: CarpetasTableProps) {
    const router = useRouter();
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "numero", direction: "desc" });

    // --- Helper Functions ---

    // 1. Get Acto (Operation Type)
    const getActo = (carpeta: any) => {
        // Try to find the first operation type
        const op = carpeta.escrituras?.[0]?.operaciones?.[0];
        if (op?.tipo_acto) return op.tipo_acto;
        // Fallback: Check if there's a caratula hint or return default
        return "SIN ACTO";
    };

    // 2. Get Partes (Buyers/Owners)
    const getPartes = (carpeta: any) => {
        const buyers: string[] = [];

        // Iterate through deeds/operations to find buyers
        carpeta.escrituras?.forEach((escritura: any) => {
            escritura.operaciones?.forEach((op: any) => {
                op.participantes_operacion?.forEach((p: any) => {
                    // Check for buyer roles
                    const role = p.rol?.toUpperCase();
                    if (['COMPRADOR', 'ADQUIRENTE', 'CESIONARIO', 'FIDUCIARIO', 'ACREEDOR'].some(r => role?.includes(r))) {
                        const person = p.persona;
                        if (person) {
                            let formattedName = "";
                            if (person.tipo_persona === 'JURIDICA' || person.cuit?.startsWith('30') || person.cuit?.startsWith('33')) {
                                // Legal Entity: Full Name
                                formattedName = person.nombre_completo;
                            } else {
                                // Natural Person: SURNAME Name
                                // We assume nombre_completo is "Surname Name" or we format it
                                // Based on user request: "APELLIDO Nombre"
                                const parts = person.nombre_completo.trim().split(/\s+/);
                                if (parts.length >= 2) {
                                    // Heuristic: Last parts are usually surname in many systems, 
                                    // BUT user request implies specific format. 
                                    // Only way to be sure is if we have separate fields. 
                                    // If we only have full name string, we assume standarization.
                                    // Let's use the helper logic: "SURNAME Name"
                                    // Wait, standard in DB might be "Name Surname". 
                                    // If we use the 'normalization' logic from plan:
                                    // "APELLIDO Nombre"
                                    // Let's try to detect if it's already upper.

                                    // Standard approach: Uppercase the SURNAME (usually the last word(s) if not comma separated)
                                    // Actually, let's keep it simple for now and rely on visual cues.
                                    // Most robust way for Argentina: split by comma if exists.

                                    if (person.nombre_completo.includes(",")) {
                                        const [surname, name] = person.nombre_completo.split(",").map((s: string) => s.trim());
                                        formattedName = `${surname.toUpperCase()} ${name}`;
                                    } else {
                                        // "Juan PEREZ" -> "PEREZ Juan" ?? 
                                        // Or "PEREZ Juan" -> "PEREZ Juan"
                                        // Without specific structure, this is tricky. 
                                        // Let's try to identify UPPERCASE parts as surnames.

                                        // If the user says "Always APELLIDO Nombre", and input is "Juan Perez", 
                                        // we'll try to guess. 
                                        // For now, let's display as is but ensure uppercase surname if possible.
                                        // Let's just UpperCase the whole thing for consistency if mixed? No, request says "APELLIDO y Nombre".
                                        // Let's assume the DB has "Surname Name" or "Name Surname".

                                        // Re-reading common pattern: 
                                        // If no comma, usually "First Last". We want "LAST First".
                                        const allParts = person.nombre_completo.split(" ");
                                        if (allParts.length > 1) {
                                            const last = allParts.pop();
                                            formattedName = `${last?.toUpperCase()} ${allParts.join(" ")}`;
                                        } else {
                                            formattedName = person.nombre_completo.toUpperCase();
                                        }
                                    }
                                } else {
                                    formattedName = person.nombre_completo;
                                }
                            }
                            if (formattedName && !buyers.includes(formattedName)) {
                                buyers.push(formattedName);
                            }
                        }
                    }
                });
            });
        });

        if (buyers.length === 0) return " - ";
        if (buyers.length === 1) return buyers[0];
        return `${buyers[0]} y Otros...`;
    };

    // --- Sort Logic ---

    const processedData = data.map(item => ({
        ...item,
        displayActo: getActo(item),
        displayPartes: getPartes(item)
    }));

    const sortedData = [...processedData].sort((a, b) => {
        const { key, direction } = sortConfig;
        const multiplier = direction === "asc" ? 1 : -1;

        if (key === "numero") {
            const numA = parseInt(a.nro_carpeta_interna) || 0;
            const numB = parseInt(b.nro_carpeta_interna) || 0;
            return (numA - numB) * multiplier;
        }

        if (key === "acto") {
            return a.displayActo.localeCompare(b.displayActo) * multiplier;
        }

        if (key === "partes") {
            return a.displayPartes.localeCompare(b.displayPartes) * multiplier;
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
                <TableRow>
                    <TableHead className="w-[100px]">
                        <Button
                            variant="ghost"
                            onClick={() => handleSort("numero")}
                            className="h-8 text-xs font-semibold hover:bg-slate-100 px-2"
                        >
                            Número
                            <ArrowUpDown className="ml-2 h-3 w-3" />
                        </Button>
                    </TableHead>
                    <TableHead>
                        <Button
                            variant="ghost"
                            onClick={() => handleSort("acto")}
                            className="h-8 text-xs font-semibold hover:bg-slate-100 px-2"
                        >
                            Acto
                            <ArrowUpDown className="ml-2 h-3 w-3" />
                        </Button>
                    </TableHead>
                    <TableHead>
                        <Button
                            variant="ghost"
                            onClick={() => handleSort("partes")}
                            className="h-8 text-xs font-semibold hover:bg-slate-100 px-2"
                        >
                            Partes
                            <ArrowUpDown className="ml-2 h-3 w-3" />
                        </Button>
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold pr-6">
                        Acciones
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {sortedData.map((carpeta) => (
                    <TableRow key={carpeta.id} className="group hover:bg-slate-50 transition-colors">
                        <TableCell className="font-mono text-xs font-medium text-slate-600">
                            #{carpeta.nro_carpeta_interna}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-slate-700">
                            {carpeta.displayActo}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                            {carpeta.displayPartes}
                        </TableCell>
                        <TableCell className="text-right">
                            <Button variant="ghost" size="sm" asChild className="h-7 text-[11px] font-normal text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                                <Link href={`/carpeta/${carpeta.id}`}>
                                    <FileText className="h-3.5 w-3.5 mr-1" />
                                    Mesa
                                </Link>
                            </Button>
                        </TableCell>
                    </TableRow>
                ))}
                {sortedData.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={4} className="text-center py-20 text-muted-foreground">
                            <FolderKanban className="mx-auto h-12 w-12 opacity-20 mb-4" />
                            No se encontraron carpetas.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    );
}
