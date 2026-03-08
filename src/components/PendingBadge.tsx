"use client";

import { useEffect, useState } from "react";
import { getPendingActionsSummary } from "@/app/actions/pendientes";

export function PendingBadge() {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let mounted = true;

        const fetch = async () => {
            try {
                const { total } = await getPendingActionsSummary();
                if (mounted) setCount(total);
            } catch {
                // silent
            }
        };

        fetch();
        const interval = setInterval(fetch, 60_000);
        return () => { mounted = false; clearInterval(interval); };
    }, []);

    if (count === 0) return null;

    return (
        <span className="ml-auto inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
            {count > 99 ? "99+" : count}
        </span>
    );
}
