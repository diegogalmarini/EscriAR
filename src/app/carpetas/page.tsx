import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { PlusCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CarpetasTable } from "@/components/CarpetasTable";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CarpetasPage() {
    const { data: carpetas, error } = await supabase
        .from("carpetas")
        .select(`
            *,
            escrituras (
                id,
                nro_escritura,
                fecha_escritura,
                operaciones (
                    id,
                    tipo_acto,
                    participantes_operacion (
                        id,
                        rol,
                        persona:personas (
                            id,
                            nombre_completo,
                            tipo_persona,
                            cuit,
                            dni
                        )
                    )
                )
            )
        `)
        .order('nro_carpeta_interna', { ascending: false });

    if (error) {
        console.error("Error fetching carpetas:", error);
    }

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
                            <Input placeholder="Buscar por número, acto o partes..." className="pl-10" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <CarpetasTable data={carpetas || []} />
                </CardContent>
            </Card>
        </div>
    );
}

