"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Folder, User, Building2 } from "lucide-react";
import { useDebounce } from "use-debounce";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface SearchResult {
    id: string;
    type: 'carpeta' | 'persona' | 'inmueble';
    title: string;
    subtitle: string;
    url: string;
}

export function GlobalSearch() {
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const router = useRouter();

    useEffect(() => {
        async function performSearch() {
            if (!debouncedSearchTerm.trim()) {
                setResults([]);
                return;
            }

            setLoading(true);
            try {
                const { data, error } = await supabase
                    .rpc('global_search', { search_term: debouncedSearchTerm });

                if (error) {
                    console.error("Global search error:", error);
                } else if (data) {
                    setResults(data as SearchResult[]);
                }
            } catch (err) {
                console.error("Search exception:", err);
            } finally {
                setLoading(false);
            }
        }

        performSearch();
    }, [debouncedSearchTerm]);

    // Handle open/close state logic
    useEffect(() => {
        if (debouncedSearchTerm.trim()) {
            setOpen(true);
        } else {
            setOpen(false);
        }
    }, [debouncedSearchTerm, results]);

    const handleSelect = (url: string) => {
        setOpen(false);
        setSearchTerm("");
        router.push(url);
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'carpeta': return <Folder className="h-4 w-4 text-blue-500" />;
            case 'persona': return <User className="h-4 w-4 text-green-500" />;
            case 'inmueble': return <Building2 className="h-4 w-4 text-orange-500" />;
            default: return <Search className="h-4 w-4 text-gray-400" />;
        }
    };

    return (
        <div className="relative w-full max-w-xl mx-auto">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar carpetas, personas, inmuebles..."
                    className="pl-10 h-12 text-lg shadow-sm border-slate-200 focus-visible:ring-offset-0 focus-visible:ring-1"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => { if (results.length > 0) setOpen(true); }}
                    onBlur={() => {
                        // Delay closing to allow clicking on results
                        setTimeout(() => setOpen(false), 200);
                    }}
                />
                {loading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
            </div>

            {open && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                    {results.map((result, index) => (
                        <div
                            key={`${result.type}-${result.id}-${index}`}
                            className="px-4 py-3 hover:bg-slate-50 cursor-pointer flex items-center gap-3 transition-colors"
                            onClick={() => handleSelect(result.url)}
                            onMouseDown={(e) => e.preventDefault()} // Prevent blur before click
                        >
                            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                                {getIcon(result.type)}
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-medium text-slate-800 truncate">{result.title}</p>
                                <p className="text-xs text-slate-500 truncate">{result.subtitle}</p>
                            </div>
                            <div className="px-2 py-0.5 rounded text-[10px] uppercase font-bold text-slate-400 bg-slate-100">
                                {result.type}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {open && results.length === 0 && !loading && debouncedSearchTerm.trim() && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-slate-100 p-4 z-50 text-center text-sm text-muted-foreground animate-in fade-in zoom-in-95 duration-200">
                    No se encontraron resultados para "{searchTerm}"
                </div>
            )}
        </div>
    );
}
