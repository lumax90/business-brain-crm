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
    RiFileList3Line,
    RiDraftLine,
    RiExchangeLine,
    RiUser3Line,
    RiCloseCircleLine,
} from "@remixicon/react";

interface LineItem { description: string; qty: number; unitPrice: number; total: number }

interface Proposal {
    id: string;
    proposalNumber: string;
    title: string;
    clientName: string;
    clientEmail: string | null;
    clientCompany: string | null;
    status: string;
    validUntil: string | null;
    items: string;
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    total: number;
    notes: string | null;
    terms: string | null;
    convertedToInvoiceId: string | null;
    company: { id: string; name: string } | null;
    contact: { id: string; name: string } | null;
    createdAt: string;
}

interface CrmContact { id: string; name: string; email: string | null; company: { id: string; name: string } | null }

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    draft: { label: "Draft", color: "text-stone-600 bg-stone-500/10", icon: <RiDraftLine className="w-3 h-3" /> },
    sent: { label: "Sent", color: "text-blue-600 bg-blue-500/10", icon: <RiMailSendLine className="w-3 h-3" /> },
    accepted: { label: "Accepted", color: "text-emerald-600 bg-emerald-500/10", icon: <RiCheckboxCircleLine className="w-3 h-3" /> },
    rejected: { label: "Rejected", color: "text-rose-600 bg-rose-500/10", icon: <RiCloseCircleLine className="w-3 h-3" /> },
    expired: { label: "Expired", color: "text-stone-500 bg-stone-500/10", icon: <RiTimeLine className="w-3 h-3" /> },
};

import { API, apiFetch } from "@/lib/api";
import { toast } from "sonner";

function formatCurrency(val: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(val);
}

export default function ProposalsPage() {
    const [proposals, setProposals] = React.useState<Proposal[]>([]);
    const [crmContacts, setCrmContacts] = React.useState<CrmContact[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [showModal, setShowModal] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [filter, setFilter] = React.useState("all");

    // Form
    const [selectedContactId, setSelectedContactId] = React.useState("");
    const [title, setTitle] = React.useState("");
    const [clientName, setClientName] = React.useState("");
    const [clientEmail, setClientEmail] = React.useState("");
    const [clientCompany, setClientCompany] = React.useState("");
    const [validUntil, setValidUntil] = React.useState("");
    const [taxRate, setTaxRate] = React.useState("0");
    const [notes, setNotes] = React.useState("");
    const [terms, setTerms] = React.useState("");
    const [items, setItems] = React.useState<LineItem[]>([{ description: "", qty: 1, unitPrice: 0, total: 0 }]);

    const fetchData = async () => {
        try {
            const [pRes, cRes] = await Promise.all([
                apiFetch(`${API}/api/proposals`).then((r) => r.json()),
                apiFetch(`${API}/api/contacts`).then((r) => r.json()),
            ]);
            if (pRes.success) setProposals(pRes.proposals);
            if (cRes.success) setCrmContacts(cRes.contacts);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    React.useEffect(() => { fetchData(); }, []);

    const handleContactSelect = (contactId: string) => {
        setSelectedContactId(contactId);
        if (!contactId) return;
        const c = crmContacts.find((ct) => ct.id === contactId);
        if (c) { setClientName(c.name); setClientEmail(c.email || ""); setClientCompany(c.company?.name || ""); }
    };

    const filtered = React.useMemo(() => {
        if (filter === "all") return proposals;
        return proposals.filter((p) => p.status === filter);
    }, [proposals, filter]);

    const totals = React.useMemo(() => {
        const sent = proposals.filter((p) => p.status === "sent").reduce((s, p) => s + p.total, 0);
        const accepted = proposals.filter((p) => p.status === "accepted").reduce((s, p) => s + p.total, 0);
        const draft = proposals.filter((p) => p.status === "draft").reduce((s, p) => s + p.total, 0);
        return { sent, accepted, draft };
    }, [proposals]);

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
        if (!title.trim() || !clientName.trim()) return;
        setSaving(true);
        try {
            const res = await apiFetch(`${API}/api/proposals`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim(), clientName: clientName.trim(),
                    clientEmail: clientEmail.trim() || null, clientCompany: clientCompany.trim() || null,
                    validUntil: validUntil || null,
                    items: items.filter((i) => i.description.trim()),
                    taxRate: parseFloat(taxRate) || 0,
                    notes: notes.trim() || null, terms: terms.trim() || null,
                }),
            });
            const data = await res.json();
            if (data.success) { setProposals((prev) => [data.proposal, ...prev]); setShowModal(false); resetForm(); toast.success("Proposal created."); }
        } catch (err) { console.error(err); toast.error("Failed to create proposal."); }
        finally { setSaving(false); }
    };

    const handleStatusChange = async (id: string, status: string) => {
        setProposals((prev) => prev.map((p) => p.id === id ? { ...p, status } : p));
        try { await apiFetch(`${API}/api/proposals/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); toast.success("Status updated."); }
        catch { fetchData(); toast.error("Failed to update status."); }
    };

    const handleConvertToInvoice = async (id: string) => {
        try {
            const res = await apiFetch(`${API}/api/proposals/${id}/convert`, { method: "POST" });
            const data = await res.json();
            if (data.success) {
                setProposals((prev) => prev.map((p) => p.id === id ? { ...p, status: "accepted", convertedToInvoiceId: data.invoice.id } : p));
                toast.success("Invoice created from proposal.");
            }
        } catch (err) { console.error(err); toast.error("Failed to convert to invoice."); }
    };

    const handleDelete = async (id: string) => {
        setProposals((prev) => prev.filter((p) => p.id !== id));
        try { await apiFetch(`${API}/api/proposals/${id}`, { method: "DELETE" }); toast.success("Proposal deleted."); }
        catch { fetchData(); toast.error("Failed to delete proposal."); }
    };

    const resetForm = () => {
        setSelectedContactId(""); setTitle(""); setClientName(""); setClientEmail(""); setClientCompany("");
        setValidUntil(""); setTaxRate("0"); setNotes(""); setTerms("");
        setItems([{ description: "", qty: 1, unitPrice: 0, total: 0 }]);
    };

    if (loading) {
        return (
            <>
                <AppHeader title="Proposals" subtitle="Create and manage proposals" />
                <div className="flex items-center justify-center h-[60vh]">
                    <RiLoader4Line className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            </>
        );
    }

    return (
        <>
            <AppHeader title="Proposals" subtitle={`${proposals.length} proposals`} />
            <div className="p-6 space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <RiCheckboxCircleLine className="w-3.5 h-3.5 text-emerald-500" /> Accepted
                        </div>
                        <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totals.accepted)}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <RiMailSendLine className="w-3.5 h-3.5 text-blue-500" /> Pending (Sent)
                        </div>
                        <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totals.sent)}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <RiDraftLine className="w-3.5 h-3.5 text-stone-500" /> Draft
                        </div>
                        <p className="text-xl font-bold text-foreground">{formatCurrency(totals.draft)}</p>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1 rounded-lg border border-input p-0.5">
                        {["all", "draft", "sent", "accepted", "rejected"].map((f) => (
                            <button key={f} onClick={() => setFilter(f)}
                                className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize",
                                    filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                                {f === "all" ? "All" : f}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => { resetForm(); setShowModal(true); }}
                        className="flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                        <RiAddLine className="w-4 h-4" /> New Proposal
                    </button>
                </div>

                {/* Table */}
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Proposal</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Valid Until</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
                                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[140px]">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 && (
                                <tr><td colSpan={6} className="py-12 text-center text-muted-foreground/60 text-sm">
                                    <RiFileList3Line className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" /> No proposals found
                                </td></tr>
                            )}
                            {filtered.map((prop, i) => {
                                const st = statusConfig[prop.status] || statusConfig.draft;
                                return (
                                    <tr key={prop.id}
                                        className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors animate-fade-in"
                                        style={{ animationDelay: `${i * 0.03}s` }}>
                                        <td className="py-3 px-4">
                                            <span className="font-mono text-xs font-semibold text-primary">{prop.proposalNumber}</span>
                                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{prop.title}</p>
                                        </td>
                                        <td className="py-3 px-4">
                                            <p className="font-medium text-foreground text-sm">{prop.clientName}</p>
                                            {prop.clientCompany && <p className="text-xs text-muted-foreground">{prop.clientCompany}</p>}
                                        </td>
                                        <td className="py-3 px-4 text-muted-foreground text-xs hidden md:table-cell">{prop.validUntil || "—"}</td>
                                        <td className="py-3 px-4">
                                            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium", st.color)}>
                                                {st.icon}{st.label}
                                            </span>
                                            {prop.convertedToInvoiceId && (
                                                <span className="ml-1 text-[10px] text-emerald-500 font-medium">→ Invoice</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-right"><span className="font-bold text-foreground">{formatCurrency(prop.total)}</span></td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {prop.status === "draft" && (
                                                    <button onClick={() => handleStatusChange(prop.id, "sent")} className="p-1.5 rounded-md text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 transition-colors" title="Mark as Sent">
                                                        <RiMailSendLine className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                {prop.status === "sent" && (
                                                    <>
                                                        <button onClick={() => handleStatusChange(prop.id, "accepted")} className="p-1.5 rounded-md text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors" title="Accept">
                                                            <RiCheckboxCircleLine className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button onClick={() => handleStatusChange(prop.id, "rejected")} className="p-1.5 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors" title="Reject">
                                                            <RiCloseCircleLine className="w-3.5 h-3.5" />
                                                        </button>
                                                    </>
                                                )}
                                                {prop.status === "accepted" && !prop.convertedToInvoiceId && (
                                                    <button onClick={() => handleConvertToInvoice(prop.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Convert to Invoice">
                                                        <RiExchangeLine className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                <button onClick={() => handleDelete(prop.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors" title="Delete">
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

            {/* ─── Create Proposal Modal ─── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
                    <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
                            <h3 className="text-sm font-semibold text-foreground">New Proposal</h3>
                            <button onClick={() => setShowModal(false)} className="p-1 rounded-md hover:bg-muted"><RiCloseLine className="w-4 h-4 text-muted-foreground" /></button>
                        </div>
                        <div className="p-4 space-y-4">
                            {/* CRM Contact Picker */}
                            {crmContacts.length > 0 && (
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                        <RiUser3Line className="w-3 h-3 text-primary" /> Pick from CRM Contacts
                                    </label>
                                    <select value={selectedContactId} onChange={(e) => handleContactSelect(e.target.value)}
                                        className="h-9 w-full rounded-md border border-primary/30 bg-primary/[0.03] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                                        <option value="">— Select a contact or enter manually —</option>
                                        {crmContacts.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}{c.company ? ` (${c.company.name})` : ""}{c.email ? ` · ${c.email}` : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground">Proposal Title *</label>
                                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus
                                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="Website Redesign Proposal" />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1 col-span-2">
                                    <label className="text-xs font-medium text-foreground">Client Name *</label>
                                    <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="Acme Inc." />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Email</label>
                                    <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="contact@acme.com" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Valid Until</label>
                                    <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)}
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

                            {/* Notes & Terms */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Notes</label>
                                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Additional notes..."
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring/30" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Terms & Conditions</label>
                                    <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={2} placeholder="Payment terms..."
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring/30" />
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 p-4 border-t border-border sticky bottom-0 bg-card">
                            <button onClick={() => setShowModal(false)} className="h-9 px-4 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancel</button>
                            <button onClick={handleCreate} disabled={!title.trim() || !clientName.trim() || saving}
                                className="flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                                {saving && <RiLoader4Line className="w-4 h-4 animate-spin" />}
                                Create Proposal
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
