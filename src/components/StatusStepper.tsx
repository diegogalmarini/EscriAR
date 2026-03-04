"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleDot, Clock, FileCheck, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateFolderStatus } from "@/app/actions/carpeta";
import { toast } from "sonner";

const STATES = [
    { id: "ABIERTA", label: "Abierta", icon: Clock },
    { id: "EN_REDACCION", label: "Redacción", icon: CircleDot },
    { id: "PARA_FIRMA", label: "Para Firma", icon: FileCheck },
    { id: "FIRMADA", label: "Firmada", icon: Check },
    { id: "INSCRIPTA", label: "Inscripta", icon: Landmark },
];

export function StatusStepper({ folderId, currentStatus }: { folderId: string; currentStatus: string }) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleStatusChange = async (newStatus: string) => {
        startTransition(async () => {
            const res = await updateFolderStatus(folderId, newStatus);
            if (res.success) {
                toast.success(`Estado actualizado a ${newStatus}`);
                router.refresh();
            } else {
                toast.error(res.error);
            }
        });
    };

    const currentIndex = STATES.findIndex((s) => s.id === currentStatus);

    return (
        <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg border shadow-inner overflow-x-auto no-scrollbar">
            {STATES.map((state, index) => {
                const Icon = state.icon;
                const isActive = index <= currentIndex;
                const isCurrent = state.id === currentStatus;

                return (
                    <div key={state.id} className="flex items-center gap-1 last:pr-1">
                        <button
                            onClick={() => handleStatusChange(state.id)}
                            disabled={isPending}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                                isCurrent
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : isActive
                                        ? "text-primary hover:bg-primary/10"
                                        : "text-muted-foreground hover:bg-muted opacity-50"
                            )}
                        >
                            <Icon className={cn("h-3.5 w-3.5", isCurrent && "animate-pulse")} />
                            <span className="hidden sm:inline">{state.label}</span>
                        </button>
                        {index < STATES.length - 1 && (
                            <div className={cn("h-px w-3 sm:w-6 bg-border mx-1", index < currentIndex && "bg-primary/30")} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
