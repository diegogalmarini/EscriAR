"use client";

import { useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Building2, ArrowUpDown, Eye } from "lucide-react";
import Link from "next/link";

import { useRouter } from "next/navigation";
// import { VerInmuebleDialog } from "@/components/VerInmuebleDialog"; // REMOVED

import { DeleteInmuebleDialog } from "@/components/DeleteInmuebleDialog";

interface InmueblesTableProps {
    data: any[];
    onInmuebleDeleted: () => void;
}

type SortKey = "partido" | "partida" | "nomenclatura";
type SortDirection = "asc" | "desc";

interface SortConfig {
    key: SortKey;
    direction: SortDirection;
}

export function InmueblesTable({ data, onInmuebleDeleted }: InmueblesTableProps) {
    const router = useRouter();

    const handleRowClick = (inmueble: any) => {
        router.push(`/inmuebles/${inmueble.id}`);
    };
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "nomenclatura", direction: "asc" });

    const sortedData = [...data].sort((a, b) => {
        const { key, direction } = sortConfig;
        const multiplier = direction === "asc" ? 1 : -1;

        if (key === "partido") {
            const valA = a.partido_id || "";
            const valB = b.partido_id || "";
            return valA.localeCompare(valB) * multiplier;
        }

        if (key === "partida") {
            // Try to sort numerically if possible, otherwise string
            const valA = a.nro_partida || "";
            const valB = b.nro_partida || "";
            return valA.localeCompare(valB, undefined, { numeric: true }) * multiplier;
        }

        if (key === "nomenclatura") {
            const valA = a.nomenclatura || "";
            const valB = b.nomenclatura || "";
            return valA.localeCompare(valB) * multiplier;
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
        <Table className="w-full">
            <TableHeader>
                <TableRow className="bg-slate-50/50">
                    <TableHead className="w-[20%]">
                        <Button
                            variant="ghost"
                            onClick={() => handleSort("partido")}
                            className="h-8 text-xs font-normal text-muted-foreground hover:bg-slate-100 px-2 -ml-2"
                        >
                            Partido / Dpto
                            <ArrowUpDown className="ml-2 h-3 w-3" />
                        </Button>
                    </TableHead>
                    <TableHead className="w-[15%]">
                        <Button
                            variant="ghost"
                            onClick={() => handleSort("partida")}
                            className="h-8 text-xs font-normal text-muted-foreground hover:bg-slate-100 px-2 -ml-2"
                        >
                            Nro. Partida
                            <ArrowUpDown className="ml-2 h-3 w-3" />
                        </Button>
                    </TableHead>
                    <TableHead className="w-[53%]">
                        <Button
                            variant="ghost"
                            onClick={() => handleSort("nomenclatura")}
                            className="h-8 text-xs font-normal text-muted-foreground hover:bg-slate-100 px-2 -ml-2"
                        >
                            Nomenclatura
                            <ArrowUpDown className="ml-2 h-3 w-3" />
                        </Button>
                    </TableHead>
                    <TableHead className="text-right w-[12%] text-xs font-normal text-muted-foreground">Acciones</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {sortedData.map((inmueble) => (
                    <TableRow
                        key={inmueble.id}
                        className="group hover:bg-slate-50/50 cursor-pointer transition-colors"
                        onClick={() => router.push(`/inmuebles/${inmueble.id}`)}
                    >
                        <TableCell className="py-2 align-top truncate" title={inmueble.partido_id}>
                            <div className="flex items-center gap-2 truncate text-sm font-normal text-slate-700">
                                <span className="truncate">{inmueble.partido_id || 'N/A'}</span>
                            </div>
                        </TableCell>
                        <TableCell className="py-2 align-top" title={inmueble.nro_partida} onClick={(e) => e.stopPropagation()}>
                            <div className="font-mono text-xs font-medium space-y-0.5">
                                {(inmueble.nro_partida || 'N/A')
                                    .split(/[;]/)
                                    .map((p: string, idx: number) => (
                                        <Link
                                            key={idx}
                                            href={`/inmuebles/${inmueble.id}`}
                                            className="block text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap"
                                        >
                                            {p.trim()}
                                        </Link>
                                    ))}
                            </div>
                        </TableCell>
                        <TableCell className="align-top py-2 max-w-md">
                            <div className="text-xs leading-tight font-normal text-slate-700 break-words">
                                {inmueble.nomenclatura || 'Sin nomenclatura'}
                            </div>
                        </TableCell>
                        <TableCell className="text-right align-top py-2">
                            <div className="flex justify-end items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                                    onClick={() => router.push(`/inmuebles/${inmueble.id}`)}
                                >
                                    <Eye size={16} />
                                </Button>
                                <DeleteInmuebleDialog
                                    inmuebleId={inmueble.id}
                                    nomenclatura={inmueble.nomenclatura}
                                    onInmuebleDeleted={onInmuebleDeleted}
                                />
                            </div>
                        </TableCell>
                    </TableRow>
                ))}
                {sortedData.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={4} className="text-center py-20 text-muted-foreground">
                            <Building2 className="mx-auto h-12 w-12 opacity-20 mb-4" />
                            No se encontraron inmuebles registrados.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    );
}
