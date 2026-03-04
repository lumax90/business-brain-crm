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

function formatCurrency(val: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
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
    const [totalLeadCount, setTotalLeadCount] = React.useState(0);
    const [deals, setDeals] = React.useState<any[]>([]);
    const [invoices, setInvoices] = React.useState<any[]>([]);
    const [expenses, setExpenses] = React.useState<any[]>([]);
    const [contacts, setContacts] = React.useState<any[]>([]);
    const [companies, setCompanies] = React.useState<any[]>([]);

    React.useEffect(() => {
        Promise.all([
            apiFetch(`${API}/api/leads?limit=1`).then((r) => r.json()).catch(() => ({ pagination: { total: 0 } })),
            apiFetch(`${API}/api/deals`).then((r) => r.json()).catch(() => ({ deals: [] })),
            apiFetch(`${API}/api/invoices`).then((r) => r.json()).catch(() => ({ invoices: [] })),
            apiFetch(`${API}/api/expenses`).then((r) => r.json()).catch(() => ({ expenses: [] })),
            apiFetch(`${API}/api/contacts`).then((r) => r.json()).catch(() => ({ contacts: [] })),
            apiFetch(`${API}/api/companies`).then((r) => r.json()).catch(() => ({ companies: [] })),
        ]).then(([lData, dData, iData, eData, cData, coData]) => {
            setTotalLeadCount(lData.pagination?.total ?? lData.leads?.length ?? 0);
            setDeals(dData.deals || []);
            setInvoices(iData.invoices || []);
            setExpenses(eData.expenses || []);
            setContacts(cData.contacts || []);
            setCompanies(coData.companies || []);
        }).finally(() => setLoading(false));
    }, []);

    // ── KPI calculations from real data ──
    const totalLeads = totalLeadCount;
    const totalContacts = contacts.length;
    const totalCompanies = companies.length;
    const pipelineValue = deals.filter((d: any) => !["closed_won", "closed_lost"].includes(d.stage)).reduce((s: number, d: any) => s + (d.value || 0), 0);
    const wonValue = deals.filter((d: any) => d.stage === "closed_won").reduce((s: number, d: any) => s + (d.value || 0), 0);
    const revenue = invoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + i.total, 0);
    const outstanding = invoices.filter((i: any) => ["sent", "overdue"].includes(i.status)).reduce((s: number, i: any) => s + i.total, 0);
    const totalExpenses = expenses.reduce((s: number, e: any) => s + e.amount, 0);
    const netProfit = revenue - totalExpenses;

    // Pipeline breakdown by stage
    const stageBreakdown = Object.entries(stageConfig).map(([stage, cfg]) => {
        const stageDeals = deals.filter((d: any) => d.stage === stage);
        const total = stageDeals.reduce((s: number, d: any) => s + (d.value || 0), 0);
        return { stage, ...cfg, count: stageDeals.length, total };
    });
    const maxStageVal = Math.max(...stageBreakdown.map((s) => s.total), 1);

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

    return (
        <>
            <AppHeader title="Dashboard" subtitle="Your business command center" />
            <div className="p-6 space-y-6">
                {/* ── KPI Cards (Real Data) ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    {[
                        { label: "Leads", value: totalLeads.toString(), icon: <RiUserSearchLine className="w-3.5 h-3.5" />, color: "text-blue-500", href: "/leads" },
                        { label: "Contacts", value: totalContacts.toString(), icon: <RiTeamLine className="w-3.5 h-3.5" />, color: "text-violet-500", href: "/contacts" },
                        { label: "Companies", value: totalCompanies.toString(), icon: <RiBuilding2Line className="w-3.5 h-3.5" />, color: "text-indigo-500", href: "/companies" },
                        { label: "Pipeline", value: formatCurrency(pipelineValue), icon: <RiFlowChart className="w-3.5 h-3.5" />, color: "text-amber-500", href: "/pipeline" },
                        { label: "Revenue", value: formatCurrency(revenue), icon: <RiArrowUpLine className="w-3.5 h-3.5" />, color: "text-emerald-500", href: "/finance" },
                        { label: "Expenses", value: formatCurrency(totalExpenses), icon: <RiArrowDownLine className="w-3.5 h-3.5" />, color: "text-rose-500", href: "/expenses" },
                    ].map((kpi, i) => (
                        <Link key={kpi.label} href={kpi.href}
                            className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all animate-fade-in group"
                            style={{ animationDelay: `${i * 0.06}s` }}>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                                <span className={kpi.color}>{kpi.icon}</span>
                                {kpi.label}
                            </div>
                            <p className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{kpi.value}</p>
                        </Link>
                    ))}
                </div>

                {/* ── Profit Banner ── */}
                <div className={cn(
                    "rounded-xl border p-4 flex items-center justify-between",
                    netProfit >= 0
                        ? "border-emerald-500/20 bg-emerald-500/[0.03]"
                        : "border-rose-500/20 bg-rose-500/[0.03]"
                )}>
                    <div className="flex items-center gap-3">
                        <RiMoneyDollarCircleLine className={cn("w-5 h-5", netProfit >= 0 ? "text-emerald-500" : "text-rose-500")} />
                        <div>
                            <p className="text-xs text-muted-foreground">Net Profit (Revenue − Expenses)</p>
                            <p className={cn("text-xl font-bold", netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                                {formatCurrency(netProfit)}
                            </p>
                        </div>
                    </div>
                    {outstanding > 0 && (
                        <div className="text-right">
                            <p className="text-xs text-muted-foreground">Outstanding invoices</p>
                            <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{formatCurrency(outstanding)}</p>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* ── Pipeline Overview (Real) ── */}
                    <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 animate-fade-in">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h2 className="text-sm font-semibold text-foreground">Pipeline Overview</h2>
                                <p className="text-xs text-muted-foreground mt-0.5">{deals.length} deals · {formatCurrency(pipelineValue + wonValue)} total</p>
                            </div>
                            <Link href="/pipeline" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                                Open <RiArrowRightLine className="w-3 h-3" />
                            </Link>
                        </div>
                        <div className="space-y-3">
                            {stageBreakdown.map((s) => (
                                <div key={s.stage} className="group">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-medium text-foreground">{s.label}</span>
                                        <span className="text-xs text-muted-foreground font-medium">
                                            {formatCurrency(s.total)} · {s.count} deal{s.count !== 1 ? "s" : ""}
                                        </span>
                                    </div>
                                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-700 ease-out group-hover:opacity-80"
                                            style={{ width: `${Math.min((s.total / maxStageVal) * 100, 100)}%`, backgroundColor: s.color }} />
                                    </div>
                                </div>
                            ))}
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
                                        <p className="text-sm font-bold text-foreground">{formatCurrency(deal.value || 0)}</p>
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
                                        <p className="text-sm font-bold text-foreground">{formatCurrency(inv.total)}</p>
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
