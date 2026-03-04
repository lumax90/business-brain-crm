"use client";

import * as React from "react";
import { AppHeader } from "@/components/app-header";
import { cn } from "@/lib/utils";
import {
    RiAddLine,
    RiLoader4Line,
    RiCloseLine,
    RiDeleteBinLine,
    RiCheckboxCircleLine,
    RiMailSendLine,
    RiTimeLine,
    RiAlertLine,
    RiDraftLine,
    RiUser3Line,
} from "@remixicon/react";

interface LineItem {
    description: string;
    qty: number;
    unitPrice: number;
    total: number;
}

interface Invoice {
    id: string;
    invoiceNumber: string;
    clientName: string;
    clientEmail: string | null;
    clientCompany: string | null;
    status: string;
    issueDate: string;
    dueDate: string;
    items: string;
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    total: number;
    currency: string;
    notes: string | null;
    paidAt: string | null;
    createdAt: string;
}

interface CrmContact {
    id: string;
    name: string;
    email: string | null;
    role: string | null;
    company: { id: string; name: string } | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    draft: { label: "Draft", color: "text-stone-600 dark:text-stone-400 bg-stone-500/10", icon: <RiDraftLine className="w-3 h-3" /> },
    sent: { label: "Sent", color: "text-blue-600 dark:text-blue-400 bg-blue-500/10", icon: <RiMailSendLine className="w-3 h-3" /> },
    paid: { label: "Paid", color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10", icon: <RiCheckboxCircleLine className="w-3 h-3" /> },
    overdue: { label: "Overdue", color: "text-rose-600 dark:text-rose-400 bg-rose-500/10", icon: <RiAlertLine className="w-3 h-3" /> },
    cancelled: { label: "Cancelled", color: "text-stone-500 dark:text-stone-400 bg-stone-500/10", icon: <RiCloseLine className="w-3 h-3" /> },
};

import { API, apiFetch } from "@/lib/api";
import { toast } from "sonner";

function formatCurrency(val: number, currency = "USD") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(val);
}

export default function InvoicesPage() {
    const [invoices, setInvoices] = React.useState<Invoice[]>([]);
    const [crmContacts, setCrmContacts] = React.useState<CrmContact[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [showModal, setShowModal] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [filter, setFilter] = React.useState("all");

    // Form — linked to CRM
    const [selectedContactId, setSelectedContactId] = React.useState("");
    const [clientName, setClientName] = React.useState("");
    const [clientEmail, setClientEmail] = React.useState("");
    const [clientCompany, setClientCompany] = React.useState("");
    const [issueDate, setIssueDate] = React.useState(new Date().toISOString().slice(0, 10));
    const [dueDate, setDueDate] = React.useState("");
    const [taxRate, setTaxRate] = React.useState("0");
    const [notes, setNotes] = React.useState("");
    const [items, setItems] = React.useState<LineItem[]>([{ description: "", qty: 1, unitPrice: 0, total: 0 }]);

    const fetchData = async () => {
        try {
            const [invRes, conRes] = await Promise.all([
                apiFetch(`${API}/api/invoices`).then((r) => r.json()),
                apiFetch(`${API}/api/contacts`).then((r) => r.json()),
            ]);
            if (invRes.success) setInvoices(invRes.invoices);
            if (conRes.success) setCrmContacts(conRes.contacts);
        } catch (err) { console.error("Fetch error:", err); }
        finally { setLoading(false); }
    };

    React.useEffect(() => { fetchData(); }, []);

    // When a CRM contact is selected, auto-fill name/email/company
    const handleContactSelect = (contactId: string) => {
        setSelectedContactId(contactId);
        if (!contactId) return;
        const c = crmContacts.find((ct) => ct.id === contactId);
        if (c) {
            setClientName(c.name);
            setClientEmail(c.email || "");
            setClientCompany(c.company?.name || "");
        }
    };

    const filtered = React.useMemo(() => {
        if (filter === "all") return invoices;
        return invoices.filter((inv) => inv.status === filter);
    }, [invoices, filter]);

    const totals = React.useMemo(() => {
        const paid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0);
        const outstanding = invoices.filter((i) => ["sent", "overdue"].includes(i.status)).reduce((s, i) => s + i.total, 0);
        const draft = invoices.filter((i) => i.status === "draft").reduce((s, i) => s + i.total, 0);
        return { paid, outstanding, draft };
    }, [invoices]);

    const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
        setItems((prev) => {
            const next = [...prev];
            (next[index] as any)[field] = value;
            next[index].total = next[index].qty * next[index].unitPrice;
            return next;
        });
    };

    const addItem = () => setItems((prev) => [...prev, { description: "", qty: 1, unitPrice: 0, total: 0 }]);
    const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

    const subtotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
    const tax = subtotal * (parseFloat(taxRate) / 100);
    const grandTotal = subtotal + tax;

    const handleCreate = async () => {
        if (!clientName.trim() || !issueDate || !dueDate) return;
        setSaving(true);
        try {
            const res = await apiFetch(`${API}/api/invoices`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientName: clientName.trim(),
                    clientEmail: clientEmail.trim() || null,
                    clientCompany: clientCompany.trim() || null,
                    issueDate, dueDate,
                    items: items.filter((i) => i.description.trim()),
                    taxRate: parseFloat(taxRate) || 0,
                    notes: notes.trim() || null,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setInvoices((prev) => [data.invoice, ...prev]);
                setShowModal(false);
                resetForm();
                toast.success("Invoice created.");
            }
        } catch (err) { console.error(err); toast.error("Failed to create invoice."); }
        finally { setSaving(false); }
    };

    const handleStatusChange = async (id: string, status: string) => {
        setInvoices((prev) => prev.map((inv) => inv.id === id ? { ...inv, status } : inv));
        try {
            await apiFetch(`${API}/api/invoices/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            });
            toast.success("Invoice status updated.");
        } catch { toast.error("Failed to update status."); fetchData(); }
    };

    const handleDelete = async (id: string) => {
        setInvoices((prev) => prev.filter((i) => i.id !== id));
        try { await apiFetch(`${API}/api/invoices/${id}`, { method: "DELETE" }); toast.success("Invoice deleted."); }
        catch { toast.error("Failed to delete invoice."); fetchData(); }
    };

    const resetForm = () => {
        setSelectedContactId(""); setClientName(""); setClientEmail(""); setClientCompany("");
        setIssueDate(new Date().toISOString().slice(0, 10)); setDueDate("");
        setTaxRate("0"); setNotes("");
        setItems([{ description: "", qty: 1, unitPrice: 0, total: 0 }]);
    };

    if (loading) {
        return (
            <>
                <AppHeader title="Invoices" subtitle="Manage your billing" />
                <div className="flex items-center justify-center h-[60vh]">
                    <RiLoader4Line className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            </>
        );
    }

    return (
        <>
            <AppHeader title="Invoices" subtitle={`${invoices.length} invoices`} />
            <div className="p-6 space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <RiCheckboxCircleLine className="w-3.5 h-3.5 text-emerald-500" />
                            Paid
                        </div>
                        <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totals.paid)}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <RiTimeLine className="w-3.5 h-3.5 text-amber-500" />
                            Outstanding
                        </div>
                        <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(totals.outstanding)}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <RiDraftLine className="w-3.5 h-3.5 text-stone-500" />
                            Draft
                        </div>
                        <p className="text-xl font-bold text-foreground">{formatCurrency(totals.draft)}</p>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1 rounded-lg border border-input p-0.5">
                        {["all", "draft", "sent", "paid", "overdue"].map((f) => (
                            <button key={f} onClick={() => setFilter(f)}
                                className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize",
                                    filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                                {f === "all" ? "All" : f}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => { resetForm(); setShowModal(true); }}
                        className="flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                        <RiAddLine className="w-4 h-4" /> New Invoice
                    </button>
                </div>

                {/* Table */}
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Invoice</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Date</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Due</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
                                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[100px]">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 && (
                                <tr><td colSpan={7} className="py-12 text-center text-muted-foreground/60 text-sm">No invoices found</td></tr>
                            )}
                            {filtered.map((inv, i) => {
                                const status = statusConfig[inv.status] || statusConfig.draft;
                                return (
                                    <tr key={inv.id}
                                        className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors animate-fade-in"
                                        style={{ animationDelay: `${i * 0.03}s` }}>
                                        <td className="py-3 px-4"><span className="font-mono text-xs font-semibold text-primary">{inv.invoiceNumber}</span></td>
                                        <td className="py-3 px-4">
                                            <p className="font-medium text-foreground text-sm">{inv.clientName}</p>
                                            {inv.clientCompany && <p className="text-xs text-muted-foreground">{inv.clientCompany}</p>}
                                        </td>
                                        <td className="py-3 px-4 text-muted-foreground text-xs hidden md:table-cell">{inv.issueDate}</td>
                                        <td className="py-3 px-4 text-muted-foreground text-xs hidden lg:table-cell">{inv.dueDate}</td>
                                        <td className="py-3 px-4">
                                            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium", status.color)}>
                                                {status.icon}{status.label}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right"><span className="font-bold text-foreground">{formatCurrency(inv.total)}</span></td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {inv.status === "draft" && (
                                                    <button onClick={() => handleStatusChange(inv.id, "sent")} className="p-1.5 rounded-md text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 transition-colors" title="Mark as Sent">
                                                        <RiMailSendLine className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                {["sent", "overdue"].includes(inv.status) && (
                                                    <button onClick={() => handleStatusChange(inv.id, "paid")} className="p-1.5 rounded-md text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors" title="Mark as Paid">
                                                        <RiCheckboxCircleLine className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                <button onClick={() => handleDelete(inv.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors" title="Delete">
                                                    <RiDeleteBinLine className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ─── Create Invoice Modal (with CRM Contact Picker) ─── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
                    <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
                            <h3 className="text-sm font-semibold text-foreground">New Invoice</h3>
                            <button onClick={() => setShowModal(false)} className="p-1 rounded-md hover:bg-muted"><RiCloseLine className="w-4 h-4 text-muted-foreground" /></button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* CRM Contact Picker */}
                            {crmContacts.length > 0 && (
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                        <RiUser3Line className="w-3 h-3 text-primary" />
                                        Pick from CRM Contacts
                                    </label>
                                    <select value={selectedContactId} onChange={(e) => handleContactSelect(e.target.value)}
                                        className="h-9 w-full rounded-md border border-primary/30 bg-primary/[0.03] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50">
                                        <option value="">— Select a contact or enter manually —</option>
                                        {crmContacts.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}{c.company ? ` (${c.company.name})` : ""}{c.email ? ` · ${c.email}` : ""}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-muted-foreground">Selecting a contact auto-fills name, email, and company below</p>
                                </div>
                            )}

                            {/* Client Info (auto-filled from CRM or manual) */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1 col-span-2">
                                    <label className="text-xs font-medium text-foreground">Client Name *</label>
                                    <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="Acme Inc." autoFocus />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Email</label>
                                    <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="billing@acme.com" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Company</label>
                                    <input type="text" value={clientCompany} onChange={(e) => setClientCompany(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="Company" />
                                </div>
                            </div>

                            {/* Dates */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Issue Date *</label>
                                    <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Due Date *</label>
                                    <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" />
                                </div>
                            </div>

                            {/* Line Items */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-foreground">Line Items</label>
                                {items.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <input type="text" placeholder="Description" value={item.description} onChange={(e) => updateItem(idx, "description", e.target.value)}
                                            className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring/30" />
                                        <input type="number" placeholder="Qty" value={item.qty} onChange={(e) => updateItem(idx, "qty", parseInt(e.target.value) || 0)}
                                            className="h-8 w-16 rounded-md border border-input bg-background px-2 text-xs text-center focus:outline-none focus:ring-2 focus:ring-ring/30" />
                                        <input type="number" placeholder="Price" value={item.unitPrice || ""} onChange={(e) => updateItem(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                                            className="h-8 w-24 rounded-md border border-input bg-background px-2 text-xs text-right focus:outline-none focus:ring-2 focus:ring-ring/30" />
                                        <span className="text-xs font-medium text-foreground w-20 text-right">{formatCurrency(item.qty * item.unitPrice)}</span>
                                        {items.length > 1 && (
                                            <button onClick={() => removeItem(idx)} className="p-1 rounded text-muted-foreground hover:text-rose-500"><RiCloseLine className="w-3.5 h-3.5" /></button>
                                        )}
                                    </div>
                                ))}
                                <button onClick={addItem} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                                    <RiAddLine className="w-3 h-3" /> Add line item
                                </button>
                            </div>

                            {/* Tax & Totals */}
                            <div className="flex items-center justify-between pt-2 border-t border-border">
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-muted-foreground">Tax %</label>
                                    <input type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)}
                                        className="h-7 w-16 rounded-md border border-input bg-background px-2 text-xs text-center focus:outline-none focus:ring-2 focus:ring-ring/30" />
                                </div>
                                <div className="text-right space-y-0.5">
                                    <p className="text-xs text-muted-foreground">Subtotal: {formatCurrency(subtotal)}</p>
                                    {tax > 0 && <p className="text-xs text-muted-foreground">Tax: {formatCurrency(tax)}</p>}
                                    <p className="text-sm font-bold text-foreground">Total: {formatCurrency(grandTotal)}</p>
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground">Notes</label>
                                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Payment terms, thank you note..."
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring/30" />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 p-4 border-t border-border sticky bottom-0 bg-card">
                            <button onClick={() => setShowModal(false)} className="h-9 px-4 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancel</button>
                            <button onClick={handleCreate} disabled={!clientName.trim() || !dueDate || saving}
                                className="flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                                {saving && <RiLoader4Line className="w-4 h-4 animate-spin" />}
                                Create Invoice
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
