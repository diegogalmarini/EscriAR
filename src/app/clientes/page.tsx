"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState, useCallback } from "react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { NuevoClienteDialog } from "@/components/NuevoClienteDialog";
import { ClientesTable } from "@/components/ClientesTable";

import { useRouter } from "next/navigation";

export default function ClientesPage() {
    const router = useRouter();
    const [personas, setPersonas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filteredPersonas, setFilteredPersonas] = useState<any[]>([]);

    const fetchPersonas = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from("personas")
                .select("*")
                .order("nombre_completo", { ascending: true });

            if (error) {
                console.error("Error fetching personas:", error);
            } else if (data) {
                setPersonas(data);
                setFilteredPersonas(data);
            }
        } catch (err) {
            console.error("Exception fetching personas:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPersonas();
    }, [fetchPersonas]);

    // Update filtered list when search term or personas change
    useEffect(() => {
        if (!searchTerm.trim()) {
            setFilteredPersonas(personas);
            return;
        }

        const lowercaseSearch = searchTerm.toLowerCase();
        const filtered = personas.filter(p =>
            p.nombre_completo?.toLowerCase().includes(lowercaseSearch) ||
            p.dni?.toLowerCase().includes(lowercaseSearch) ||
            p.cuit?.toLowerCase().includes(lowercaseSearch)
        );
        setFilteredPersonas(filtered);
    }, [searchTerm, personas]);

    if (loading) {
        return (
            <div className="p-8">
                <div className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
                    <div className="h-64 bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
                    <p className="text-muted-foreground">Gestión de personas y participantes vinculados al sistema.</p>
                </div>
                <NuevoClienteDialog />
            </div>

            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="p-4 border-b">
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nombre, CUIT o DNI..."
                                className="pl-10 h-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" className="h-10">Filtrar</Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <ClientesTable data={filteredPersonas} onClienteDeleted={fetchPersonas} />
                </CardContent>
            </Card>
        </div>
    );
}
