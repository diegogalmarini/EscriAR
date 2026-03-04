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
import { ArrowUpDown, FolderKanban, Eye } from "lucide-react";
import { DeleteCarpetaDialog } from "@/components/DeleteCarpetaDialog";

interface CarpetasTableProps {
    data: any[];
    onCarpetaDeleted?: () => void;
}

type SortKey = "numero" | "acto" | "codigo" | "partes";
type SortDirection = "asc" | "desc";

interface SortConfig {
    key: SortKey;
    direction: SortDirection;
}

export function CarpetasTable({ data, onCarpetaDeleted }: CarpetasTableProps) {
    const router = useRouter();
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "numero", direction: "desc" });

    // --- Helper Functions ---
    // Data comes from search_carpetas RPC with shape:
    // { id, number, internal_id, title, status, parties: [{id, full_name, role}], escrituras: [{id, operaciones: [{id, codigo, tipo_acto}]}] }

    // 1. Get Acto (Operation Type) — formatted for display
    const formatActo = (raw: string): string => {
        // snake_case → Title Case ("boleto_compraventa" → "Boleto de Compraventa")
        return raw
            .toLowerCase()
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase())
            .replace(/\bDe\b/g, "de")
            .replace(/\bY\b/g, "y");
    };
    const getActo = (carpeta: any) => {
        const op = carpeta.escrituras?.[0]?.operaciones?.[0];
        if (op?.tipo_acto) return formatActo(op.tipo_acto);
        return "";
    };

    const getCodigo = (carpeta: any) => {
        const op = carpeta.escrituras?.[0]?.operaciones?.[0];
        return op?.codigo || "-";
    };

    // 2. Get Partes from RPC's flat parties array
    // RPC parties shape: { id, full_name, role, tipo_persona, cuit }
    const JURIDICA_KEYWORDS = ['BANCO', 'S.A.', 'S.R.L.', 'S.A.U.', 'SOCIEDAD', 'FIDEICOMISO', 'FUNDACION', 'ASOCIACION', 'COOPERATIVA', 'CONSORCIO', 'S.A.S.', 'S.C.A.'];
    const isJuridica = (p: any) => {
        if (p.tipo_persona === 'JURIDICA' || p.tipo_persona === 'FIDEICOMISO') return true;
        if (p.cuit?.startsWith('30') || p.cuit?.startsWith('33') || p.cuit?.startsWith('34')) return true;
        // Fallback: detectar por nombre cuando tipo_persona no está seteado correctamente
        const upper = (p.full_name || '').toUpperCase();
        return JURIDICA_KEYWORDS.some(kw => upper.includes(kw));
    };

    const getPartes = (carpeta: any) => {
        const parties = carpeta.parties;
        if (!Array.isArray(parties) || parties.length === 0) return " - ";

        const names: string[] = [];
        for (const p of parties) {
            const name = p.full_name;
            if (!name) continue;

            let formattedName = "";
            if (isJuridica(p)) {
                // Persona jurídica: des-invertir si tiene coma (ej: "ARGENTINA, BANCO..." → "BANCO... ARGENTINA")
                if (name.includes(",")) {
                    const parts = name.split(",").map((s: string) => s.trim());
                    formattedName = `${parts.slice(1).join(" ")} ${parts[0]}`.toUpperCase();
                } else {
                    formattedName = name.toUpperCase();
                }
            } else if (name.includes(",")) {
                // Persona física en formato "APELLIDO, Nombre"
                const [surname, first] = name.split(",").map((s: string) => s.trim());
                formattedName = `${surname.toUpperCase()} ${first}`;
            } else {
                // Persona física sin coma: asumir última palabra es apellido
                const allParts = name.split(" ");
                if (allParts.length > 1) {
                    const last = allParts.pop();
                    formattedName = `${last?.toUpperCase()} ${allParts.join(" ")}`;
                } else {
                    formattedName = name.toUpperCase();
                }
            }
            if (formattedName && !names.includes(formattedName)) {
                names.push(formattedName);
            }
        }

        if (names.length === 0) return " - ";
        if (names.length === 1) return names[0];
        return `${names[0]} y Otros...`;
    };

    // --- Sort Logic ---

    const processedData = data.map(item => ({
        ...item,
        displayActo: getActo(item),
        displayCodigo: getCodigo(item),
        displayPartes: getPartes(item)
    }));

    const sortedData = [...processedData].sort((a, b) => {
        const { key, direction } = sortConfig;
        const multiplier = direction === "asc" ? 1 : -1;

        if (key === "numero") {
            const numA = a.number || 0;
            const numB = b.number || 0;
            return (numA - numB) * multiplier;
        }

        if (key === "acto") {
            return a.displayActo.localeCompare(b.displayActo) * multiplier;
        }

        if (key === "codigo") {
            return a.displayCodigo.localeCompare(b.displayCodigo) * multiplier;
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
                                onClick={() => handleSort("codigo")}
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
                        <TableHead className="text-right w-[100px] text-xs font-normal text-muted-foreground">Acciones</TableHead>
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
                                #{carpeta.number || carpeta.internal_id}
                            </TableCell>
                            <TableCell>
                                <code className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono text-xs">
                                    {carpeta.displayCodigo}
                                </code>
                            </TableCell>
                            <TableCell className="text-xs font-medium max-w-[300px] truncate">
                                {carpeta.displayActo
                                    ? <span className="text-slate-700">{carpeta.displayActo}</span>
                                    : <span className="text-muted-foreground italic">Acto a definir...</span>
                                }
                            </TableCell>
                            <TableCell className="text-xs text-slate-600 max-w-[200px] truncate">
                                {carpeta.displayPartes}
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                                        onClick={() => router.push(`/carpeta/${carpeta.id}`)}
                                    >
                                        <Eye size={16} />
                                    </Button>
                                    <DeleteCarpetaDialog
                                        carpetaId={carpeta.id}
                                        caratula={carpeta.caratula}
                                        onCarpetaDeleted={onCarpetaDeleted}
                                    />
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                    {sortedData.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center py-20 text-muted-foreground">
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
