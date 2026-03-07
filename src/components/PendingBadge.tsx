"use client";

import { useEffect, useState } from "react";
import { getPendingActionsSummary } from "@/app/actions/pendientes";

/**
 * Small pill badge showing the count of pending items.
 * Fetches on mount and refreshes every 60s.
 */
export function PendingBadge() {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let mounted = true;

        const load = () => {
            getPendingActionsSummary()
                .then((s) => { if (mounted) setCount(s.total); })
                .catch(() => {});
        };

        load();
        const timer = setInterval(load, 60_000);
        return () => { mounted = false; clearInterval(timer); };
    }, []);

    if (count === 0) return null;

    return (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white leading-none">
            {count > 99 ? "99+" : count}
        </span>
    );
}
