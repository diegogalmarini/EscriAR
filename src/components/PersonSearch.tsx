"use client";

import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Search, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCUIT, isLegalEntity, formatPersonName } from "@/lib/utils/normalization";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { PersonForm } from "./PersonForm";
import { Plus } from "lucide-react";

interface Person {
    dni: string;
    nombre_completo: string;
    cuit?: string;
    tipo_persona?: string;
}

interface PersonSearchProps {
    onSelect: (person: any) => void;
    open: boolean;
    setOpen: (open: boolean) => void;
}

export function PersonSearch({ onSelect, open, setOpen }: PersonSearchProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<Person[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchResults = async () => {
            if (query.length < 2) {
                setResults([]);
                return;
            }
            setLoading(true);
            try {
                const res = await fetch(`/api/search/people?q=${encodeURIComponent(query)}`);
                const data = await res.json();
                setResults(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        const timer = setTimeout(fetchResults, 300);
        return () => clearTimeout(timer);
    }, [query]);

    const [isCreating, setIsCreating] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Buscar Persona</DialogTitle>
                </DialogHeader>
                <Command>
                    <CommandInput
                        placeholder="Nombre o DNI..."
                        value={query}
                        onValueChange={setQuery}
                    />
                    <CommandList>
                        {loading && <div className="p-4 text-center text-sm text-muted-foreground">Buscando...</div>}
                        <CommandEmpty>
                            <div className="p-4 space-y-4">
                                <p className="text-sm">No se encontraron personas con ese nombre o DNI.</p>
                                <Button
                                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                                    onClick={() => setIsCreating(true)}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Crear Nueva Persona
                                </Button>
                            </div>
                        </CommandEmpty>
                        <CommandGroup heading="Resultados">
                            {results.map((person) => (
                                <CommandItem
                                    key={person.dni}
                                    value={person.nombre_completo}
                                    onSelect={() => {
                                        onSelect(person);
                                        setOpen(false);
                                    }}
                                >
                                    <User className="mr-2 h-4 w-4" />
                                    <div className="flex flex-col">
                                        <span className="font-medium">{formatPersonName(person.nombre_completo)}</span>
                                        <span className="text-[10px] text-muted-foreground uppercase">
                                            {isLegalEntity(person)
                                                ? `CUIT: ${formatCUIT(person.cuit || person.dni) || "No informado"}`
                                                : `DNI: ${person.dni || "No informado"}`}
                                        </span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        {query.length >= 2 && (
                            <CommandGroup heading="Opciones">
                                <CommandItem onSelect={() => setIsCreating(true)}>
                                    <Plus className="mr-2 h-4 w-4 text-indigo-600" />
                                    <span className="text-indigo-600 font-bold">Crear nueva: {query}</span>
                                </CommandItem>
                            </CommandGroup>
                        )}
                    </CommandList>
                </Command>

                {/* Nested Dialog for Creation */}
                <Dialog open={isCreating} onOpenChange={setIsCreating}>
                    <DialogContent className="sm:max-w-[600px] overflow-hidden flex flex-col max-h-[90vh]">
                        <DialogHeader className="shrink-0">
                            <DialogTitle>Nueva Persona</DialogTitle>
                            <DialogDescription>
                                Completa los datos para dar de alta en el sistema y vincular a la escritura.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="overflow-y-auto pr-2 -mr-2">
                            <PersonForm
                                initialData={{ nombre_completo: query }}
                                onSuccess={(person) => {
                                    onSelect(person);
                                    setIsCreating(false);
                                    setOpen(false);
                                }}
                                onCancel={() => setIsCreating(false)}
                            />
                        </div>
                    </DialogContent>
                </Dialog>
            </DialogContent>
        </Dialog>
    );
}
