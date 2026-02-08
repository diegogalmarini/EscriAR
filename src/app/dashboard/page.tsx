import Link from "next/link";
import { createClient } from "@/lib/supabaseServer";
import { Button } from "@/components/ui/button";
import { PlusCircle, FileText, Shield, ArrowRight, History } from "lucide-react";
import { createFolder } from "@/app/actions/carpeta";
import { revalidatePath } from "next/cache";
import { ExpiringDeedsAlert } from "@/components/ExpiringDeedsAlert";
import { MagicDropzone } from "@/components/MagicDropzone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DeleteFolderButton } from "@/components/DeleteFolderButton";
import { GlobalSearch } from "@/components/GlobalSearch";
import { CarpetasTable } from "@/components/CarpetasTable";

export default async function DashboardPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userName = user?.user_metadata?.full_name?.split(' ')[0] || "Notario";

    // Fetch recently created folders using RPC to get nested data for CarpetasTable
    const { data: carpetas, error } = await supabase
        .rpc('search_carpetas', {
            search_term: '',
            p_limit: 10,
            p_offset: 0
        });

    return (
        <div className="p-8 space-y-10 animate-in fade-in duration-700">
            {/* Header section with Welcome and Global Search */}
            <div className="flex flex-col gap-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-6 flex-1">
                        <h1 className="text-[2rem] font-extrabold tracking-tight text-slate-900 whitespace-nowrap">
                            Bienvenido, {userName}
                        </h1>
                        {/* Global Search Bar - Moved next to title */}
                        <div className="w-full max-w-xl">
                            <GlobalSearch />
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <form action={async () => {
                            "use server";
                            await createFolder("Nueva Carpeta Manual");
                            revalidatePath("/dashboard");
                        }}>
                            <Button className="shadow-lg shadow-primary/20">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Nueva Carpeta
                            </Button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Magic Section - Hero Area */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <MagicDropzone />
                </div>
                <div className="flex flex-col gap-6">
                    <Card className="flex-1 bg-gradient-to-br from-slate-900 to-slate-800 text-white border-none shadow-xl">
                        <CardHeader>
                            <CardTitle className="text-lg font-normal flex items-center gap-2">
                                <History size={18} className="text-primary" />
                                Acceso Rápido
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1.5">
                                {carpetas?.slice(0, 3).map((c: any) => {
                                    const isFilename = c.caratula?.toLowerCase().endsWith('.pdf') || c.caratula?.toLowerCase().endsWith('.docx');
                                    const displayTitle = isFilename ? `Expediente #${c.nro_carpeta_interna}` : (c.caratula || `Carpeta #${c.nro_carpeta_interna}`);
                                    const displaySubtitle = isFilename ? c.caratula : `Expediente #${c.nro_carpeta_interna}`;

                                    return (
                                        <Link
                                            key={c.id}
                                            href={`/carpeta/${c.id}`}
                                            className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
                                        >
                                            <div className="truncate pr-4">
                                                <div className="text-xs font-light truncate text-slate-100">{displayTitle}</div>
                                                <div className="text-[9px] text-slate-500 font-light tracking-wide">{displaySubtitle}</div>
                                            </div>
                                            <ArrowRight size={12} className="text-slate-600 group-hover:text-primary transition-colors flex-shrink-0" />
                                        </Link>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Alerts Section */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-xl font-bold text-slate-800">Alertas de Vencimiento</h2>
                </div>
                <ExpiringDeedsAlert />
            </section>

            {/* Recent Folders List */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-800">Últimas Carpetas Creadas</h2>
                    <Button variant="link" asChild>
                        <Link href="/carpetas">Ver todas</Link>
                    </Button>
                </div>
                <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
                    <CarpetasTable data={carpetas || []} />
                </div>
            </section>
        </div>
    );
}
