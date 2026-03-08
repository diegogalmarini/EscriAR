import Link from "next/link";
import { getPendingActionsSummary, PendingAlert } from "@/app/actions/pendientes";
import { AlertCircle, AlertTriangle, Info, CheckCircle2 } from "lucide-react";

const SEVERITY_CONFIG = {
    critical: { icon: AlertCircle, border: "border-red-200", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
    warning: { icon: AlertTriangle, border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
    info: { icon: Info, border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
};

function AlertCard({ alert }: { alert: PendingAlert }) {
    const cfg = SEVERITY_CONFIG[alert.severity];
    const Icon = cfg.icon;

    return (
        <div className={`rounded-lg border ${cfg.border} ${cfg.bg} p-4 space-y-2`}>
            <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${cfg.text}`} />
                <span className={`font-medium text-sm ${cfg.text}`}>
                    {alert.count} {alert.message}
                </span>
            </div>
            {alert.carpetas.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {alert.carpetas.map((c) => (
                        <Link
                            key={c.id}
                            href={`/carpeta/${c.id}`}
                            className={`text-xs px-2 py-0.5 rounded border ${cfg.border} hover:underline ${cfg.text}`}
                        >
                            {c.label}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

export async function DashboardAlerts() {
    const { total, alerts } = await getPendingActionsSummary();

    if (total === 0) {
        return (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-700 font-medium">Todo al día — sin pendientes</span>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {alerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
            ))}
        </div>
    );
}
