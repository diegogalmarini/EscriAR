"use client";

import { Suspense } from "react";
import { ModelosTab } from "@/app/admin/users/ModelosTab";

export default function ModelosPage() {
    return (
        <div className="p-8 space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Modelos de Escrituras</h1>
                <p className="text-muted-foreground">Gestión de plantillas DOCX para generación documental</p>
            </div>
            
            <Suspense fallback={
                <div className="flex justify-center p-12">
                    <span className="text-slate-400">Cargando modelos...</span>
                </div>
            }>
                <ModelosTab />
            </Suspense>
        </div>
    );
}
