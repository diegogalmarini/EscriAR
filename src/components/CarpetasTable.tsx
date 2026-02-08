"use client";

import { useState } from "react";
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
import { ArrowUpDown, FolderKanban } from "lucide-react";

interface CarpetasTableProps {
    data: any[];
}

type SortKey = "numero" | "acto" | "nro_acto" | "partes";
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
        const op = carpeta.escrituras?.[0]?.operaciones?.[0];
        if (op?.tipo_acto) return op.tipo_acto;
        return "SIN ACTO";
    };

    // 1b. Get Nro Acto (CESBA Code)
    const getNroActo = (carpeta: any) => {
        const op = carpeta.escrituras?.[0]?.operaciones?.[0];
        return op?.nro_acto || "-";
    };

    // 2. Get Partes (Buyers/Owners)
    const getPartes = (carpeta: any) => {
        const buyers: string[] = [];

        carpeta.escrituras?.forEach((escritura: any) => {
            escritura.operaciones?.forEach((op: any) => {
                op.participantes_operacion?.forEach((p: any) => {
                    const role = p.rol?.toUpperCase();
                    if (['COMPRADOR', 'ADQUIRENTE', 'CESIONARIO', 'FIDUCIARIO', 'ACREEDOR'].some(r => role?.includes(r))) {
                        const personRaw = p.personas || p.persona;
                        const person = Array.isArray(personRaw) ? personRaw[0] : personRaw;

                        if (person) {
                            let formattedName = "";
                            if (person.tipo_persona === 'JURIDICA' || person.cuit?.startsWith('30') || person.cuit?.startsWith('33')) {
                                formattedName = person.nombre_completo;
                            } else {
                                if (person.nombre_completo.includes(",")) {
                                    const [surname, name] = person.nombre_completo.split(",").map((s: string) => s.trim());
                                    formattedName = `${surname.toUpperCase()} ${name}`;
                                } else {
                                    const allParts = person.nombre_completo.split(" ");
                                    if (allParts.length > 1) {
                                        const last = allParts.pop();
                                        formattedName = `${last?.toUpperCase()} ${allParts.join(" ")}`;
                                    } else {
                                        formattedName = person.nombre_completo.toUpperCase();
                                    }
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
        displayNroActo: getNroActo(item),
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

        if (key === "nro_acto") {
            return a.displayNroActo.localeCompare(b.displayNroActo) * multiplier;
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

    const handleRowClick = (id: string) => {
        router.push(`/carpeta/${id}`);
    };

    return (
        <div className="w-full">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[80px]">
                            <Button
                                variant="ghost"
                                onClick={() => handleSort("numero")}
                                className="h-8 text-xs font-semibold hover:bg-slate-100 px-2"
                            >
                                Nº
                                <ArrowUpDown className="ml-1 h-3 w-3" />
                            </Button>
                        </TableHead>
                        <TableHead className="w-[100px]">
                            <Button
                                variant="ghost"
                                onClick={() => handleSort("nro_acto")}
                                className="h-8 text-xs font-semibold hover:bg-slate-100 px-2"
                            >
                                Código
                                <ArrowUpDown className="ml-1 h-3 w-3" />
                            </Button>
                        </TableHead>
                        <TableHead>
                            <Button
                                variant="ghost"
                                onClick={() => handleSort("acto")}
                                className="h-8 text-xs font-semibold hover:bg-slate-100 px-2"
                            >
                                Acto
                                <ArrowUpDown className="ml-1 h-3 w-3" />
                            </Button>
                        </TableHead>
                        <TableHead>
                            <Button
                                variant="ghost"
                                onClick={() => handleSort("partes")}
                                className="h-8 text-xs font-semibold hover:bg-slate-100 px-2"
                            >
                                Partes
                                <ArrowUpDown className="ml-1 h-3 w-3" />
                            </Button>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedData.map((carpeta) => (
                        <TableRow
                            key={carpeta.id}
                            className="cursor-pointer hover:bg-slate-100 transition-colors"
                            onClick={() => handleRowClick(carpeta.id)}
                        >
                            <TableCell className="font-mono text-xs font-medium text-slate-600">
                                #{carpeta.nro_carpeta_interna}
                            </TableCell>
                            <TableCell>
                                <code className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono text-xs">
                                    {carpeta.displayNroActo}
                                </code>
                            </TableCell>
                            <TableCell className="text-xs font-medium text-slate-700 max-w-[300px] truncate">
                                {carpeta.displayActo}
                            </TableCell>
                            <TableCell className="text-xs text-slate-600 max-w-[200px] truncate">
                                {carpeta.displayPartes}
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
        </div>
    );
}
