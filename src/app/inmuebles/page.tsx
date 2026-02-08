"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { NuevoInmuebleDialog } from "@/components/NuevoInmuebleDialog";
import { InmueblesTable } from "@/components/InmueblesTable";

export default function InmueblesPage() {
    const [inmuebles, setInmuebles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    async function fetchInmuebles() {
        try {
            const { data, error } = await supabase
                .from("inmuebles")
                .select("*");

            if (error) {
                console.error("Error fetching inmuebles:", error);
            } else if (data) {
                console.log("🏠 Fetched", data.length, "inmuebles");
                setInmuebles(data);
            }
        } catch (err) {
            console.error("Exception fetching inmuebles:", err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchInmuebles();
    }, []);

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
                            <Input placeholder="Buscar por partida, partido o nomenclatura..." className="pl-10" />
                        </div>
                        <Button variant="outline">Filtrar</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <InmueblesTable data={inmuebles} onInmuebleDeleted={fetchInmuebles} />
                </CardContent>
            </Card>
        </div>
    );
}
