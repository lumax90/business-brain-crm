"use client";

import * as React from "react";
import { AppHeader } from "@/components/app-header";
import { cn } from "@/lib/utils";
import {
    RiAddLine,
    RiLoader4Line,
    RiCloseLine,
    RiDeleteBinLine,
    RiPlayLine,
    RiPauseLine,
    RiCheckboxCircleLine,
    RiMailLine,
    RiTimerLine,
    RiArrowRightLine,
    RiSendPlaneLine,
    RiEyeLine,
    RiReplyLine,
    RiDraftLine,
} from "@remixicon/react";

interface CampaignStep {
    id: string;
    stepOrder: number;
    type: string;
    subject: string | null;
    body: string | null;
    delayDays: number;
}

interface Campaign {
    id: string;
    name: string;
    description: string | null;
    status: string;
    type: string;
    audienceType: string;
    totalRecipients: number;
    sentCount: number;
    openCount: number;
    replyCount: number;
    _count: { steps: number };
    steps?: CampaignStep[];
    createdAt: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    draft: { label: "Draft", color: "text-stone-600 bg-stone-500/10", icon: <RiDraftLine className="w-3 h-3" /> },
    active: { label: "Active", color: "text-emerald-600 bg-emerald-500/10", icon: <RiPlayLine className="w-3 h-3" /> },
    paused: { label: "Paused", color: "text-amber-600 bg-amber-500/10", icon: <RiPauseLine className="w-3 h-3" /> },
    completed: { label: "Completed", color: "text-blue-600 bg-blue-500/10", icon: <RiCheckboxCircleLine className="w-3 h-3" /> },
};

import { API, apiFetch } from "@/lib/api";
import { toast } from "sonner";

export default function CampaignsPage() {
    const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [showModal, setShowModal] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [expandedId, setExpandedId] = React.useState<string | null>(null);
    const [campaignSteps, setCampaignSteps] = React.useState<Record<string, CampaignStep[]>>({});

    // Form
    const [name, setName] = React.useState("");
    const [description, setDescription] = React.useState("");
    const [type, setType] = React.useState("email");
    const [audienceType, setAudienceType] = React.useState("all");

    // Step form
    const [stepSubject, setStepSubject] = React.useState("");
    const [stepBody, setStepBody] = React.useState("");
    const [stepDelay, setStepDelay] = React.useState("0");

    const fetchCampaigns = async () => {
        try {
            const res = await apiFetch(`${API}/api/campaigns`);
            const data = await res.json();
            if (data.success) setCampaigns(data.campaigns);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    React.useEffect(() => { fetchCampaigns(); }, []);

    const toggleExpand = async (id: string) => {
        if (expandedId === id) { setExpandedId(null); return; }
        setExpandedId(id);
        if (!campaignSteps[id]) {
            try {
                const res = await apiFetch(`${API}/api/campaigns/${id}`);
                const data = await res.json();
                if (data.success) setCampaignSteps((prev) => ({ ...prev, [id]: data.campaign.steps }));
            } catch (err) { console.error(err); }
        }
    };

    const handleCreate = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            const res = await apiFetch(`${API}/api/campaigns`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim(), description: description.trim() || null, type, audienceType }),
            });
            const data = await res.json();
            if (data.success) { setCampaigns((prev) => [data.campaign, ...prev]); setShowModal(false); resetForm(); toast.success("Campaign created."); }
        } catch (err) { console.error(err); toast.error("Failed to create campaign."); }
        finally { setSaving(false); }
    };

    const handleStatusChange = async (id: string, status: string) => {
        setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, status } : c));
        try { await apiFetch(`${API}/api/campaigns/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); toast.success("Campaign status updated."); }
        catch { fetchCampaigns(); toast.error("Failed to update campaign."); }
    };

    const handleDelete = async (id: string) => {
        setCampaigns((prev) => prev.filter((c) => c.id !== id));
        try { await apiFetch(`${API}/api/campaigns/${id}`, { method: "DELETE" }); toast.success("Campaign deleted."); }
        catch { fetchCampaigns(); toast.error("Failed to delete campaign."); }
    };

    const handleAddStep = async (campaignId: string) => {
        if (!stepSubject.trim()) return;
        try {
            const res = await apiFetch(`${API}/api/campaigns/${campaignId}/steps`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ subject: stepSubject.trim(), body: stepBody.trim() || null, delayDays: parseInt(stepDelay) || 0 }),
            });
            const data = await res.json();
            if (data.success) {
                setCampaignSteps((prev) => ({ ...prev, [campaignId]: [...(prev[campaignId] || []), data.step] }));
                setCampaigns((prev) => prev.map((c) => c.id === campaignId ? { ...c, _count: { steps: c._count.steps + 1 } } : c));
                setStepSubject(""); setStepBody(""); setStepDelay("0");
                toast.success("Step added.");
            }
        } catch (err) { console.error(err); toast.error("Failed to add step."); }
    };

    const handleDeleteStep = async (campaignId: string, stepId: string) => {
        setCampaignSteps((prev) => ({ ...prev, [campaignId]: (prev[campaignId] || []).filter((s) => s.id !== stepId) }));
        setCampaigns((prev) => prev.map((c) => c.id === campaignId ? { ...c, _count: { steps: Math.max(0, c._count.steps - 1) } } : c));
        try { await apiFetch(`${API}/api/campaigns/${campaignId}/steps/${stepId}`, { method: "DELETE" }); toast.success("Step deleted."); }
        catch { toast.error("Failed to delete step."); }
    };

    const resetForm = () => { setName(""); setDescription(""); setType("email"); setAudienceType("all"); };

    if (loading) {
        return (
            <>
                <AppHeader title="Campaigns" subtitle="Email sequences & outreach" />
                <div className="flex items-center justify-center h-[60vh]">
                    <RiLoader4Line className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            </>
        );
    }

    return (
        <>
            <AppHeader title="Campaigns" subtitle={`${campaigns.length} campaigns`} />
            <div className="p-6 space-y-6">
                {/* Toolbar */}
                <div className="flex items-center justify-end">
                    <button onClick={() => { resetForm(); setShowModal(true); }}
                        className="flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                        <RiAddLine className="w-4 h-4" /> New Campaign
                    </button>
                </div>

                {/* Campaigns List */}
                <div className="space-y-3">
                    {campaigns.length === 0 && (
                        <div className="rounded-xl border border-border bg-card py-16 text-center text-muted-foreground/60 text-sm">
                            <RiMailLine className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" /> No campaigns yet
                        </div>
                    )}
                    {campaigns.map((campaign, i) => {
                        const isExpanded = expandedId === campaign.id;
                        const steps = campaignSteps[campaign.id] || [];
                        const st = statusConfig[campaign.status] || statusConfig.draft;
                        const openRate = campaign.sentCount > 0 ? Math.round((campaign.openCount / campaign.sentCount) * 100) : 0;
                        const replyRate = campaign.sentCount > 0 ? Math.round((campaign.replyCount / campaign.sentCount) * 100) : 0;

                        return (
                            <div key={campaign.id}
                                className="rounded-xl border border-border bg-card overflow-hidden animate-fade-in"
                                style={{ animationDelay: `${i * 0.04}s` }}>
                                {/* Campaign Header */}
                                <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                                    onClick={() => toggleExpand(campaign.id)}>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <RiArrowRightLine className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0", isExpanded && "rotate-90")} />
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-sm font-semibold text-foreground truncate">{campaign.name}</h3>
                                                <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium", st.color)}>
                                                    {st.icon} {st.label}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full capitalize">{campaign.type}</span>
                                            </div>
                                            {campaign.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{campaign.description}</p>}
                                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1"><RiMailLine className="w-3 h-3" /> {campaign._count.steps} steps</span>
                                                {campaign.sentCount > 0 && (
                                                    <>
                                                        <span className="flex items-center gap-1"><RiSendPlaneLine className="w-3 h-3" /> {campaign.sentCount} sent</span>
                                                        <span className="flex items-center gap-1"><RiEyeLine className="w-3 h-3" /> {openRate}% open</span>
                                                        <span className="flex items-center gap-1"><RiReplyLine className="w-3 h-3" /> {replyRate}% reply</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                        {campaign.status === "draft" && (
                                            <button onClick={() => handleStatusChange(campaign.id, "active")} className="p-1.5 rounded-md text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors" title="Activate">
                                                <RiPlayLine className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        {campaign.status === "active" && (
                                            <button onClick={() => handleStatusChange(campaign.id, "paused")} className="p-1.5 rounded-md text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-colors" title="Pause">
                                                <RiPauseLine className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        {campaign.status === "paused" && (
                                            <button onClick={() => handleStatusChange(campaign.id, "active")} className="p-1.5 rounded-md text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors" title="Resume">
                                                <RiPlayLine className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <button onClick={() => handleDelete(campaign.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors" title="Delete">
                                            <RiDeleteBinLine className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded: Sequence Steps */}
                                {isExpanded && (
                                    <div className="border-t border-border bg-muted/10 p-4 space-y-3">
                                        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Sequence Steps</h4>

                                        {/* Step Timeline */}
                                        {steps.length === 0 && <p className="text-xs text-muted-foreground/60 py-4 text-center">No steps yet. Add your first email step below.</p>}
                                        <div className="space-y-2">
                                            {steps.map((step, si) => (
                                                <div key={step.id} className="flex items-start gap-3 group">
                                                    {/* Timeline dot + line */}
                                                    <div className="flex flex-col items-center pt-1">
                                                        <div className="w-3 h-3 rounded-full border-2 border-primary bg-card shrink-0" />
                                                        {si < steps.length - 1 && <div className="w-0.5 flex-1 bg-border min-h-[24px]" />}
                                                    </div>

                                                    <div className="flex-1 rounded-lg border border-border bg-card p-3 text-sm">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">Step {step.stepOrder}</span>
                                                                {step.delayDays > 0 && (
                                                                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                                                        <RiTimerLine className="w-3 h-3" /> Wait {step.delayDays}d
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <button onClick={() => handleDeleteStep(campaign.id, step.id)}
                                                                className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-rose-500 transition-all">
                                                                <RiCloseLine className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                        <p className="font-medium text-foreground text-xs mt-1">{step.subject || "(No subject)"}</p>
                                                        {step.body && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{step.body}</p>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Add Step */}
                                        <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
                                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Add Step</p>
                                            <div className="flex items-center gap-2">
                                                <input type="text" value={stepSubject} onChange={(e) => setStepSubject(e.target.value)}
                                                    onKeyDown={(e) => e.key === "Enter" && handleAddStep(campaign.id)}
                                                    placeholder="Email subject..." className="h-8 flex-1 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring/30" />
                                                <div className="flex items-center gap-1">
                                                    <RiTimerLine className="w-3 h-3 text-muted-foreground" />
                                                    <input type="number" value={stepDelay} onChange={(e) => setStepDelay(e.target.value)} min="0"
                                                        className="h-8 w-14 rounded-md border border-input bg-background px-2 text-xs text-center focus:outline-none focus:ring-2 focus:ring-ring/30" />
                                                    <span className="text-[10px] text-muted-foreground">days</span>
                                                </div>
                                            </div>
                                            <textarea value={stepBody} onChange={(e) => setStepBody(e.target.value)} rows={2} placeholder="Email body (optional)..."
                                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-ring/30" />
                                            <button onClick={() => handleAddStep(campaign.id)} disabled={!stepSubject.trim()}
                                                className="h-7 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                                                Add Step
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ─── New Campaign Modal ─── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
                    <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h3 className="text-sm font-semibold text-foreground">New Campaign</h3>
                            <button onClick={() => setShowModal(false)} className="p-1 rounded-md hover:bg-muted"><RiCloseLine className="w-4 h-4 text-muted-foreground" /></button>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground">Campaign Name *</label>
                                <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus
                                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="Q1 Outreach" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground">Description</label>
                                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="Campaign description..." />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Type</label>
                                    <select value={type} onChange={(e) => setType(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30">
                                        <option value="email">Email</option>
                                        <option value="sms">SMS</option>
                                        <option value="multi-channel">Multi-channel</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Audience</label>
                                    <select value={audienceType} onChange={(e) => setAudienceType(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30">
                                        <option value="all">All</option>
                                        <option value="leads">Leads</option>
                                        <option value="contacts">Contacts</option>
                                        <option value="custom">Custom</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
                            <button onClick={() => setShowModal(false)} className="h-9 px-4 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancel</button>
                            <button onClick={handleCreate} disabled={!name.trim() || saving}
                                className="flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                                {saving && <RiLoader4Line className="w-4 h-4 animate-spin" />}
                                Create Campaign
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
