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
import { useDebounce } from "use-debounce";

export default function InmueblesPage() {
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

            const { data, error } = await supabase
                .rpc('search_inmuebles', {
                    search_term: debouncedSearchTerm,
                    p_limit: pageSize,
                    p_offset: offset
                });

            if (error) {
                console.error("Error fetching inmuebles:", error);
            } else if (data) {
                const total = data.length > 0 ? Number(data[0].total_count) : 0;
                setInmuebles(data);
                setTotalItems(total);
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
        </div>
    );
}
