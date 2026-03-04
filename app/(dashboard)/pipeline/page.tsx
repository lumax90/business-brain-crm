"use client";

import * as React from "react";
import { AppHeader } from "@/components/app-header";
import { cn } from "@/lib/utils";
import {
    RiMoneyDollarCircleLine,
    RiTimeLine,
    RiDraggable,
    RiAddLine,
    RiLoader4Line,
    RiCloseLine,
    RiDeleteBinLine,
    RiUser3Line,
} from "@remixicon/react";

type DealStage = "new" | "qualified" | "proposal" | "negotiation" | "closed_won" | "closed_lost";

interface Deal {
    id: string;
    title: string;
    value: number;
    currency: string;
    stage: DealStage;
    probability: number;
    contactName: string | null;
    company: string | null;
    notes: string | null;
    expectedCloseDate: string | null;
    leadId: string | null;
    createdAt: string;
    updatedAt: string;
}

interface CrmContact {
    id: string;
    name: string;
    email: string | null;
    company: { id: string; name: string } | null;
}

const stageConfig: Record<DealStage, { label: string; color: string; bgColor: string }> = {
    new: { label: "New", color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-500" },
    qualified: { label: "Qualified", color: "text-violet-600 dark:text-violet-400", bgColor: "bg-violet-500" },
    proposal: { label: "Proposal", color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-500" },
    negotiation: { label: "Negotiation", color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-500" },
    closed_won: { label: "Closed Won", color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-500" },
    closed_lost: { label: "Closed Lost", color: "text-rose-600 dark:text-rose-400", bgColor: "bg-rose-500" },
};

const stageOrder: DealStage[] = ["new", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"];

import { API, apiFetch } from "@/lib/api";
import { toast } from "sonner";

function formatCurrency(val: number) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(val);
}

export default function PipelinePage() {
    const [deals, setDeals] = React.useState<Deal[]>([]);
    const [crmContacts, setCrmContacts] = React.useState<CrmContact[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [draggedDeal, setDraggedDeal] = React.useState<string | null>(null);
    const [dragOverStage, setDragOverStage] = React.useState<DealStage | null>(null);
    const [showAddModal, setShowAddModal] = React.useState(false);
    const [addToStage, setAddToStage] = React.useState<DealStage>("new");
    const [saving, setSaving] = React.useState(false);

    // New deal form
    const [selectedContactId, setSelectedContactId] = React.useState("");
    const [newTitle, setNewTitle] = React.useState("");
    const [newValue, setNewValue] = React.useState("");
    const [newContact, setNewContact] = React.useState("");
    const [newCompany, setNewCompany] = React.useState("");
    const [newProbability, setNewProbability] = React.useState("25");
    const [newNotes, setNewNotes] = React.useState("");

    const fetchDeals = async () => {
        try {
            const [dRes, cRes] = await Promise.all([
                apiFetch(`${API}/api/deals`).then((r) => r.json()),
                apiFetch(`${API}/api/contacts`).then((r) => r.json()),
            ]);
            if (dRes.success) setDeals(dRes.deals);
            if (cRes.success) setCrmContacts(cRes.contacts);
        } catch (err) {
            console.error("Failed to fetch deals:", err);
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => { fetchDeals(); }, []);

    const handleContactSelect = (contactId: string) => {
        setSelectedContactId(contactId);
        if (!contactId) return;
        const c = crmContacts.find((ct) => ct.id === contactId);
        if (c) {
            setNewContact(c.name);
            setNewCompany(c.company?.name || "");
        }
    };

    // ─── Drag & Drop ───
    const handleDragStart = (dealId: string) => setDraggedDeal(dealId);
    const handleDragOver = (e: React.DragEvent, stage: DealStage) => {
        e.preventDefault();
        setDragOverStage(stage);
    };
    const handleDragLeave = () => setDragOverStage(null);

    const handleDrop = async (stage: DealStage) => {
        if (!draggedDeal) return;
        const deal = deals.find((d) => d.id === draggedDeal);
        if (!deal || deal.stage === stage) {
            setDraggedDeal(null);
            setDragOverStage(null);
            return;
        }

        // Optimistic update
        setDeals((prev) => prev.map((d) => d.id === draggedDeal ? { ...d, stage } : d));
        setDraggedDeal(null);
        setDragOverStage(null);

        // Persist to backend
        try {
            await apiFetch(`${API}/api/deals/${draggedDeal}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ stage }),
            });
            toast.success("Deal moved.");
        } catch (err) {
            console.error("Failed to update deal stage:", err);
            toast.error("Failed to move deal.");
            fetchDeals(); // Revert on error
        }
    };

    // ─── Create Deal ───
    const handleCreateDeal = async () => {
        if (!newTitle.trim()) return;
        setSaving(true);
        try {
            const res = await apiFetch(`${API}/api/deals`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: newTitle.trim(),
                    value: parseFloat(newValue) || 0,
                    stage: addToStage,
                    contactName: newContact.trim() || null,
                    company: newCompany.trim() || null,
                    probability: parseInt(newProbability) || 0,
                    notes: newNotes.trim() || null,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setDeals((prev) => [data.deal, ...prev]);
                setShowAddModal(false);
                resetForm();
                toast.success("Deal created.");
            }
        } catch (err) {
            console.error("Failed to create deal:", err);
            toast.error("Failed to create deal.");
        } finally {
            setSaving(false);
        }
    };

    // ─── Delete Deal ───
    const handleDeleteDeal = async (dealId: string) => {
        setDeals((prev) => prev.filter((d) => d.id !== dealId));
        try {
            await apiFetch(`${API}/api/deals/${dealId}`, { method: "DELETE" });
            toast.success("Deal deleted.");
        } catch (err) {
            console.error("Failed to delete deal:", err);
            toast.error("Failed to delete deal.");
            fetchDeals();
        }
    };

    const resetForm = () => {
        setSelectedContactId("");
        setNewTitle("");
        setNewValue("");
        setNewContact("");
        setNewCompany("");
        setNewProbability("25");
        setNewNotes("");
    };

    const openAddModal = (stage: DealStage) => {
        setAddToStage(stage);
        resetForm();
        setShowAddModal(true);
    };

    const totalPipeline = deals
        .filter((d) => !["closed_won", "closed_lost"].includes(d.stage))
        .reduce((sum, d) => sum + d.value, 0);

    if (loading) {
        return (
            <>
                <AppHeader title="Pipeline" subtitle="Manage your deal stages" />
                <div className="flex items-center justify-center h-[60vh]">
                    <RiLoader4Line className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            </>
        );
    }

    return (
        <>
            <AppHeader title="Pipeline" subtitle={`${formatCurrency(totalPipeline)} in pipeline · ${deals.length} deals`} />
            <div className="p-6">
                {/* Pipeline Totals Bar */}
                <div className="flex items-center gap-4 mb-6 overflow-x-auto pb-2">
                    {stageOrder.map((stage) => {
                        const stageDeals = deals.filter((d) => d.stage === stage);
                        const total = stageDeals.reduce((sum, d) => sum + d.value, 0);
                        return (
                            <div key={stage} className="flex items-center gap-2 shrink-0">
                                <div className={cn("w-2 h-2 rounded-full", stageConfig[stage].bgColor)} />
                                <span className="text-xs text-muted-foreground">
                                    {stageConfig[stage].label}:{" "}
                                    <span className="font-semibold text-foreground">{formatCurrency(total)}</span>
                                    <span className="text-muted-foreground/60"> ({stageDeals.length})</span>
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Kanban Board */}
                <div className="flex gap-4 overflow-x-auto pb-4">
                    {stageOrder.map((stage) => {
                        const stageDeals = deals.filter((d) => d.stage === stage);
                        const stageTotal = stageDeals.reduce((sum, d) => sum + d.value, 0);
                        const isDragOver = dragOverStage === stage;

                        return (
                            <div
                                key={stage}
                                onDragOver={(e) => handleDragOver(e, stage)}
                                onDragLeave={handleDragLeave}
                                onDrop={() => handleDrop(stage)}
                                className={cn(
                                    "flex flex-col min-w-[280px] w-[280px] shrink-0 rounded-xl border border-border bg-muted/30 transition-all duration-200",
                                    isDragOver && "border-primary/50 bg-primary/[0.03] shadow-sm"
                                )}
                            >
                                {/* Stage Header */}
                                <div className="flex items-center justify-between p-3 border-b border-border/60">
                                    <div className="flex items-center gap-2">
                                        <div className={cn("w-2 h-2 rounded-full", stageConfig[stage].bgColor)} />
                                        <span className="text-xs font-semibold text-foreground">
                                            {stageConfig[stage].label}
                                        </span>
                                        <span className="text-[10px] rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground font-medium">
                                            {stageDeals.length}
                                        </span>
                                    </div>
                                    <span className="text-[10px] font-semibold text-muted-foreground">
                                        {formatCurrency(stageTotal)}
                                    </span>
                                </div>

                                {/* Deal Cards */}
                                <div className="flex-1 p-2 space-y-2 min-h-[200px]">
                                    {stageDeals.map((deal, i) => (
                                        <div
                                            key={deal.id}
                                            draggable
                                            onDragStart={() => handleDragStart(deal.id)}
                                            className={cn(
                                                "group rounded-lg border border-border bg-card p-3 cursor-grab active:cursor-grabbing",
                                                "hover:border-primary/30 hover:shadow-sm transition-all duration-200",
                                                "animate-fade-in",
                                                draggedDeal === deal.id && "opacity-40"
                                            )}
                                            style={{ animationDelay: `${i * 0.05}s` }}
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <p className="text-sm font-medium text-foreground leading-tight pr-2">
                                                    {deal.title}
                                                </p>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteDeal(deal.id); }}
                                                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground/40 hover:text-rose-500 transition-all"
                                                        title="Delete deal"
                                                    >
                                                        <RiDeleteBinLine className="w-3.5 h-3.5" />
                                                    </button>
                                                    <RiDraggable className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                                                </div>
                                            </div>
                                            {(deal.contactName || deal.company) && (
                                                <p className="text-xs text-muted-foreground mb-3">
                                                    {[deal.contactName, deal.company].filter(Boolean).join(" · ")}
                                                </p>
                                            )}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1 text-foreground">
                                                    <RiMoneyDollarCircleLine className="w-3.5 h-3.5 text-primary" />
                                                    <span className="text-xs font-bold">{formatCurrency(deal.value)}</span>
                                                </div>
                                                {deal.probability > 0 && (
                                                    <span className="text-[10px] text-muted-foreground">{deal.probability}%</span>
                                                )}
                                            </div>
                                            {deal.probability > 0 && (
                                                <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-primary/60 transition-all duration-500"
                                                        style={{ width: `${deal.probability}%` }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {stageDeals.length === 0 && (
                                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
                                            <p className="text-xs">No deals</p>
                                        </div>
                                    )}
                                </div>

                                {/* Add Deal Button */}
                                <div className="p-2 border-t border-border/60">
                                    <button
                                        onClick={() => openAddModal(stage)}
                                        className="flex items-center justify-center gap-1.5 w-full py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                                    >
                                        <RiAddLine className="w-3.5 h-3.5" />
                                        Add Deal
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ─── Add Deal Modal ─── */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
                    <div
                        className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md mx-4 animate-in zoom-in-95"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <div>
                                <h3 className="text-sm font-semibold text-foreground">New Deal</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Adding to <span className={cn("font-semibold", stageConfig[addToStage].color)}>{stageConfig[addToStage].label}</span>
                                </p>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="p-1 rounded-md hover:bg-muted transition-colors">
                                <RiCloseLine className="w-4 h-4 text-muted-foreground" />
                            </button>
                        </div>

                        <div className="p-4 space-y-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground">Deal Title *</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Enterprise License Deal"
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/40"
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Value ($)</label>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        value={newValue}
                                        onChange={(e) => setNewValue(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/40"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Probability (%)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        placeholder="25"
                                        value={newProbability}
                                        onChange={(e) => setNewProbability(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/40"
                                    />
                                </div>
                            </div>

                            {/* CRM Contact Picker */}
                            {crmContacts.length > 0 && (
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                        <RiUser3Line className="w-3 h-3 text-primary" />
                                        Pick from CRM Contacts
                                    </label>
                                    <select value={selectedContactId} onChange={(e) => handleContactSelect(e.target.value)}
                                        className="h-9 w-full rounded-md border border-primary/30 bg-primary/[0.03] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                                        <option value="">— Select a contact or enter manually —</option>
                                        {crmContacts.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}{c.company ? ` (${c.company.name})` : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Contact Name</label>
                                    <input
                                        type="text"
                                        placeholder="John Doe"
                                        value={newContact}
                                        onChange={(e) => setNewContact(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/40"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Company</label>
                                    <input
                                        type="text"
                                        placeholder="Acme Inc."
                                        value={newCompany}
                                        onChange={(e) => setNewCompany(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/40"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground">Notes</label>
                                <textarea
                                    placeholder="Optional deal notes..."
                                    value={newNotes}
                                    onChange={(e) => setNewNotes(e.target.value)}
                                    rows={2}
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/40"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="h-9 px-4 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateDeal}
                                disabled={!newTitle.trim() || saving}
                                className="flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                            >
                                {saving && <RiLoader4Line className="w-4 h-4 animate-spin" />}
                                Create Deal
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
