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
    RiArrowUpLine,
    RiArrowDownLine,
    RiBuilding2Line,
    RiFileList3Line,
    RiCalendarLine,
    RiPlayLine,
    RiPauseLine,
} from "@remixicon/react";

interface RecurringItem {
    id: string;
    name: string;
    type: "revenue" | "expense";
    amount: number;
    currency: string;
    frequency: "weekly" | "monthly" | "quarterly" | "yearly";
    category: string;
    nextDueDate: string | null;
    startDate: string | null;
    endDate: string | null;
    isActive: boolean;
    notes: string | null;
    company: { id: string; name: string } | null;
    companyId: string | null;
    createdAt: string;
}

interface CrmCompany { id: string; name: string }

import { API, apiFetch } from "@/lib/api";
import { toast } from "sonner";

function formatCurrency(val: number, currency = "USD") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(val);
}

const freqLabels: Record<string, string> = {
    weekly: "Weekly",
    monthly: "Monthly",
    quarterly: "Quarterly",
    yearly: "Yearly",
};

export default function RecurringPage() {
    const [items, setItems] = React.useState<RecurringItem[]>([]);
    const [companies, setCompanies] = React.useState<CrmCompany[]>([]);
    const [settings, setSettings] = React.useState<Record<string, string>>({});
    const [summary, setSummary] = React.useState({ activeRevenue: 0, activeExpense: 0, net: 0 });
    const [loading, setLoading] = React.useState(true);
    const [showModal, setShowModal] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [filterType, setFilterType] = React.useState<"all" | "revenue" | "expense">("all");

    // Form
    const [name, setName] = React.useState("");
    const [type, setType] = React.useState<"revenue" | "expense">("revenue");
    const [amount, setAmount] = React.useState("");
    const [frequency, setFrequency] = React.useState("monthly");
    const [category, setCategory] = React.useState("general");
    const [nextDueDate, setNextDueDate] = React.useState("");
    const [startDate, setStartDate] = React.useState(new Date().toISOString().slice(0, 10));
    const [endDate, setEndDate] = React.useState("");
    const [companyId, setCompanyId] = React.useState("");
    const [notes, setNotes] = React.useState("");
    const [newCurrency, setNewCurrency] = React.useState("USD");

    const fetchData = async () => {
        try {
            const [rRes, cRes, setRes] = await Promise.all([
                apiFetch(`${API}/api/recurring`).then((r) => r.json()),
                apiFetch(`${API}/api/companies`).then((r) => r.json()),
                apiFetch(`${API}/api/settings`).then((r) => r.json()).catch(() => ({ settings: {} })),
            ]);
            if (rRes.success) {
                setItems(rRes.items);
                setSummary(rRes.summary);
            }
            if (cRes.success) setCompanies(cRes.companies);
            setSettings(setRes.settings || {});
            setNewCurrency(setRes.settings?.PRIMARY_CURRENCY || "USD");
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    React.useEffect(() => { fetchData(); }, []);

    const primaryCurrency = settings["PRIMARY_CURRENCY"] || "USD";
    const secondaryCurrency = settings["SECONDARY_CURRENCY"] && settings["SECONDARY_CURRENCY"] !== "None" ? settings["SECONDARY_CURRENCY"] : null;

    const sumByCurrency = (filterFn: (i: RecurringItem) => boolean) => {
        return items.filter(filterFn).reduce((acc: Record<string, number>, i) => {
            const cur = i.currency || "USD";
            acc[cur] = (acc[cur] || 0) + i.amount;
            return acc;
        }, {});
    };

    const renderDualAmount = (byCurrency: Record<string, number>, colorClass = "text-foreground", suffix = "") => {
        const entries = Object.entries(byCurrency).filter(([, v]) => v !== 0);
        if (entries.length === 0) return <span className={cn("text-xl font-bold", colorClass)}>{formatCurrency(0, primaryCurrency)}{suffix && <span className="text-xs text-muted-foreground font-medium ml-1">{suffix}</span>}</span>;
        return (
            <div className="flex items-baseline gap-2 flex-wrap">
                {entries.map(([cur, val], idx) => (
                    <span key={cur} className={cn("text-xl font-bold", colorClass)}>
                        {idx > 0 && <span className="text-muted-foreground font-normal text-sm mr-1">/</span>}
                        {formatCurrency(val, cur)}
                    </span>
                ))}
                {suffix && <span className="text-xs text-muted-foreground font-medium">{suffix}</span>}
            </div>
        );
    };

    const revenueByCurrency = React.useMemo(() => sumByCurrency((i) => i.type === "revenue" && i.isActive), [items]);
    const expenseByCurrency = React.useMemo(() => sumByCurrency((i) => i.type === "expense" && i.isActive), [items]);

    const filtered = React.useMemo(() => {
        if (filterType === "all") return items;
        return items.filter((i) => i.type === filterType);
    }, [items, filterType]);

    const handleCreate = async () => {
        if (!name.trim() || !amount) return;
        setSaving(true);
        try {
            const res = await apiFetch(`${API}/api/recurring`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(), type, amount: parseFloat(amount) || 0,
                    frequency, category, nextDueDate: nextDueDate || null,
                    startDate: startDate || null, endDate: endDate || null,
                    companyId: companyId || null, notes: notes || null,
                    currency: newCurrency,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setShowModal(false);
                resetForm();
                fetchData(); // re-fetch to update summary
                toast.success("Recurring item created.");
            }
        } catch (err) { console.error(err); toast.error("Failed to create recurring item."); }
        finally { setSaving(false); }
    };

    const handleToggleActive = async (id: string, currentActive: boolean) => {
        setItems((prev) => prev.map((i) => i.id === id ? { ...i, isActive: !currentActive } : i));
        try {
            await apiFetch(`${API}/api/recurring/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !currentActive }) });
            fetchData(); // re-fetch summary
            toast.success("Item updated.");
        } catch { fetchData(); /* revert */ toast.error("Failed to update item."); }
    };

    const handleDelete = async (id: string) => {
        setItems((prev) => prev.filter((i) => i.id !== id));
        try {
            await apiFetch(`${API}/api/recurring/${id}`, { method: "DELETE" });
            fetchData(); // re-fetch summary
            toast.success("Item deleted.");
        } catch { fetchData(); /* revert */ toast.error("Failed to delete item."); }
    };

    const resetForm = () => {
        setName(""); setType("revenue"); setAmount(""); setFrequency("monthly"); setCategory("general");
        setNextDueDate(""); setStartDate(new Date().toISOString().slice(0, 10)); setEndDate("");
        setCompanyId(""); setNotes("");
        setNewCurrency(primaryCurrency);
    };

    if (loading) {
        return (
            <>
                <AppHeader title="Recurring" subtitle="Manage subscriptions and repeating expenses" />
                <div className="flex items-center justify-center h-[60vh]">
                    <RiLoader4Line className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            </>
        );
    }

    return (
        <>
            <AppHeader title="Recurring" subtitle={`${items.length} items`} />
            <div className="p-6 space-y-6">
                {/* ── Summary Cards ── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <RiArrowUpLine className="w-3.5 h-3.5 text-emerald-500" /> Active Revenue
                        </div>
                        {renderDualAmount(revenueByCurrency, "text-emerald-600 dark:text-emerald-400", "/ cycle")}
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <RiArrowDownLine className="w-3.5 h-3.5 text-rose-500" /> Active Expenses
                        </div>
                        {renderDualAmount(expenseByCurrency, "text-rose-600 dark:text-rose-400", "/ cycle")}
                    </div>
                    <div className={cn("rounded-xl border border-border p-4", summary.net >= 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20")}>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <RiLoopLeftLine className="w-3.5 h-3.5" /> Net Flow
                        </div>
                        <p className={cn("text-xl font-bold", summary.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                            {formatCurrency(summary.net, primaryCurrency)}<span className="text-xs text-muted-foreground font-medium ml-1">/ cycle</span>
                        </p>
                    </div>
                </div>

                {/* ── Toolbar ── */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1 rounded-lg border border-input p-0.5">
                        {[
                            { id: "all", label: "All Items" },
                            { id: "revenue", label: "Revenue" },
                            { id: "expense", label: "Expenses" },
                        ].map((f) => (
                            <button key={f.id} onClick={() => setFilterType(f.id as any)}
                                className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                                    filterType === f.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => { resetForm(); setShowModal(true); }}
                        className="flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                        <RiAddLine className="w-4 h-4" /> Add Item
                    </button>
                </div>

                {/* ── Table ── */}
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item Details</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Frequency</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Next Due</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[100px]">Status</th>
                                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[100px]">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 && (
                                <tr><td colSpan={6} className="py-12 text-center text-muted-foreground/60 text-sm">
                                    <RiFileList3Line className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" /> No items found
                                </td></tr>
                            )}
                            {filtered.map((item, i) => (
                                <tr key={item.id}
                                    className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors animate-fade-in"
                                    style={{ animationDelay: `${i * 0.03}s` }}>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            {item.type === "revenue" ? (
                                                <div className="w-6 h-6 rounded flex items-center justify-center bg-emerald-500/10 text-emerald-500"><RiArrowUpLine className="w-3.5 h-3.5" /></div>
                                            ) : (
                                                <div className="w-6 h-6 rounded flex items-center justify-center bg-rose-500/10 text-rose-500"><RiArrowDownLine className="w-3.5 h-3.5" /></div>
                                            )}
                                            <div>
                                                <p className={cn("text-sm font-medium text-foreground", !item.isActive && "opacity-50 line-through")}>{item.name}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.category}</span>
                                                    {item.company && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex items-center gap-1"><RiBuilding2Line className="w-2.5 h-2.5" />{item.company.name}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-foreground">
                                            <RiLoopLeftLine className="w-2.5 h-2.5" /> {freqLabels[item.frequency] || item.frequency}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-muted-foreground text-xs hidden md:table-cell">
                                        {item.nextDueDate ? (
                                            <span className="flex items-center gap-1"><RiCalendarLine className="w-3 h-3" /> {item.nextDueDate}</span>
                                        ) : "—"}
                                    </td>
                                    <td className="py-3 px-4">
                                        {item.isActive ? (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-500">
                                                <RiPlayLine className="w-3 h-3" /> Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                                                <RiPauseLine className="w-3 h-3" /> Paused
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <span className={cn("font-bold", item.type === "revenue" ? "text-emerald-500" : "text-rose-500", !item.isActive && "opacity-50")}>
                                            {item.type === "revenue" ? "+" : "-"}{formatCurrency(item.amount, item.currency)}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button onClick={() => handleToggleActive(item.id, item.isActive)}
                                                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                                title={item.isActive ? "Pause" : "Activate"}>
                                                {item.isActive ? <RiPauseLine className="w-3.5 h-3.5" /> : <RiPlayLine className="w-3.5 h-3.5" />}
                                            </button>
                                            <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors" title="Delete">
                                                <RiDeleteBinLine className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ─── Create Recurring Item Modal ─── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
                    <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h3 className="text-sm font-semibold text-foreground">New Recurring Item</h3>
                            <button onClick={() => setShowModal(false)} className="p-1 rounded-md hover:bg-muted"><RiCloseLine className="w-4 h-4 text-muted-foreground" /></button>
                        </div>
                        <div className="p-4 space-y-3">
                            {/* Type Toggle */}
                            <div className="flex rounded-md border border-input p-1 bg-muted/20">
                                <button type="button" onClick={() => setType("revenue")}
                                    className={cn("flex-1 px-3 py-1.5 text-xs font-semibold rounded-sm transition-colors", type === "revenue" ? "bg-emerald-500 text-white shadow" : "text-muted-foreground hover:text-foreground")}>
                                    Revenue
                                </button>
                                <button type="button" onClick={() => setType("expense")}
                                    className={cn("flex-1 px-3 py-1.5 text-xs font-semibold rounded-sm transition-colors", type === "expense" ? "bg-rose-500 text-white shadow" : "text-muted-foreground hover:text-foreground")}>
                                    Expense
                                </button>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground">Item Name *</label>
                                <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus
                                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="e.g. Monthly Software Sub" />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Amount *</label>
                                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="0.00" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Currency</label>
                                    <select value={newCurrency} onChange={(e) => setNewCurrency(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30">
                                        <option value="USD">USD ($)</option>
                                        <option value="EUR">EUR (€)</option>
                                        <option value="TRY">TRY (₺)</option>
                                        <option value="GBP">GBP (£)</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Frequency</label>
                                    <select value={frequency} onChange={(e) => setFrequency(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30">
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                        <option value="quarterly">Quarterly</option>
                                        <option value="yearly">Yearly</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Start Date</label>
                                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Next Due Date</label>
                                    <input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" />
                                </div>
                            </div>

                            <div className="space-y-1 mt-2">
                                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                    <RiBuilding2Line className="w-3 h-3 text-primary" /> Associated Company
                                </label>
                                <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}
                                    className="h-9 w-full rounded-md border border-primary/30 bg-primary/[0.03] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                                    <option value="">— None —</option>
                                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
                            <button onClick={() => setShowModal(false)} className="h-9 px-4 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancel</button>
                            <button onClick={handleCreate} disabled={!name.trim() || !amount || saving}
                                className="flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                                {saving && <RiLoader4Line className="w-4 h-4 animate-spin" />}
                                Add Item
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
