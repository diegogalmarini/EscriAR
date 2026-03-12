"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileText, FileSignature, Calculator } from "lucide-react";
import { ModelosTab } from "@/app/admin/users/ModelosTab";

export default function ModelosPage() {
    const [activeTab, setActiveTab] = useState("escrituras");

    return (
        <div className="p-8 space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Modelos</h1>
                <p className="text-muted-foreground">
                    Gestión de plantillas DOCX para generación documental
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
                <TabsList className="bg-slate-100 p-1">
                    <TabsTrigger value="escrituras" className="gap-2 px-6">
                        <FileText size={16} />
                        Escrituras
                    </TabsTrigger>
                    <TabsTrigger value="instrumentos_privados" className="gap-2 px-6">
                        <FileSignature size={16} />
                        Instrumentos Privados
                    </TabsTrigger>
                    <TabsTrigger value="presupuestos" className="gap-2 px-6">
                        <Calculator size={16} />
                        Presupuestos
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="escrituras" className="mt-0 border-none p-0 focus-visible:ring-0">
                    <ModelosTab instrumentCategory="ESCRITURA_PUBLICA" />
                </TabsContent>
                <TabsContent value="instrumentos_privados" className="mt-0 border-none p-0 focus-visible:ring-0">
                    <ModelosTab instrumentCategory="INSTRUMENTO_PRIVADO" />
                </TabsContent>
                <TabsContent value="presupuestos" className="mt-0 border-none p-0 focus-visible:ring-0">
                    <ModelosTab instrumentCategory="PRESUPUESTO" />
                </TabsContent>
            </Tabs>
        </div>
    );
}
