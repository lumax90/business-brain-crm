"use client";

import * as React from "react";
import { AppHeader } from "@/components/app-header";
import { cn } from "@/lib/utils";
import {
    RiAddLine,
    RiLoader4Line,
    RiCloseLine,
    RiDeleteBinLine,
    RiLoopLeftLine,
    RiComputerLine,
    RiMegaphoneLine,
    RiFlightTakeoffLine,
    RiTeamLine,
    RiFlashlightLine,
    RiBuilding2Line,
    RiMoreLine,
} from "@remixicon/react";

interface Expense {
    id: string;
    description: string;
    category: string;
    amount: number;
    currency: string;
    date: string;
    vendor: string | null;
    recurring: boolean;
    recurPeriod: string | null;
    notes: string | null;
    createdAt: string;
}

const categoryConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    office: { label: "Office", color: "text-blue-600 bg-blue-500/10", icon: <RiBuilding2Line className="w-3.5 h-3.5" /> },
    software: { label: "Software", color: "text-violet-600 bg-violet-500/10", icon: <RiComputerLine className="w-3.5 h-3.5" /> },
    marketing: { label: "Marketing", color: "text-pink-600 bg-pink-500/10", icon: <RiMegaphoneLine className="w-3.5 h-3.5" /> },
    travel: { label: "Travel", color: "text-amber-600 bg-amber-500/10", icon: <RiFlightTakeoffLine className="w-3.5 h-3.5" /> },
    salary: { label: "Salary", color: "text-emerald-600 bg-emerald-500/10", icon: <RiTeamLine className="w-3.5 h-3.5" /> },
    utilities: { label: "Utilities", color: "text-orange-600 bg-orange-500/10", icon: <RiFlashlightLine className="w-3.5 h-3.5" /> },
    other: { label: "Other", color: "text-stone-600 bg-stone-500/10", icon: <RiMoreLine className="w-3.5 h-3.5" /> },
};

import { API, apiFetch } from "@/lib/api";
import { toast } from "sonner";

function formatCurrency(val: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(val);
}

export default function ExpensesPage() {
    const [expenses, setExpenses] = React.useState<Expense[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [showModal, setShowModal] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [filterCat, setFilterCat] = React.useState("all");

    // Form
    const [description, setDescription] = React.useState("");
    const [category, setCategory] = React.useState("other");
    const [amount, setAmount] = React.useState("");
    const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
    const [vendor, setVendor] = React.useState("");
    const [recurring, setRecurring] = React.useState(false);
    const [recurPeriod, setRecurPeriod] = React.useState("monthly");
    const [notes, setNotes] = React.useState("");

    const fetchExpenses = async () => {
        try {
            const res = await apiFetch(`${API}/api/expenses`);
            const data = await res.json();
            if (data.success) setExpenses(data.expenses);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    React.useEffect(() => { fetchExpenses(); }, []);

    const filtered = React.useMemo(() => {
        if (filterCat === "all") return expenses;
        return expenses.filter((e) => e.category === filterCat);
    }, [expenses, filterCat]);

    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const recurringTotal = expenses.filter((e) => e.recurring).reduce((s, e) => s + e.amount, 0);

    const byCategory = React.useMemo(() => {
        const map: Record<string, number> = {};
        expenses.forEach((e) => { map[e.category] = (map[e.category] || 0) + e.amount; });
        return Object.entries(map).sort((a, b) => b[1] - a[1]);
    }, [expenses]);

    const handleCreate = async () => {
        if (!description.trim() || !amount || !date) return;
        setSaving(true);
        try {
            const res = await apiFetch(`${API}/api/expenses`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    description: description.trim(),
                    category,
                    amount: parseFloat(amount),
                    date,
                    vendor: vendor.trim() || null,
                    recurring,
                    recurPeriod: recurring ? recurPeriod : null,
                    notes: notes.trim() || null,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setExpenses((prev) => [data.expense, ...prev]);
                setShowModal(false);
                resetForm();
                toast.success("Expense created.");
            }
        } catch (err) { console.error(err); toast.error("Failed to create expense."); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id: string) => {
        setExpenses((prev) => prev.filter((e) => e.id !== id));
        try { await apiFetch(`${API}/api/expenses/${id}`, { method: "DELETE" }); toast.success("Expense deleted."); }
        catch { fetchExpenses(); toast.error("Failed to delete expense."); }
    };

    const resetForm = () => {
        setDescription(""); setCategory("other"); setAmount("");
        setDate(new Date().toISOString().slice(0, 10)); setVendor("");
        setRecurring(false); setRecurPeriod("monthly"); setNotes("");
    };

    if (loading) {
        return (
            <>
                <AppHeader title="Expenses" subtitle="Track your spending" />
                <div className="flex items-center justify-center h-[60vh]">
                    <RiLoader4Line className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            </>
        );
    }

    return (
        <>
            <AppHeader title="Expenses" subtitle={`${expenses.length} expenses · ${formatCurrency(totalExpenses)} total`} />
            <div className="p-6 space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-xl border border-border bg-card p-4">
                        <p className="text-xs text-muted-foreground mb-1">Total Expenses</p>
                        <p className="text-xl font-bold text-foreground">{formatCurrency(totalExpenses)}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                            <RiLoopLeftLine className="w-3 h-3" /> Recurring
                        </div>
                        <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(recurringTotal)}</p>
                    </div>
                    {byCategory.slice(0, 2).map(([cat, total]) => {
                        const cfg = categoryConfig[cat] || categoryConfig.other;
                        return (
                            <div key={cat} className="rounded-xl border border-border bg-card p-4">
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                                    {cfg.icon} {cfg.label}
                                </div>
                                <p className="text-xl font-bold text-foreground">{formatCurrency(total)}</p>
                            </div>
                        );
                    })}
                </div>

                {/* Toolbar */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-1 rounded-lg border border-input p-0.5 overflow-x-auto">
                        <button onClick={() => setFilterCat("all")}
                            className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors shrink-0", filterCat === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                            All
                        </button>
                        {Object.entries(categoryConfig).map(([key, cfg]) => (
                            <button key={key} onClick={() => setFilterCat(key)}
                                className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize shrink-0",
                                    filterCat === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                                {cfg.label}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => { resetForm(); setShowModal(true); }}
                        className="flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0">
                        <RiAddLine className="w-4 h-4" /> Add Expense
                    </button>
                </div>

                {/* Expenses Table */}
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Vendor</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Date</th>
                                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[60px]"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 && (
                                <tr><td colSpan={6} className="py-12 text-center text-muted-foreground/60 text-sm">No expenses found</td></tr>
                            )}
                            {filtered.map((exp, i) => {
                                const cfg = categoryConfig[exp.category] || categoryConfig.other;
                                return (
                                    <tr key={exp.id}
                                        className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors animate-fade-in"
                                        style={{ animationDelay: `${i * 0.03}s` }}>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-foreground text-sm">{exp.description}</p>
                                                {exp.recurring && (
                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium text-amber-600 bg-amber-500/10">
                                                        <RiLoopLeftLine className="w-2.5 h-2.5" />
                                                        {exp.recurPeriod}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium", cfg.color)}>
                                                {cfg.icon} {cfg.label}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-muted-foreground text-xs hidden md:table-cell">{exp.vendor || "—"}</td>
                                        <td className="py-3 px-4 text-muted-foreground text-xs hidden lg:table-cell">{exp.date}</td>
                                        <td className="py-3 px-4 text-right">
                                            <span className="font-bold text-foreground">{formatCurrency(exp.amount)}</span>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <button onClick={() => handleDelete(exp.id)}
                                                className="p-1.5 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors">
                                                <RiDeleteBinLine className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ─── Add Expense Modal ─── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
                    <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h3 className="text-sm font-semibold text-foreground">Add Expense</h3>
                            <button onClick={() => setShowModal(false)} className="p-1 rounded-md hover:bg-muted"><RiCloseLine className="w-4 h-4 text-muted-foreground" /></button>
                        </div>

                        <div className="p-4 space-y-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground">Description *</label>
                                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="e.g. Vercel Pro Plan" autoFocus />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Amount ($) *</label>
                                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="0.00" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Date *</label>
                                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Category</label>
                                    <select value={category} onChange={(e) => setCategory(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30">
                                        {Object.entries(categoryConfig).map(([key, cfg]) => (
                                            <option key={key} value={key}>{cfg.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Vendor</label>
                                    <input type="text" value={vendor} onChange={(e) => setVendor(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="Company name" />
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)}
                                        className="rounded border-input" />
                                    <span className="text-xs font-medium text-foreground">Recurring expense</span>
                                </label>
                                {recurring && (
                                    <select value={recurPeriod} onChange={(e) => setRecurPeriod(e.target.value)}
                                        className="h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none">
                                        <option value="monthly">Monthly</option>
                                        <option value="quarterly">Quarterly</option>
                                        <option value="yearly">Yearly</option>
                                    </select>
                                )}
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground">Notes</label>
                                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="Optional notes..." />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
                            <button onClick={() => setShowModal(false)} className="h-9 px-4 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancel</button>
                            <button onClick={handleCreate} disabled={!description.trim() || !amount || !date || saving}
                                className="flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                                {saving && <RiLoader4Line className="w-4 h-4 animate-spin" />}
                                Add Expense
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
