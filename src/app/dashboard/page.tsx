import { createClient } from "@/lib/supabaseServer";
import { MagicDropzone } from "@/components/MagicDropzone";
import { GlobalSearch } from "@/components/GlobalSearch";
import { DashboardActions } from "@/components/DashboardActions";
import { BorradoresTable } from "@/components/BorradoresTable";

export default async function DashboardPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userName = user?.user_metadata?.full_name?.split(' ')[0] || "Notario";

    return (
        <div className="p-8 space-y-10 animate-in fade-in duration-700">
            {/* Header: Welcome + Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-[2rem] font-extrabold tracking-tight text-slate-900 whitespace-nowrap">
                    Bienvenido, {userName}
                </h1>
                <div className="w-full max-w-xl">
                    <GlobalSearch />
                </div>
            </div>

            {/* Magic Drop Zone */}
            <section>
                <MagicDropzone />
            </section>

            {/* Action Buttons: Nueva Carpeta / Nuevo Documento / Nuevo Presupuesto */}
            <section>
                <DashboardActions />
            </section>

            {/* Borradores Table */}
            <section className="space-y-4">
                <h2 className="text-xl font-bold text-slate-800">Borradores</h2>
                <BorradoresTable />
            </section>
        </div>
    );
}
