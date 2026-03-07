import Link from "next/link";
import {
    AlertTriangle,
    ShieldX,
    Clock,
    ShieldAlert,
    FileWarning,
} from "lucide-react";
import {
    getPendingActionsSummary,
    type PendingAlert,
} from "@/app/actions/pendientes";

const ICON_MAP: Record<string, React.ElementType> = {
    certs_vencidos: ShieldX,
    certs_por_vencer: Clock,
    certs_sin_confirmar: ShieldAlert,
    sugerencias_pendientes: AlertTriangle,
    actuaciones_draft: FileWarning,
};

const SEVERITY_STYLES: Record<string, { bg: string; border: string; dot: string; text: string }> = {
    critical: {
        bg: "bg-red-50",
        border: "border-red-200",
        dot: "bg-red-500",
        text: "text-red-700",
    },
    warning: {
        bg: "bg-amber-50",
        border: "border-amber-200",
        dot: "bg-amber-500",
        text: "text-amber-700",
    },
    info: {
        bg: "bg-blue-50",
        border: "border-blue-200",
        dot: "bg-blue-500",
        text: "text-blue-600",
    },
};

function AlertCard({ alert }: { alert: PendingAlert }) {
    const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info;
    const Icon = ICON_MAP[alert.key] || AlertTriangle;

    return (
        <div className={`rounded-lg border p-4 ${style.bg} ${style.border}`}>
            <div className="flex items-start gap-3">
                <div className={`rounded-full p-1.5 ${style.bg}`}>
                    <Icon className={`h-4 w-4 ${style.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                        <span className={`text-sm font-semibold ${style.text}`}>
                            {alert.count}
                        </span>
                        <span className="text-sm text-slate-700">
                            {alert.label}
                        </span>
                    </div>
                    {alert.carpetaIds.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {alert.carpetaIds.map((id) => (
                                <Link
                                    key={id}
                                    href={`/carpeta/${id}`}
                                    className="text-xs px-2 py-0.5 rounded-md bg-white/80 border border-slate-200 text-slate-600 hover:text-primary hover:border-primary/30 transition-colors"
                                >
                                    Ver carpeta
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export async function DashboardAlerts() {
    const summary = await getPendingActionsSummary();

    if (summary.alerts.length === 0) {
        return (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm text-green-700 font-medium">
                    Todo al día — no hay pendientes que requieran atención.
                </span>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {summary.alerts.map((alert) => (
                <AlertCard key={alert.key} alert={alert} />
            ))}
        </div>
    );
}
