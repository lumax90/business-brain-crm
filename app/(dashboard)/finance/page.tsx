"use client";

import * as React from "react";
import { AppHeader } from "@/components/app-header";
import { cn } from "@/lib/utils";
import {
    RiLoader4Line,
    RiArrowUpLine,
    RiArrowDownLine,
    RiMoneyDollarCircleLine,
    RiWalletLine,
    RiFileList3Line,
    RiLoopLeftLine,
    RiExternalLinkLine,
    RiPlayLine,
    RiCalendarLine,
    RiBuilding2Line,
} from "@remixicon/react";
import Link from "next/link";

import { API, apiFetch } from "@/lib/api";

function formatCurrency(val: number, currency: string = "USD") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(val);
}

interface Invoice {
    id: string;
    invoiceNumber: string;
    clientName: string;
    status: string;
    total: number;
    dueDate: string;
    currency?: string;
}

interface Expense {
    id: string;
    description: string;
    category: string;
    amount: number;
    date: string;
    recurring: boolean;
    currency?: string;
}

interface RecurringItem {
    id: string;
    name: string;
    type: "revenue" | "expense";
    amount: number;
    frequency: string;
    category: string;
    isActive: boolean;
    nextDueDate: string | null;
    company: { id: string; name: string } | null;
    currency?: string;
}

const freqLabels: Record<string, string> = {
    weekly: "Weekly",
    monthly: "Monthly",
    quarterly: "Quarterly",
    yearly: "Yearly",
};

export default function FinanceOverviewPage() {
    const [settings, setSettings] = React.useState<Record<string, string>>({});
    const [invoices, setInvoices] = React.useState<Invoice[]>([]);
    const [expenses, setExpenses] = React.useState<Expense[]>([]);
    const [recurringItems, setRecurringItems] = React.useState<RecurringItem[]>([]);
    const [recurringSummary, setRecurringSummary] = React.useState({ activeRevenue: 0, activeExpense: 0, net: 0, byCurrency: {} as Record<string, { revenue: number, expense: number, net: number }> });
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        Promise.all([
            apiFetch(`${API}/api/settings`).then((r) => r.json()).catch(() => ({ settings: {} })),
            apiFetch(`${API}/api/invoices`).then((r) => r.json()),
            apiFetch(`${API}/api/expenses`).then((r) => r.json()),
            apiFetch(`${API}/api/recurring`).then((r) => r.json()),
        ]).then(([setData, invData, expData, recData]) => {
            setSettings(setData.settings || {});
            if (invData.success) setInvoices(invData.invoices);
            if (expData.success) setExpenses(expData.expenses);
            if (recData.success) {
                setRecurringItems(recData.items);
                setRecurringSummary(recData.summary);
            }
        }).catch(console.error).finally(() => setLoading(false));
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

    const revenueVals = sumByCurrency(invoices, (i) => i.status === "paid", "total");
    const outstandingVals = sumByCurrency(invoices, (i) => ["sent", "overdue"].includes(i.status), "total");
    const totalExpensesVals = sumByCurrency(expenses, () => true, "amount");

    const getNet = (cur: string) => (revenueVals[cur] || 0) - (totalExpensesVals[cur] || 0);

    const recentInvoices = invoices.slice(0, 5);
    const recentExpenses = expenses.slice(0, 5);
    const activeRecurring = recurringItems.filter((r) => r.isActive);

    if (loading) {
        return (
            <>
                <AppHeader title="Finance" subtitle="Financial overview" />
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
            <div className={cn("flex", inline ? "flex-row items-center gap-1.5" : "flex-col")}>
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
            <AppHeader title="Finance" subtitle="Financial overview" />
            <div className="p-6 space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                    <div className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <RiArrowUpLine className="w-3.5 h-3.5 text-emerald-500" />
                            Revenue (Paid)
                        </div>
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400"><DualCurrency vals={revenueVals} /></p>
                        <p className="text-[10px] text-muted-foreground mt-1">{invoices.filter((i) => i.status === "paid").length} invoices</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <RiFileList3Line className="w-3.5 h-3.5 text-amber-500" />
                            Outstanding
                        </div>
                        <p className="text-2xl font-bold text-amber-600 dark:text-amber-400"><DualCurrency vals={outstandingVals} /></p>
                        <p className="text-[10px] text-muted-foreground mt-1">{invoices.filter((i) => ["sent", "overdue"].includes(i.status)).length} invoices</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <RiArrowDownLine className="w-3.5 h-3.5 text-rose-500" />
                            Total Expenses
                        </div>
                        <p className="text-2xl font-bold text-rose-600 dark:text-rose-400"><DualCurrency vals={totalExpensesVals} /></p>
                        <p className="text-[10px] text-muted-foreground mt-1">{expenses.length} entries</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <RiLoopLeftLine className="w-3.5 h-3.5 text-emerald-500" />
                            Recurring Revenue
                        </div>
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                            <DualCurrency vals={{
                                [primaryCurrency]: recurringSummary.byCurrency?.[primaryCurrency]?.revenue || 0,
                                ...(secondaryCurrency ? { [secondaryCurrency]: recurringSummary.byCurrency?.[secondaryCurrency]?.revenue || 0 } : {})
                            }} />
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">/month (active)</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <RiLoopLeftLine className="w-3.5 h-3.5 text-rose-500" />
                            Recurring Expenses
                        </div>
                        <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                            <DualCurrency vals={{
                                [primaryCurrency]: recurringSummary.byCurrency?.[primaryCurrency]?.expense || 0,
                                ...(secondaryCurrency ? { [secondaryCurrency]: recurringSummary.byCurrency?.[secondaryCurrency]?.expense || 0 } : {})
                            }} />
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">/month (active)</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <RiMoneyDollarCircleLine className="w-3.5 h-3.5 text-primary" />
                            Net Profit
                        </div>
                        <p className={cn("text-2xl font-bold", getNet(primaryCurrency) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                            <DualCurrency vals={{
                                [primaryCurrency]: getNet(primaryCurrency),
                                ...(secondaryCurrency ? { [secondaryCurrency]: getNet(secondaryCurrency) } : {})
                            }} isNet={true} />
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">revenue - expenses</p>
                    </div>
                </div>

                {/* Recurring Net Flow Banner */}
                {(recurringSummary.activeRevenue > 0 || recurringSummary.activeExpense > 0) && (
                    <div className={cn(
                        "rounded-xl border p-4 flex items-center justify-between",
                        (recurringSummary.byCurrency?.[primaryCurrency]?.net || 0) >= 0
                            ? "border-emerald-500/20 bg-emerald-500/[0.03]"
                            : "border-rose-500/20 bg-rose-500/[0.03]"
                    )}>
                        <div className="flex items-center gap-3">
                            <RiLoopLeftLine className={cn("w-5 h-5", (recurringSummary.byCurrency?.[primaryCurrency]?.net || 0) >= 0 ? "text-emerald-500" : "text-rose-500")} />
                            <div>
                                <p className="text-xs text-muted-foreground">Recurring Net Flow (Revenue − Expenses)</p>
                                <p className={cn("text-xl font-bold flex flex-col", (recurringSummary.byCurrency?.[primaryCurrency]?.net || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                                    <DualCurrency vals={{
                                        [primaryCurrency]: recurringSummary.byCurrency?.[primaryCurrency]?.net || 0,
                                        ...(secondaryCurrency ? { [secondaryCurrency]: recurringSummary.byCurrency?.[secondaryCurrency]?.net || 0 } : {})
                                    }} isNet={true} />
                                </p>
                            </div>
                        </div>
                        <Link href="/recurring" className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium">
                            Manage <RiExternalLinkLine className="w-3 h-3" />
                        </Link>
                    </div>
                )}

                {/* Three Column: Recent Invoices + Recent Expenses + Active Recurring */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Recent Invoices */}
                    <div className="rounded-xl border border-border bg-card">
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h3 className="text-sm font-semibold text-foreground">Recent Invoices</h3>
                            <Link href="/invoices" className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                                View all <RiExternalLinkLine className="w-3 h-3" />
                            </Link>
                        </div>
                        <div className="divide-y divide-border/60">
                            {recentInvoices.length === 0 && (
                                <p className="py-8 text-center text-muted-foreground/60 text-sm">No invoices yet</p>
                            )}
                            {recentInvoices.map((inv) => (
                                <div key={inv.id} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                                    <div>
                                        <p className="text-sm font-medium text-foreground">{inv.clientName}</p>
                                        <p className="text-[10px] text-muted-foreground font-mono">{inv.invoiceNumber}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-foreground">{formatCurrency(inv.total, inv.currency)}</p>
                                        <span className={cn(
                                            "text-[10px] font-medium capitalize",
                                            inv.status === "paid" ? "text-emerald-500" :
                                                inv.status === "overdue" ? "text-rose-500" :
                                                    inv.status === "sent" ? "text-blue-500" :
                                                        "text-muted-foreground"
                                        )}>
                                            {inv.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recent Expenses */}
                    <div className="rounded-xl border border-border bg-card">
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h3 className="text-sm font-semibold text-foreground">Recent Expenses</h3>
                            <Link href="/expenses" className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                                View all <RiExternalLinkLine className="w-3 h-3" />
                            </Link>
                        </div>
                        <div className="divide-y divide-border/60">
                            {recentExpenses.length === 0 && (
                                <p className="py-8 text-center text-muted-foreground/60 text-sm">No expenses yet</p>
                            )}
                            {recentExpenses.map((exp) => (
                                <div key={exp.id} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-foreground">{exp.description}</p>
                                        {exp.recurring && (
                                            <RiLoopLeftLine className="w-3 h-3 text-amber-500" />
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-foreground">{formatCurrency(exp.amount, exp.currency)}</p>
                                        <span className="text-[10px] text-muted-foreground capitalize">{exp.category}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Active Recurring Items */}
                    <div className="rounded-xl border border-border bg-card">
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h3 className="text-sm font-semibold text-foreground">Active Recurring</h3>
                            <Link href="/recurring" className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                                View all <RiExternalLinkLine className="w-3 h-3" />
                            </Link>
                        </div>
                        <div className="divide-y divide-border/60">
                            {activeRecurring.length === 0 && (
                                <p className="py-8 text-center text-muted-foreground/60 text-sm">No recurring items yet</p>
                            )}
                            {activeRecurring.slice(0, 5).map((item) => (
                                <div key={item.id} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            {item.type === "revenue" ? (
                                                <RiArrowUpLine className="w-3 h-3 text-emerald-500" />
                                            ) : (
                                                <RiArrowDownLine className="w-3 h-3 text-rose-500" />
                                            )}
                                            <p className="text-sm font-medium text-foreground">{item.name}</p>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] text-muted-foreground">{freqLabels[item.frequency] || item.frequency}</span>
                                            {item.company && (
                                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                                    <RiBuilding2Line className="w-2.5 h-2.5" />{item.company.name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={cn("text-sm font-bold", item.type === "revenue" ? "text-emerald-500" : "text-rose-500")}>
                                            {item.type === "revenue" ? "+" : "-"}{formatCurrency(item.amount, item.currency)}
                                        </p>
                                        {item.nextDueDate && (
                                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 justify-end">
                                                <RiCalendarLine className="w-2.5 h-2.5" />{item.nextDueDate}
                                            </span>
                                        )}
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
