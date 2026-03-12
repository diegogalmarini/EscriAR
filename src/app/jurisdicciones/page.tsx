"use client";

import { Suspense } from "react";
import { JurisdiccionesTab } from "@/app/admin/users/JurisdiccionesTab";

export default function JurisdiccionesPage() {
    return (
        <div className="p-8 space-y-6">
            <Suspense fallback={
                <div className="flex justify-center p-12">
                    <span className="text-slate-400">Cargando jurisdicciones...</span>
                </div>
            }>
                <JurisdiccionesTab />
            </Suspense>
        </div>
    );
}
