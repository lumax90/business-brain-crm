import { cn } from "@/lib/utils";
import { RiArrowUpLine, RiArrowDownLine } from "@remixicon/react";

interface StatCardProps {
    title: string;
    value: string;
    change?: number;
    changeLabel?: string;
    icon: React.ReactNode;
    index?: number;
}

export function StatCard({
    title,
    value,
    change,
    changeLabel,
    icon,
    index = 0,
}: StatCardProps) {
    const isPositive = change && change > 0;
    const isNegative = change && change < 0;

    return (
        <div
            className={cn(
                "group relative overflow-hidden rounded-xl border border-border bg-card p-5",
                "hover:border-primary/30 hover:shadow-sm transition-all duration-300",
                "animate-fade-in"
            )}
            style={{ animationDelay: `${index * 0.07}s` }}
        >
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary transition-colors duration-200 group-hover:bg-primary/15">
                    {icon}
                </div>
                {change !== undefined && (
                    <div
                        className={cn(
                            "flex items-center gap-0.5 text-xs font-semibold rounded-full px-2 py-0.5",
                            isPositive && "text-primary bg-primary/10",
                            isNegative && "text-destructive bg-destructive/10",
                            !isPositive && !isNegative && "text-muted-foreground bg-muted"
                        )}
                    >
                        {isPositive && <RiArrowUpLine className="w-3 h-3" />}
                        {isNegative && <RiArrowDownLine className="w-3 h-3" />}
                        {Math.abs(change)}%
                    </div>
                )}
            </div>

            <div className="space-y-0.5">
                <p className="text-2xl font-bold tracking-tight text-foreground">
                    {value}
                </p>
                <p className="text-xs text-muted-foreground">
                    {title}
                    {changeLabel && (
                        <span className="text-muted-foreground/60"> · {changeLabel}</span>
                    )}
                </p>
            </div>

            {/* Subtle gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        </div>
    );
}
