import { cn } from "@/lib/utils";
import { Activity, ActivityType } from "@/lib/types";
import {
    RiPhoneLine,
    RiMailLine,
    RiCalendarLine,
    RiStickyNoteLine,
    RiCheckboxCircleLine,
    RiArrowRightLine,
    RiAddLine,
    RiFlashlightLine,
} from "@remixicon/react";

const activityIcons: Record<ActivityType, React.ReactNode> = {
    call: <RiPhoneLine className="w-3.5 h-3.5" />,
    email: <RiMailLine className="w-3.5 h-3.5" />,
    meeting: <RiCalendarLine className="w-3.5 h-3.5" />,
    note: <RiStickyNoteLine className="w-3.5 h-3.5" />,
    task: <RiCheckboxCircleLine className="w-3.5 h-3.5" />,
    deal_moved: <RiArrowRightLine className="w-3.5 h-3.5" />,
    lead_created: <RiAddLine className="w-3.5 h-3.5" />,
    workflow_triggered: <RiFlashlightLine className="w-3.5 h-3.5" />,
};

const activityColors: Record<ActivityType, string> = {
    call: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    email: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    meeting: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    note: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
    task: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    deal_moved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    lead_created: "bg-primary/10 text-primary",
    workflow_triggered: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
};

function timeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface ActivityFeedProps {
    activities: Activity[];
    maxItems?: number;
}

export function ActivityFeed({ activities, maxItems = 8 }: ActivityFeedProps) {
    const items = activities.slice(0, maxItems);

    return (
        <div className="space-y-0">
            {items.map((activity, i) => (
                <div
                    key={activity.id}
                    className={cn(
                        "flex items-start gap-3 py-3 px-1 animate-fade-in",
                        i < items.length - 1 && "border-b border-border/60"
                    )}
                    style={{ animationDelay: `${i * 0.05}s` }}
                >
                    <div
                        className={cn(
                            "flex items-center justify-center w-7 h-7 rounded-lg shrink-0 mt-0.5",
                            activityColors[activity.type]
                        )}
                    >
                        {activityIcons[activity.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground leading-tight">
                            {activity.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                            {activity.description}
                        </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground/70 shrink-0 mt-1 font-medium">
                        {timeAgo(activity.createdAt)}
                    </span>
                </div>
            ))}
        </div>
    );
}
