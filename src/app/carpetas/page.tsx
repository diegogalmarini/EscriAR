"use client";

import { createClient } from "@/lib/supabaseClient"; // Use client-side client
import { Button } from "@/components/ui/button";
import { PlusCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { CarpetasTable } from "@/components/CarpetasTable";
import { PaginationControls } from "@/components/PaginationControls";
import { useState, useEffect, useCallback } from "react";
import { useDebounce } from "use-debounce";

export default function CarpetasPage() {
    const [carpetas, setCarpetas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm] = useDebounce(searchTerm, 500); // Wait 500ms before searching

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [totalItems, setTotalItems] = useState(0);

    const fetchCarpetas = useCallback(async () => {
        setLoading(true);
        try {
            const offset = (currentPage - 1) * pageSize;

            // Call the RPC function
            const { data, error } = await createClient()
                .rpc('search_carpetas', {
                    search_term: debouncedSearchTerm,
                    p_limit: pageSize,
                    p_offset: offset
                });

            if (error) {
                console.error("Error fetching carpetas:", error);
            } else if (data) {
                // The RPC returns total_count in each row. We pick it from the first row.
                const total = data.length > 0 ? Number(data[0].total_count) : 0;
                setCarpetas(data);
                setTotalItems(total);
            }
        } catch (err) {
            console.error("Exception fetching carpetas:", err);
        } finally {
            setLoading(false);
        }
    }, [debouncedSearchTerm, currentPage, pageSize]);

    useEffect(() => {
        fetchCarpetas();
    }, [fetchCarpetas]);

    // Reset to page 1 when search term changes
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm]);

    const totalPages = Math.ceil(totalItems / pageSize);

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Expedientes / Carpetas</h1>
                    <p className="text-muted-foreground">Listado completo de todas las operaciones notariales.</p>
                </div>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Nueva Carpeta
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por número, caratula, personas (nombre, DNI, CUIT)..."
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
                        <CarpetasTable data={carpetas || []} />
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

