"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { NuevoInmuebleDialog } from "@/components/NuevoInmuebleDialog";
import { InmueblesTable } from "@/components/InmueblesTable";
import { PaginationControls } from "@/components/PaginationControls";
import { useSearchParams, useRouter } from "next/navigation";
import { VerInmuebleDialog } from "@/components/VerInmuebleDialog";
import { useDebounce } from "use-debounce";

import { Suspense } from "react";

function InmueblesContent() {
    // ... existing code ...
    const [inmuebles, setInmuebles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm] = useDebounce(searchTerm, 500);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [totalItems, setTotalItems] = useState(0);

    const fetchInmuebles = useCallback(async () => {
        setLoading(true);
        try {
            const offset = (currentPage - 1) * pageSize;
            const term = debouncedSearchTerm.trim();

            let query = supabase
                .from('inmuebles')
                .select('id, partido_id, partido_code, delegacion_code, nro_partida, nomenclatura, transcripcion_literal, titulo_antecedente, valuacion_fiscal, created_at', { count: 'exact' });

            if (term) {
                query = query.or(
                    `partido_id.ilike.%${term}%,nro_partida.ilike.%${term}%,nomenclatura.ilike.%${term}%,partido_code.ilike.%${term}%`
                );
            }

            const { data, error, count } = await query
                .order('partido_id', { ascending: true })
                .order('nro_partida', { ascending: true })
                .range(offset, offset + pageSize - 1);

            if (error) {
                console.error("Error fetching inmuebles:", error);
            } else if (data) {
                setInmuebles(data);
                setTotalItems(count || data.length);
            }
        } catch (err) {
            console.error("Exception fetching inmuebles:", err);
        } finally {
            setLoading(false);
        }
    }, [debouncedSearchTerm, currentPage, pageSize]);

    useEffect(() => {
        fetchInmuebles();
    }, [fetchInmuebles]);

    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm]);

    const [selectedInmueble, setSelectedInmueble] = useState<any>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const searchParams = useSearchParams();
    const router = useRouter();

    // ... existing pagination state ...

    // Effects for handling URL query param for deep linking
    useEffect(() => {
        const id = searchParams.get('id');
        if (id) {
            const fetchInmuebleById = async () => {
                const { data, error } = await supabase
                    .from('inmuebles')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (data) {
                    setSelectedInmueble(data);
                    setDialogOpen(true);
                }
            };
            fetchInmuebleById();
        }
    }, [searchParams]);

    const handleDialogChange = (open: boolean) => {
        setDialogOpen(open);
        if (!open) {
            const params = new URLSearchParams(searchParams.toString());
            params.delete('id');
            router.replace(`/inmuebles?${params.toString()}`);
            setSelectedInmueble(null);
        }
    };

    const totalPages = Math.ceil(totalItems / pageSize);

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Inmuebles</h1>
                    <p className="text-muted-foreground">Base de datos de propiedades y nomenclaturas catastrales.</p>
                </div>
                <NuevoInmuebleDialog />
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por partida, partido o nomenclatura..."
                                className="pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="p-8">
                            <div className="animate-pulse space-y-4">
                                <div className="h-8 bg-gray-200 rounded w-full"></div>
                                <div className="h-8 bg-gray-200 rounded w-full"></div>
                                <div className="h-8 bg-gray-200 rounded w-full"></div>
                            </div>
                        </div>
                    ) : (
                        <InmueblesTable data={inmuebles} onInmuebleDeleted={fetchInmuebles} />
                    )}
                </CardContent>
                <CardFooter className="border-t p-4">
                    <PaginationControls
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        pageSize={pageSize}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={setPageSize}
                    />
                </CardFooter>
            </Card>

            {selectedInmueble && (
                <VerInmuebleDialog
                    inmueble={selectedInmueble}
                    open={dialogOpen}
                    onOpenChange={handleDialogChange}
                    hideTrigger={true}
                />
            )}
        </div>
    );
}

export default function InmueblesPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Cargando buscador...</div>}>
            <InmueblesContent />
        </Suspense>
    );
}
