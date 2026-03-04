"use client";

import * as React from "react";
import { AppHeader } from "@/components/app-header";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
    RiUserSearchLine,
    RiMoneyDollarCircleLine,
    RiFlowChart,
    RiArrowRightLine,
    RiAddLine,
    RiFlashlightLine,
    RiFileList3Line,
    RiTeamLine,
    RiBuilding2Line,
    RiArrowUpLine,
    RiArrowDownLine,
    RiLoader4Line,
    RiExternalLinkLine,
} from "@remixicon/react";

import { API, apiFetch } from "@/lib/api";

function formatCurrency(val: number, currency: string = "USD") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(val);
}

const stageConfig: Record<string, { label: string; color: string }> = {
    new: { label: "New", color: "#3b82f6" },
    qualified: { label: "Qualified", color: "#8b5cf6" },
    proposal: { label: "Proposal", color: "#f59e0b" },
    negotiation: { label: "Negotiation", color: "#f97316" },
    closed_won: { label: "Won", color: "#10b981" },
};

export default function DashboardPage() {
    const [loading, setLoading] = React.useState(true);
    const [settings, setSettings] = React.useState<Record<string, string>>({});
    const [totalLeadCount, setTotalLeadCount] = React.useState(0);
    const [deals, setDeals] = React.useState<any[]>([]);
    const [invoices, setInvoices] = React.useState<any[]>([]);
    const [expenses, setExpenses] = React.useState<any[]>([]);
    const [contacts, setContacts] = React.useState<any[]>([]);
    const [companies, setCompanies] = React.useState<any[]>([]);
    const [recurringSummary, setRecurringSummary] = React.useState({ activeRevenue: 0, activeExpense: 0, net: 0, byCurrency: {} as Record<string, { revenue: number, expense: number, net: number }> });

    React.useEffect(() => {
        Promise.all([
            apiFetch(`${API}/api/settings`).then((r) => r.json()).catch(() => ({ settings: {} })),
            apiFetch(`${API}/api/leads?limit=1`).then((r) => r.json()).catch(() => ({ pagination: { total: 0 } })),
            apiFetch(`${API}/api/deals`).then((r) => r.json()).catch(() => ({ deals: [] })),
            apiFetch(`${API}/api/invoices`).then((r) => r.json()).catch(() => ({ invoices: [] })),
            apiFetch(`${API}/api/expenses`).then((r) => r.json()).catch(() => ({ expenses: [] })),
            apiFetch(`${API}/api/contacts`).then((r) => r.json()).catch(() => ({ contacts: [] })),
            apiFetch(`${API}/api/companies`).then((r) => r.json()).catch(() => ({ companies: [] })),
            apiFetch(`${API}/api/recurring`).then((r) => r.json()).catch(() => ({ summary: { activeRevenue: 0, activeExpense: 0, net: 0, byCurrency: {} } })),
        ]).then(([setData, lData, dData, iData, eData, cData, coData, rData]) => {
            setSettings(setData.settings || {});
            setTotalLeadCount(lData.pagination?.total ?? lData.leads?.length ?? 0);
            setDeals(dData.deals || []);
            setInvoices(iData.invoices || []);
            setExpenses(eData.expenses || []);
            setContacts(cData.contacts || []);
            setCompanies(coData.companies || []);
            if (rData.summary) setRecurringSummary(rData.summary);
        }).finally(() => setLoading(false));
    }, []);

    const primaryCurrency = settings["PRIMARY_CURRENCY"] || "USD";
    const secondaryCurrency = settings["SECONDARY_CURRENCY"] && settings["SECONDARY_CURRENCY"] !== "None" ? settings["SECONDARY_CURRENCY"] : null;

    // Helper to sum by currency
    const sumByCurrency = (items: any[], filterFn: (item: any) => boolean, valueField: string) => {
        return items.filter(filterFn).reduce((acc: Record<string, number>, item: any) => {
            const cur = item.currency || "USD";
            acc[cur] = (acc[cur] || 0) + (item[valueField] || 0);
            return acc;
        }, {});
    };

    // ── KPI calculations from real data ──
    const totalLeads = totalLeadCount;
    const totalContacts = contacts.length;
    const totalCompanies = companies.length;

    const pipelineVals = sumByCurrency(deals, d => !["closed_won", "closed_lost"].includes(d.stage), "value");
    const wonVals = sumByCurrency(deals, d => d.stage === "closed_won", "value");
    const revenueVals = sumByCurrency(invoices, i => i.status === "paid", "total");
    const outstandingVals = sumByCurrency(invoices, i => ["sent", "overdue"].includes(i.status), "total");
    const expenseVals = sumByCurrency(expenses, () => true, "amount");

    const getNet = (cur: string) => (revenueVals[cur] || 0) - (expenseVals[cur] || 0);

    // Pipeline breakdown by stage
    const stageBreakdown = Object.entries(stageConfig).map(([stage, cfg]) => {
        const stageDeals = deals.filter((d: any) => d.stage === stage);
        const totals = sumByCurrency(stageDeals, () => true, "value");
        return { stage, ...cfg, count: stageDeals.length, totals };
    });
    // For progress bar visualization, we sum all currencies blindly just for relative sizing to avoid huge complexity.
    const maxStageVal = Math.max(...stageBreakdown.map((s) => Object.values(s.totals).reduce((a, b) => a + b, 0) || 0), 1);

    // Recent items
    const recentDeals = deals.slice(0, 4);
    const recentInvoices = invoices.slice(0, 4);

    if (loading) {
        return (
            <>
                <AppHeader title="Dashboard" subtitle="Loading your command center..." />
                <div className="flex items-center justify-center h-[60vh]">
                    <RiLoader4Line className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            </>
        );
    }

    // Render helper for Dual Currency
    const DualCurrency = ({ vals, isNet = false, inline = false }: { vals: Record<string, number>, isNet?: boolean, inline?: boolean }) => {
        const pVal = vals[primaryCurrency] || 0;
        const sVal = secondaryCurrency ? (vals[secondaryCurrency] || 0) : null;

        return (
            <div className={cn("flex", inline ? "flex-row items-center gap-1" : "flex-col")}>
                <span className={isNet && pVal < 0 ? "text-rose-600 dark:text-rose-400" : ""}>{formatCurrency(pVal, primaryCurrency)}</span>
                {secondaryCurrency && (
                    <span className={cn(
                        inline ? "text-[10px]" : "text-xs mt-0.5",
                        isNet && sVal! < 0 ? "text-rose-500/80" : "text-muted-foreground font-medium"
                    )}>
                        {inline ? "(" : ""}{formatCurrency(sVal || 0, secondaryCurrency)}{inline ? ")" : ""}
                    </span>
                )}
            </div>
        );
    };

    return (
        <>
            <AppHeader title="Dashboard" subtitle="Your business command center" />
            <div className="p-6 space-y-6">
                {/* ── KPI Cards (Real Data) ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    {[
                        { label: "Leads", value: <>{totalLeads}</>, icon: <RiUserSearchLine className="w-3.5 h-3.5" />, color: "text-blue-500", href: "/leads" },
                        { label: "Contacts", value: <>{totalContacts}</>, icon: <RiTeamLine className="w-3.5 h-3.5" />, color: "text-violet-500", href: "/contacts" },
                        { label: "Companies", value: <>{totalCompanies}</>, icon: <RiBuilding2Line className="w-3.5 h-3.5" />, color: "text-indigo-500", href: "/companies" },
                        { label: "Pipeline", value: <DualCurrency vals={pipelineVals} />, icon: <RiFlowChart className="w-3.5 h-3.5" />, color: "text-amber-500", href: "/pipeline" },
                        { label: "Revenue", value: <DualCurrency vals={revenueVals} />, icon: <RiArrowUpLine className="w-3.5 h-3.5" />, color: "text-emerald-500", href: "/finance" },
                        { label: "Expenses", value: <DualCurrency vals={expenseVals} />, icon: <RiArrowDownLine className="w-3.5 h-3.5" />, color: "text-rose-500", href: "/expenses" },
                    ].map((kpi, i) => (
                        <Link key={kpi.label} href={kpi.href}
                            className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all animate-fade-in group flex flex-col justify-between min-h-[100px]"
                            style={{ animationDelay: `${i * 0.06}s` }}>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5 flex-none">
                                <span className={kpi.color}>{kpi.icon}</span>
                                {kpi.label}
                            </div>
                            <div className="text-lg font-bold text-foreground group-hover:text-primary transition-colors flex-1 flex flex-col justify-end">
                                {kpi.value}
                            </div>
                        </Link>
                    ))}
                </div>

                {/* ── Profit Banner ── */}
                <div className={cn(
                    "rounded-xl border p-4 flex items-center justify-between",
                    getNet(primaryCurrency) >= 0
                        ? "border-emerald-500/20 bg-emerald-500/[0.03]"
                        : "border-rose-500/20 bg-rose-500/[0.03]"
                )}>
                    <div className="flex items-center gap-3">
                        <RiMoneyDollarCircleLine className={cn("w-5 h-5", getNet(primaryCurrency) >= 0 ? "text-emerald-500" : "text-rose-500")} />
                        <div>
                            <p className="text-xs text-muted-foreground">Net Profit (Revenue − Expenses)</p>
                            <p className={cn("text-xl font-bold flex flex-col", getNet(primaryCurrency) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                                <DualCurrency vals={{
                                    [primaryCurrency]: getNet(primaryCurrency),
                                    ...(secondaryCurrency ? { [secondaryCurrency]: getNet(secondaryCurrency) } : {})
                                }} isNet={true} />
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        {(recurringSummary.activeRevenue > 0 || recurringSummary.activeExpense > 0) && (
                            <div className="text-right flex flex-col justify-center">
                                <p className="text-xs text-muted-foreground">Recurring Net</p>
                                <p className={cn("text-sm font-bold", (recurringSummary.byCurrency?.[primaryCurrency]?.net || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                                    <DualCurrency vals={{
                                        [primaryCurrency]: recurringSummary.byCurrency?.[primaryCurrency]?.net || 0,
                                        ...(secondaryCurrency ? { [secondaryCurrency]: recurringSummary.byCurrency?.[secondaryCurrency]?.net || 0 } : {})
                                    }} isNet={true} />
                                </p>
                            </div>
                        )}
                        {(outstandingVals[primaryCurrency] || 0) > 0 || (secondaryCurrency && (outstandingVals[secondaryCurrency] || 0) > 0) ? (
                            <div className="text-right flex flex-col justify-center">
                                <p className="text-xs text-muted-foreground">Outstanding</p>
                                <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                                    <DualCurrency vals={outstandingVals} />
                                </p>
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* ── Pipeline Overview (Real) ── */}
                    <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 animate-fade-in">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h2 className="text-sm font-semibold text-foreground">Pipeline Overview</h2>
                                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                    {deals.length} deals · <DualCurrency vals={{
                                        [primaryCurrency]: (pipelineVals[primaryCurrency] || 0) + (wonVals[primaryCurrency] || 0),
                                        ...(secondaryCurrency ? { [secondaryCurrency]: (pipelineVals[secondaryCurrency] || 0) + (wonVals[secondaryCurrency] || 0) } : {})
                                    }} inline /> total
                                </p>
                            </div>
                            <Link href="/pipeline" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                                Open <RiArrowRightLine className="w-3 h-3" />
                            </Link>
                        </div>
                        <div className="space-y-3">
                            {stageBreakdown.map((s) => {
                                const sumVals = Object.values(s.totals).reduce((a, b) => a + b, 0) || 0;
                                return (
                                    <div key={s.stage} className="group">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-medium text-foreground">{s.label}</span>
                                            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                                                <DualCurrency vals={s.totals} inline /> · {s.count} deal{s.count !== 1 ? "s" : ""}
                                            </span>
                                        </div>
                                        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-700 ease-out group-hover:opacity-80"
                                                style={{ width: `${Math.min((sumVals / maxStageVal) * 100, 100)}%`, backgroundColor: s.color }} />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* ── Quick Actions ── */}
                    <div className="rounded-xl border border-border bg-card p-5 animate-fade-in">
                        <h2 className="text-sm font-semibold text-foreground mb-4">Quick Actions</h2>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { icon: <RiAddLine className="w-5 h-5" />, label: "Add Lead", desc: "Create a new lead", href: "/leads" },
                                { icon: <RiFlashlightLine className="w-5 h-5" />, label: "New Invoice", desc: "Create an invoice", href: "/invoices" },
                                { icon: <RiMoneyDollarCircleLine className="w-5 h-5" />, label: "New Deal", desc: "Add to pipeline", href: "/pipeline" },
                                { icon: <RiTeamLine className="w-5 h-5" />, label: "Add Contact", desc: "CRM contact", href: "/contacts" },
                            ].map((action) => (
                                <Link key={action.label} href={action.href}
                                    className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border p-4 text-center hover:bg-muted/50 hover:border-primary/30 transition-all group">
                                    <div className="text-muted-foreground group-hover:text-primary transition-colors">{action.icon}</div>
                                    <div>
                                        <p className="text-sm font-medium text-foreground">{action.label}</p>
                                        <p className="text-[10px] text-muted-foreground">{action.desc}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Bottom: Recent Deals + Recent Invoices ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-xl border border-border bg-card">
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h3 className="text-sm font-semibold text-foreground">Recent Deals</h3>
                            <Link href="/pipeline" className="flex items-center gap-1 text-xs text-primary hover:text-primary/80">
                                View all <RiExternalLinkLine className="w-3 h-3" />
                            </Link>
                        </div>
                        <div className="divide-y divide-border/60">
                            {recentDeals.length === 0 && <p className="py-8 text-center text-muted-foreground/60 text-sm">No deals yet</p>}
                            {recentDeals.map((deal: any) => (
                                <div key={deal.id} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                                    <div>
                                        <p className="text-sm font-medium text-foreground">{deal.title}</p>
                                        <p className="text-[10px] text-muted-foreground">{deal.contactName || deal.company || "—"}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-foreground">{formatCurrency(deal.value || 0, deal.currency)}</p>
                                        <span className="text-[10px] font-medium capitalize" style={{ color: stageConfig[deal.stage]?.color || "#888" }}>
                                            {stageConfig[deal.stage]?.label || deal.stage}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-xl border border-border bg-card">
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h3 className="text-sm font-semibold text-foreground">Recent Invoices</h3>
                            <Link href="/invoices" className="flex items-center gap-1 text-xs text-primary hover:text-primary/80">
                                View all <RiExternalLinkLine className="w-3 h-3" />
                            </Link>
                        </div>
                        <div className="divide-y divide-border/60">
                            {recentInvoices.length === 0 && <p className="py-8 text-center text-muted-foreground/60 text-sm">No invoices yet</p>}
                            {recentInvoices.map((inv: any) => (
                                <div key={inv.id} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                                    <div>
                                        <p className="text-sm font-medium text-foreground">{inv.clientName}</p>
                                        <p className="text-[10px] text-muted-foreground font-mono">{inv.invoiceNumber}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-foreground">{formatCurrency(inv.total, inv.currency)}</p>
                                        <span className={cn("text-[10px] font-medium capitalize",
                                            inv.status === "paid" ? "text-emerald-500" :
                                                inv.status === "overdue" ? "text-rose-500" :
                                                    inv.status === "sent" ? "text-blue-500" :
                                                        "text-muted-foreground")}>
                                            {inv.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
