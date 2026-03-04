"use client";

import * as React from "react";
import { AppHeader } from "@/components/app-header";
import { mockWorkflows } from "@/lib/mock-data";
import { N8NWorkflowStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
    RiPlayCircleLine,
    RiPauseCircleLine,
    RiErrorWarningLine,
    RiFlashlightLine,
    RiLinkM,
    RiSettings4Line,
    RiExternalLinkLine,
    RiRefreshLine,
    RiCheckboxCircleLine,
    RiCloseLine,
    RiTimeLine,
    RiCodeSSlashLine,
} from "@remixicon/react";

const statusConfig: Record<N8NWorkflowStatus, { label: string; color: string; icon: React.ReactNode }> = {
    active: {
        label: "Active",
        color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
        icon: <RiPlayCircleLine className="w-3.5 h-3.5" />,
    },
    inactive: {
        label: "Inactive",
        color: "text-stone-500 dark:text-stone-400 bg-stone-500/10",
        icon: <RiPauseCircleLine className="w-3.5 h-3.5" />,
    },
    error: {
        label: "Error",
        color: "text-rose-600 dark:text-rose-400 bg-rose-500/10",
        icon: <RiErrorWarningLine className="w-3.5 h-3.5" />,
    },
};

function timeAgo(dateStr?: string): string {
    if (!dateStr) return "Never";
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function N8NPage() {
    const [n8nUrl, setN8nUrl] = React.useState("https://n8n.pixl.dev");
    const [showConfig, setShowConfig] = React.useState(false);

    const activeCount = mockWorkflows.filter((w) => w.status === "active").length;
    const errorCount = mockWorkflows.filter((w) => w.status === "error").length;
    const totalExecutions = mockWorkflows.reduce((sum, w) => sum + w.executionCount, 0);

    return (
        <>
            <AppHeader title="N8N Flows" subtitle="Automation integration hub" />
            <div className="p-6 space-y-6">
                {/* Connection Status */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 animate-fade-in">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <RiFlashlightLine className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-0.5">
                                <h2 className="text-sm font-semibold text-foreground">N8N Instance</h2>
                                <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-full px-2 py-0.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
                                    Connected
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground font-mono">{n8nUrl}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowConfig(!showConfig)}
                            className="flex items-center gap-2 h-8 px-3 rounded-md border border-input text-xs font-medium hover:bg-muted transition-colors"
                        >
                            <RiSettings4Line className="w-3.5 h-3.5" />
                            Configure
                        </button>
                        <a
                            href={n8nUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 h-8 px-3 rounded-md border border-input text-xs font-medium hover:bg-muted transition-colors"
                        >
                            <RiExternalLinkLine className="w-3.5 h-3.5" />
                            Open N8N
                        </a>
                    </div>
                </div>

                {/* Config Panel */}
                {showConfig && (
                    <div className="rounded-xl border border-border bg-card p-5 animate-fade-in-scale space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-foreground">Instance Configuration</h3>
                            <button
                                onClick={() => setShowConfig(false)}
                                className="p-1 rounded-md hover:bg-muted text-muted-foreground"
                            >
                                <RiCloseLine className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-foreground">Instance URL</label>
                                <input
                                    type="url"
                                    value={n8nUrl}
                                    onChange={(e) => setN8nUrl(e.target.value)}
                                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/40"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-foreground">API Key</label>
                                <input
                                    type="password"
                                    placeholder="n8n_api_..."
                                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/40"
                                />
                            </div>
                        </div>
                        <button className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                            Save Configuration
                        </button>
                    </div>
                )}

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-xl border border-border bg-card p-4 text-center animate-fade-in stagger-1">
                        <p className="text-2xl font-bold text-foreground">{activeCount}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Active Flows</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4 text-center animate-fade-in stagger-2">
                        <p className="text-2xl font-bold text-foreground">{totalExecutions.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Total Executions</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4 text-center animate-fade-in stagger-3">
                        <p className={cn("text-2xl font-bold", errorCount > 0 ? "text-destructive" : "text-foreground")}>
                            {errorCount}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">Errors</p>
                    </div>
                </div>

                {/* Workflows List */}
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">Workflows</h3>
                    {mockWorkflows.map((workflow, i) => {
                        const status = statusConfig[workflow.status];
                        return (
                            <div
                                key={workflow.id}
                                className="group rounded-xl border border-border bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all duration-200 animate-fade-in"
                                style={{ animationDelay: `${i * 0.05}s` }}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="text-sm font-semibold text-foreground">{workflow.name}</h4>
                                            <span className={cn("flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5", status.color)}>
                                                {status.icon}
                                                {status.label}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                                            {workflow.description}
                                        </p>

                                        {/* Webhook URL */}
                                        {workflow.webhookUrl && (
                                            <div className="flex items-center gap-2 mb-3">
                                                <RiLinkM className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                                <code className="text-[10px] font-mono text-muted-foreground bg-muted rounded px-2 py-0.5 truncate">
                                                    {workflow.webhookUrl}
                                                </code>
                                            </div>
                                        )}

                                        {/* Stats */}
                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                            <div className="flex items-center gap-1">
                                                <RiRefreshLine className="w-3 h-3" />
                                                <span>{workflow.executionCount.toLocaleString()} runs</span>
                                            </div>
                                            {workflow.errorCount > 0 && (
                                                <div className="flex items-center gap-1 text-destructive">
                                                    <RiErrorWarningLine className="w-3 h-3" />
                                                    <span>{workflow.errorCount} errors</span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1">
                                                <RiTimeLine className="w-3 h-3" />
                                                <span>Last run: {timeAgo(workflow.lastExecutedAt)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            className="flex items-center justify-center w-8 h-8 rounded-md border border-input hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                            title="Trigger manually"
                                        >
                                            <RiFlashlightLine className="w-4 h-4" />
                                        </button>
                                        <button
                                            className="flex items-center justify-center w-8 h-8 rounded-md border border-input hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                            title="View logs"
                                        >
                                            <RiCodeSSlashLine className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Tags */}
                                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border/40">
                                    {workflow.tags.map((tag) => (
                                        <span
                                            key={tag}
                                            className="text-[10px] rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
}
