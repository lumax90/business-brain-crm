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
} from "@remixicon/react";
import Link from "next/link";

import { API, apiFetch } from "@/lib/api";

function formatCurrency(val: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}

interface Invoice {
    id: string;
    invoiceNumber: string;
    clientName: string;
    status: string;
    total: number;
    dueDate: string;
}

interface Expense {
    id: string;
    description: string;
    category: string;
    amount: number;
    date: string;
    recurring: boolean;
}

export default function FinanceOverviewPage() {
    const [invoices, setInvoices] = React.useState<Invoice[]>([]);
    const [expenses, setExpenses] = React.useState<Expense[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        Promise.all([
            apiFetch(`${API}/api/invoices`).then((r) => r.json()),
            apiFetch(`${API}/api/expenses`).then((r) => r.json()),
        ]).then(([invData, expData]) => {
            if (invData.success) setInvoices(invData.invoices);
            if (expData.success) setExpenses(expData.expenses);
        }).catch(console.error).finally(() => setLoading(false));
    }, []);

    const revenue = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0);
    const outstanding = invoices.filter((i) => ["sent", "overdue"].includes(i.status)).reduce((s, i) => s + i.total, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const recurringExpenses = expenses.filter((e) => e.recurring).reduce((s, e) => s + e.amount, 0);
    const profit = revenue - totalExpenses;

    const recentInvoices = invoices.slice(0, 5);
    const recentExpenses = expenses.slice(0, 5);

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

    return (
        <>
            <AppHeader title="Finance" subtitle="Financial overview" />
            <div className="p-6 space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <RiArrowUpLine className="w-3.5 h-3.5 text-emerald-500" />
                            Revenue (Paid)
                        </div>
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(revenue)}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{invoices.filter((i) => i.status === "paid").length} invoices</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <RiFileList3Line className="w-3.5 h-3.5 text-amber-500" />
                            Outstanding
                        </div>
                        <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(outstanding)}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{invoices.filter((i) => ["sent", "overdue"].includes(i.status)).length} invoices</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <RiArrowDownLine className="w-3.5 h-3.5 text-rose-500" />
                            Total Expenses
                        </div>
                        <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{formatCurrency(totalExpenses)}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{expenses.length} entries</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <RiLoopLeftLine className="w-3.5 h-3.5 text-orange-500" />
                            Recurring
                        </div>
                        <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatCurrency(recurringExpenses)}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">/month</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <RiMoneyDollarCircleLine className="w-3.5 h-3.5 text-primary" />
                            Net Profit
                        </div>
                        <p className={cn("text-2xl font-bold", profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                            {formatCurrency(profit)}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">revenue - expenses</p>
                    </div>
                </div>

                {/* Two Column: Recent Invoices + Recent Expenses */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                                        <p className="text-sm font-bold text-foreground">{formatCurrency(inv.total)}</p>
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
                                        <p className="text-sm font-bold text-foreground">{formatCurrency(exp.amount)}</p>
                                        <span className="text-[10px] text-muted-foreground capitalize">{exp.category}</span>
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
