"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
    RiMailLine,
    RiMailCheckLine,
    RiMailCloseLine,
    RiSearchLine,
    RiPlayCircleLine,
    RiStopCircleLine,
    RiLoader4Line,
    RiCheckboxCircleLine,
    RiCheckboxLine,
    RiCheckboxBlankLine,
    RiCheckboxIndeterminateLine,
    RiCloseCircleLine,
    RiQuestionLine,
    RiAlertLine,
    RiRefreshLine,
    RiShieldCheckLine,
    RiFilter3Line,
    RiFolder3Line,
    RiCloseLine,
    RiSettings3Line,
    RiGlobalLine,
    RiEditLine,
    RiArrowRightLine,
} from "@remixicon/react";

import { API, apiFetch } from "@/lib/api";
import { toast } from "sonner";

interface EmailStats {
    total: number;
    withEmail: number;
    found: number;
    notFound: number;
    catchAll: number;
    pending: number;
    verified: number;
}

interface LeadList {
    id: string;
    name: string;
    color: string;
    leadCount: number;
}

interface EnrichmentLead {
    id: string;
    name: string;
    email: string | null;
    status: string;
    pattern?: string;
    reason?: string;
}

const STATUS_BADGES: Record<string, { label: string; className: string; icon: React.ElementType }> = {
    found: { label: "Found", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", icon: RiCheckboxCircleLine },
    catch_all: { label: "Catch-All", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20", icon: RiAlertLine },
    not_found: { label: "Not Found", className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20", icon: RiCloseCircleLine },
    pending: { label: "Pending", className: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20", icon: RiQuestionLine },
    error: { label: "Error", className: "bg-red-500/10 text-red-500 border-red-500/20", icon: RiAlertLine },
};

export default function MailsPage() {
    const [stats, setStats] = React.useState<EmailStats | null>(null);
    const [lists, setLists] = React.useState<LeadList[]>([]);
    const [selectedList, setSelectedList] = React.useState<string>("all");
    const [statusFilter, setStatusFilter] = React.useState<string>("all");

    // ─── Selection ───
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

    // ─── Enrichment state ───
    const [enriching, setEnriching] = React.useState(false);
    const [enrichProgress, setEnrichProgress] = React.useState<{ processed: number; found: number; total: number } | null>(null);
    const [recentResults, setRecentResults] = React.useState<EnrichmentLead[]>([]);

    // ─── Verify state ───
    const [verifying, setVerifying] = React.useState(false);
    const [verifyProgress, setVerifyProgress] = React.useState<{ processed: number; valid: number; total: number } | null>(null);

    // ─── Domain search state ───
    const [findingDomains, setFindingDomains] = React.useState(false);
    const [domainProgress, setDomainProgress] = React.useState<{ processed: number; found: number; total: number } | null>(null);
    const [domainResults, setDomainResults] = React.useState<any[]>([]);
    const [reviewItems, setReviewItems] = React.useState<any[]>([]);
    const [showReviewModal, setShowReviewModal] = React.useState(false);
    const [reviewDomains, setReviewDomains] = React.useState<Record<string, string>>({});

    // ─── Modals ───
    const [showDomainModal, setShowDomainModal] = React.useState(false);
    const [showEnrichModal, setShowEnrichModal] = React.useState(false);
    const [showVerifyModal, setShowVerifyModal] = React.useState(false);

    // ─── Domain settings ───
    const [domainScope, setDomainScope] = React.useState<"selected" | "list" | "all">("selected");
    const [domainListId, setDomainListId] = React.useState<string>("all");

    // ─── Enrich settings ───
    const [enrichScope, setEnrichScope] = React.useState<"selected" | "list" | "all">("selected");
    const [enrichListId, setEnrichListId] = React.useState<string>("all");
    const [enrichRetry, setEnrichRetry] = React.useState(false);

    // ─── Verify settings ───
    const [verifyScope, setVerifyScope] = React.useState<"selected" | "list" | "all">("selected");
    const [verifyListId, setVerifyListId] = React.useState<string>("all");

    // ─── Move to list ───
    const [showMoveModal, setShowMoveModal] = React.useState(false);
    const [moveTargetList, setMoveTargetList] = React.useState<string>("");
    const [moving, setMoving] = React.useState(false);

    // ─── Options ───
    const [domainRerun, setDomainRerun] = React.useState(false);
    const [domainUseAi, setDomainUseAi] = React.useState(false);
    const [enrichUseAi, setEnrichUseAi] = React.useState(false);

    const abortRef = React.useRef<AbortController | null>(null);

    // ─── Settings state ───
    const [hasApiKey, setHasApiKey] = React.useState(false);

    React.useEffect(() => {
        apiFetch(`${API}/api/settings`)
            .then(res => res.json())
            .then(data => setHasApiKey(!!data.settings?.OPENAI_API_KEY))
            .catch(() => setHasApiKey(false));
    }, []);

    // ─── Fetch ───
    const fetchStats = React.useCallback(async () => {
        try {
            const res = await apiFetch(`${API}/api/email/stats`);
            const data = await res.json();
            if (data.success) setStats(data.stats);
        } catch (err) { console.error("Stats error:", err); }
    }, []);

    const fetchLists = React.useCallback(async () => {
        try {
            const res = await apiFetch(`${API}/api/lists`);
            const data = await res.json();
            if (data.success) setLists(data.lists);
        } catch (err) { console.error("Lists error:", err); }
    }, []);

    React.useEffect(() => {
        fetchStats();
        fetchLists();
    }, [fetchStats, fetchLists]);

    // ─── Leads Table ───
    const [leads, setLeads] = React.useState<any[]>([]);
    const [loadingLeads, setLoadingLeads] = React.useState(true);
    const [page, setPage] = React.useState(1);
    const [totalLeads, setTotalLeads] = React.useState(0);
    const limit = 50;

    const fetchLeads = React.useCallback(async () => {
        setLoadingLeads(true);
        try {
            let url = `${API}/api/leads?page=${page}&limit=${limit}&sort=updatedAt&order=desc`;
            if (selectedList !== "all") url += `&listId=${selectedList}`;
            const res = await apiFetch(url);
            const data = await res.json();
            if (data.success) {
                setLeads(data.leads);
                setTotalLeads(data.pagination?.total ?? data.total ?? 0);
            }
        } catch (err) { console.error("Fetch leads error:", err); }
        finally { setLoadingLeads(false); }
    }, [page, selectedList]);

    React.useEffect(() => { fetchLeads(); }, [fetchLeads]);

    // ─── Selection helpers ───
    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredLeads.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(filteredLeads.map((l) => l.id)));
    };

    const clearSelection = () => setSelectedIds(new Set());

    // ─── Open Domain Modal ───
    const openDomainModal = () => {
        if (selectedIds.size > 0) setDomainScope("selected");
        else if (selectedList !== "all") { setDomainScope("list"); setDomainListId(selectedList); }
        else setDomainScope("all");
        setShowDomainModal(true);
    };

    // ─── Open Enrich Modal ───
    const openEnrichModal = () => {
        if (selectedIds.size > 0) setEnrichScope("selected");
        else if (selectedList !== "all") { setEnrichScope("list"); setEnrichListId(selectedList); }
        else setEnrichScope("all");
        setShowEnrichModal(true);
    };

    // ─── Open Verify Modal ───
    const openVerifyModal = () => {
        if (selectedIds.size > 0) setVerifyScope("selected");
        else if (selectedList !== "all") { setVerifyScope("list"); setVerifyListId(selectedList); }
        else setVerifyScope("all");
        setShowVerifyModal(true);
    };

    // ─── Start Domain Discovery ───
    const startDomainSearch = async () => {
        setShowDomainModal(false);
        setFindingDomains(true);
        setDomainProgress({ processed: 0, found: 0, total: 0 });
        setDomainResults([]);
        setReviewItems([]);

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const body: any = {};
            if (domainScope === "selected") body.leadIds = Array.from(selectedIds);
            else if (domainScope === "list" && domainListId !== "all") body.listId = domainListId;

            if (domainRerun) body.forceRerun = true;
            if (domainUseAi) body.useAiFallback = true;

            const response = await apiFetch(`${API}/api/email/find-domains`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            if (!response.body) { setFindingDomains(false); return; }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.type === "start") setDomainProgress({ processed: 0, found: 0, total: data.totalCompanies });
                        else if (data.type === "progress") {
                            setDomainProgress({ processed: data.processed, found: data.found, total: data.total });
                            if (data.result) setDomainResults((prev) => [data.result, ...prev].slice(0, 50));
                        } else if (data.type === "complete") {
                            setFindingDomains(false);
                            toast.success(`Domain search complete: ${data.reviewItems?.length ? data.reviewItems.length + " need review" : "all saved"}`);
                            if (data.reviewItems && data.reviewItems.length > 0) {
                                setReviewItems(data.reviewItems);
                                const defaults: Record<string, string> = {};
                                data.reviewItems.forEach((item: any) => {
                                    defaults[item.company] = item.domain || "";
                                });
                                setReviewDomains(defaults);
                                setShowReviewModal(true);
                            }
                            fetchLeads();
                        }
                    } catch { }
                }
            }
        } catch (err: any) {
            if (err.name !== "AbortError") {
                console.error("Domain search error:", err);
                toast.error("Domain search failed. Please try again.");
            }
        }
        setFindingDomains(false);
    };

    // ─── Save Manual Review Domains ───
    const saveReviewDomains = async () => {
        for (const item of reviewItems) {
            const domain = reviewDomains[item.company];
            if (!domain) continue;
            try {
                await apiFetch(`${API}/api/email/set-domain`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ company: item.company, domain }),
                });
            } catch (err) {
                console.error("Set domain error:", err);
                toast.error(`Failed to set domain for ${item.company}`);
            }
        }
        toast.success("Review domains saved successfully");
        setShowReviewModal(false);
        setReviewItems([]);
        fetchLeads();
    };

    // ─── Start Enrichment ───
    const startEnrichment = async () => {
        setShowEnrichModal(false);
        setEnriching(true);
        setEnrichProgress({ processed: 0, found: 0, total: 0 });
        setRecentResults([]);

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const body: any = {};
            if (enrichScope === "selected") body.leadIds = Array.from(selectedIds);
            else if (enrichScope === "list" && enrichListId !== "all") body.listId = enrichListId;
            if (enrichRetry) body.retryFailed = true;
            if (enrichUseAi) body.useAiFallback = true;

            const response = await apiFetch(`${API}/api/email/enrich`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            if (!response.body) { setEnriching(false); return; }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.type === "start") setEnrichProgress({ processed: 0, found: 0, total: data.total });
                        else if (data.type === "progress") {
                            setEnrichProgress({ processed: data.processed, found: data.found, total: data.total });
                            if (data.lead) setRecentResults((prev) => [data.lead, ...prev].slice(0, 30));
                        } else if (data.type === "complete") {
                            setEnriching(false);
                            toast.success("Email enrichment complete");
                            fetchStats();
                            fetchLeads();
                        }
                    } catch { }
                }
            }
        } catch (err: any) {
            if (err.name !== "AbortError") {
                console.error("Enrichment error:", err);
                toast.error("Email enrichment failed. Please try again.");
            }
        }
        setEnriching(false);
    };

    // ─── Start Verification ───
    const startVerification = async () => {
        setShowVerifyModal(false);
        setVerifying(true);
        setVerifyProgress({ processed: 0, valid: 0, total: 0 });

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            // Get lead IDs to verify
            let idsToVerify: string[] = [];
            if (verifyScope === "selected") {
                idsToVerify = Array.from(selectedIds);
            } else {
                // Fetch all leads from the list or all
                let url = `${API}/api/leads?limit=10000`;
                if (verifyScope === "list" && verifyListId !== "all") url += `&listId=${verifyListId}`;
                const res = await apiFetch(url);
                const data = await res.json();
                if (data.success) idsToVerify = data.leads.filter((l: any) => l.email).map((l: any) => l.id);
            }

            if (idsToVerify.length === 0) {
                setVerifying(false);
                return;
            }

            const response = await apiFetch(`${API}/api/email/verify-leads`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ leadIds: idsToVerify }),
                signal: controller.signal,
            });

            if (!response.body) { setVerifying(false); return; }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.type === "start") setVerifyProgress({ processed: 0, valid: 0, total: data.total });
                        else if (data.type === "progress") setVerifyProgress({ processed: data.processed, valid: data.valid, total: data.total });
                        else if (data.type === "complete") {
                            setVerifying(false);
                            toast.success("Email verification complete");
                            fetchStats();
                            fetchLeads();
                        }
                    } catch { }
                }
            }
        } catch (err: any) {
            if (err.name !== "AbortError") {
                console.error("Verify error:", err);
                toast.error("Email verification failed. Please try again.");
            }
        }
        setVerifying(false);
    };

    // ─── Move to List ───
    const moveToList = async () => {
        if (!moveTargetList || selectedIds.size === 0) return;
        setMoving(true);
        try {
            await apiFetch(`${API}/api/leads/move-to-list`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ leadIds: Array.from(selectedIds), listId: moveTargetList }),
            });
            toast.success(`${selectedIds.size} leads moved successfully`);
            setShowMoveModal(false);
            clearSelection();
            fetchLeads();
        } catch (err) {
            console.error("Move error:", err);
            toast.error("Failed to move leads. Please try again.");
        }
        setMoving(false);
    };

    const stopOperation = () => {
        abortRef.current?.abort();
        setFindingDomains(false);
        setEnriching(false);
        setVerifying(false);
        toast.info("Operation stopped");
        fetchStats();
        fetchLeads();
    };

    // ─── Filtered leads ───
    const filteredLeads = statusFilter === "all"
        ? leads
        : leads.filter((l) => l.emailStatus === statusFilter);

    const totalPages = Math.ceil(totalLeads / limit);
    const isRunning = findingDomains || enriching || verifying;

    const successRate = stats && stats.total > 0
        ? Math.round(((stats.found + stats.catchAll) / Math.max(1, stats.total - stats.pending)) * 100) || 0
        : 0;

    return (
        <div className="flex flex-col h-screen overflow-hidden">
            {/* ─── Header ─── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <RiMailLine className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-foreground tracking-tight">Email Enrichment</h1>
                        <p className="text-xs text-muted-foreground">Find & verify email addresses for your leads</p>
                    </div>
                </div>
            </div>

            {/* ─── Stats Cards ─── */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 px-6 py-4 shrink-0">
                    {[
                        { label: "Total Leads", value: stats.total, icon: RiMailLine, color: "text-foreground" },
                        { label: "Emails Found", value: stats.found, icon: RiMailCheckLine, color: "text-emerald-500" },
                        { label: "Catch-All", value: stats.catchAll, icon: RiAlertLine, color: "text-amber-500" },
                        { label: "Not Found", value: stats.notFound, icon: RiMailCloseLine, color: "text-red-500" },
                        { label: "Pending", value: stats.pending, icon: RiQuestionLine, color: "text-zinc-400" },
                        { label: "Verified", value: stats.verified, icon: RiShieldCheckLine, color: "text-blue-500" },
                        { label: "Success Rate", value: `${successRate}%`, icon: RiCheckboxCircleLine, color: "text-emerald-500" },
                    ].map((stat) => (
                        <div key={stat.label} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                            <stat.icon className={cn("w-5 h-5 shrink-0", stat.color)} />
                            <div>
                                <p className={cn("text-base font-bold", stat.color)}>{typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ─── Controls Bar ─── */}
            <div className="flex items-center gap-3 px-6 py-3 border-b border-border shrink-0">
                {/* List Filter */}
                <div className="flex items-center gap-2">
                    <RiFolder3Line className="w-4 h-4 text-muted-foreground" />
                    <select
                        value={selectedList}
                        onChange={(e) => { setSelectedList(e.target.value); setPage(1); clearSelection(); }}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring/30"
                    >
                        <option value="all">All Leads</option>
                        {lists.map((l) => (
                            <option key={l.id} value={l.id}>{l.name} ({l.leadCount})</option>
                        ))}
                    </select>
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-2">
                    <RiFilter3Line className="w-4 h-4 text-muted-foreground" />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring/30"
                    >
                        <option value="all">All Statuses</option>
                        <option value="found">✅ Found</option>
                        <option value="catch_all">⚠️ Catch-All</option>
                        <option value="not_found">❌ Not Found</option>
                        <option value="pending">⏳ Pending</option>
                        <option value="error">🔴 Error</option>
                    </select>
                </div>

                {selectedIds.size > 0 && (
                    <>
                        <span className="text-xs font-semibold text-primary">{selectedIds.size} selected</span>
                        <button onClick={() => setShowMoveModal(true)} className="flex items-center gap-1 h-8 px-3 rounded-md border border-input text-xs font-medium hover:bg-muted transition-colors">
                            <RiArrowRightLine className="w-3.5 h-3.5" /> Move to List
                        </button>
                    </>
                )}

                <div className="flex-1" />

                {/* Action Buttons */}
                {isRunning ? (
                    <button onClick={stopOperation} className="flex items-center gap-1.5 h-8 px-4 rounded-md bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 transition-colors">
                        <RiStopCircleLine className="w-4 h-4" /> Stop
                    </button>
                ) : (
                    <>
                        <button onClick={openDomainModal} className="flex items-center gap-1.5 h-8 px-4 rounded-md bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 transition-colors">
                            <RiGlobalLine className="w-4 h-4" /> Find Domains
                        </button>
                        <button onClick={openEnrichModal} className="flex items-center gap-1.5 h-8 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                            <RiSearchLine className="w-4 h-4" /> Find Emails
                        </button>
                        <button onClick={openVerifyModal} className="flex items-center gap-1.5 h-8 px-4 rounded-md border border-input text-xs font-medium hover:bg-muted transition-colors">
                            <RiShieldCheckLine className="w-4 h-4" /> Verify Emails
                        </button>
                    </>
                )}

                <button onClick={() => { fetchStats(); fetchLeads(); }} className="flex items-center gap-1 h-8 px-3 rounded-md border border-input text-xs font-medium hover:bg-muted transition-colors">
                    <RiRefreshLine className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* ─── Domain Progress ─── */}
            {domainProgress && domainProgress.total > 0 && (
                <div className="px-6 py-3 border-b border-border bg-orange-500/5">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            {findingDomains && <RiLoader4Line className="w-4 h-4 animate-spin text-orange-500" />}
                            <span className="text-xs font-semibold text-foreground">
                                {findingDomains ? "Finding domains..." : "Domain Search Complete"}
                            </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                            {domainProgress.processed}/{domainProgress.total} companies · {domainProgress.found} found
                        </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-orange-500 transition-all duration-300"
                            style={{ width: `${(domainProgress.processed / domainProgress.total) * 100}%` }} />
                    </div>
                </div>
            )}

            {/* ─── Domain Live Results ─── */}
            {findingDomains && domainResults.length > 0 && (
                <div className="px-6 py-2 border-b border-border bg-muted/30 max-h-[160px] overflow-y-auto">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Domain Results</p>
                    <div className="space-y-1">
                        {domainResults.slice(0, 10).map((r, i) => (
                            <div key={`${r.company}-${i}`} className="flex items-center gap-2 text-xs">
                                {r.autoSaved ? (
                                    <RiCheckboxCircleLine className="w-3 h-3 text-emerald-500 shrink-0" />
                                ) : r.domain ? (
                                    <RiAlertLine className="w-3 h-3 text-amber-500 shrink-0" />
                                ) : (
                                    <RiCloseCircleLine className="w-3 h-3 text-red-500 shrink-0" />
                                )}
                                <span className="font-medium text-foreground truncate w-40">{r.company}</span>
                                <span className="text-muted-foreground">→</span>
                                <span className={cn("truncate", r.domain ? "text-foreground" : "text-muted-foreground/50")}>
                                    {r.domain || "Not found"}
                                </span>
                                <span className="text-[10px] text-muted-foreground/40">{r.confidence}%</span>
                                <span className="text-[10px] text-muted-foreground/30">({r.leadCount} leads)</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── Enrichment Progress ─── */}
            {enrichProgress && enrichProgress.total > 0 && (
                <div className="px-6 py-3 border-b border-border bg-primary/5">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            {enriching && <RiLoader4Line className="w-4 h-4 animate-spin text-primary" />}
                            <span className="text-xs font-semibold text-foreground">
                                {enriching ? "Finding emails..." : "Enrichment Complete"}
                            </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                            {enrichProgress.processed}/{enrichProgress.total} processed · {enrichProgress.found} found
                        </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all duration-300"
                            style={{ width: `${(enrichProgress.processed / enrichProgress.total) * 100}%` }} />
                    </div>
                </div>
            )}

            {/* ─── Verify Progress ─── */}
            {verifyProgress && verifyProgress.total > 0 && (
                <div className="px-6 py-3 border-b border-border bg-blue-500/5">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            {verifying && <RiLoader4Line className="w-4 h-4 animate-spin text-blue-500" />}
                            <span className="text-xs font-semibold text-foreground">
                                {verifying ? "Verifying emails..." : "Verification Complete"}
                            </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                            {verifyProgress.processed}/{verifyProgress.total} processed · {verifyProgress.valid} valid
                        </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${(verifyProgress.processed / verifyProgress.total) * 100}%` }} />
                    </div>
                </div>
            )}

            {/* ─── Live Results Feed ─── */}
            {enriching && recentResults.length > 0 && (
                <div className="px-6 py-2 border-b border-border bg-muted/30 max-h-[160px] overflow-y-auto">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Live Results</p>
                    <div className="space-y-1">
                        {recentResults.slice(0, 10).map((r, i) => {
                            const badge = STATUS_BADGES[r.status] || STATUS_BADGES.pending;
                            return (
                                <div key={`${r.id}-${i}`} className="flex items-center gap-2 text-xs animate-fade-in">
                                    <badge.icon className={cn("w-3 h-3 shrink-0", badge.className.split(" ").find(c => c.startsWith("text-")))} />
                                    <span className="font-medium text-foreground truncate w-32">{r.name || "—"}</span>
                                    <span className="text-muted-foreground">→</span>
                                    <span className={cn("truncate", r.email ? "text-foreground" : "text-muted-foreground/50")}>
                                        {r.email || r.reason || "Not found"}
                                    </span>
                                    {r.pattern && <span className="text-[10px] text-muted-foreground/40">({r.pattern})</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ─── Leads Table ─── */}
            <div className="flex-1 min-h-0 overflow-auto">
                <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                        <tr className="border-b border-border bg-card">
                            <th className="w-10 py-2.5 px-3">
                                <button onClick={toggleSelectAll} className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground">
                                    {selectedIds.size === 0 ? <RiCheckboxBlankLine className="w-4 h-4" /> :
                                        selectedIds.size === filteredLeads.length ? <RiCheckboxLine className="w-4 h-4 text-primary" /> :
                                            <RiCheckboxIndeterminateLine className="w-4 h-4 text-primary" />}
                                </button>
                            </th>
                            <th className="text-left py-2.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-[200px]">Name</th>
                            <th className="text-left py-2.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-[150px]">Company</th>
                            <th className="text-left py-2.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-[140px]">Domain</th>
                            <th className="text-left py-2.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-[220px]">Email</th>
                            <th className="text-left py-2.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-[100px]">Status</th>
                            <th className="text-left py-2.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-[90px]">Pattern</th>
                            <th className="text-left py-2.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-[110px]">Verified</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loadingLeads ? (
                            <tr><td colSpan={8} className="text-center py-20">
                                <RiLoader4Line className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                                <p className="text-xs text-muted-foreground mt-2">Loading leads...</p>
                            </td></tr>
                        ) : filteredLeads.length === 0 ? (
                            <tr><td colSpan={8} className="text-center py-20">
                                <RiMailLine className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                                <p className="text-sm font-medium text-muted-foreground">No leads found</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">Import leads first, then run email enrichment</p>
                            </td></tr>
                        ) : (
                            filteredLeads.map((lead) => {
                                const emailStatus = lead.emailStatus || "pending";
                                const badge = STATUS_BADGES[emailStatus] || STATUS_BADGES.pending;
                                const BadgeIcon = badge.icon;
                                const isSelected = selectedIds.has(lead.id);
                                return (
                                    <tr key={lead.id} className={cn("border-b border-border/40 hover:bg-muted/30 transition-colors", isSelected && "bg-primary/5")}>
                                        <td className="w-10 py-2 px-3">
                                            <button onClick={() => toggleSelect(lead.id)} className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground">
                                                {isSelected ? <RiCheckboxLine className="w-4 h-4 text-primary" /> : <RiCheckboxBlankLine className="w-4 h-4" />}
                                            </button>
                                        </td>
                                        <td className="py-2 px-4">
                                            <div>
                                                <p className="text-xs font-medium text-foreground truncate">{lead.name || "—"}</p>
                                                <p className="text-[10px] text-muted-foreground truncate">{lead.title || ""}</p>
                                            </div>
                                        </td>
                                        <td className="py-2 px-4">
                                            <span className="text-xs text-muted-foreground truncate block">{lead.company || "—"}</span>
                                        </td>
                                        <td className="py-2 px-4">
                                            {lead.website ? (
                                                <span className="text-xs text-foreground font-mono truncate block">{lead.website}</span>
                                            ) : (
                                                <span className="text-xs text-muted-foreground/30">—</span>
                                            )}
                                        </td>
                                        <td className="py-2 px-4">
                                            {lead.email ? (
                                                <a href={`mailto:${lead.email}`} className="text-xs text-primary hover:underline truncate block">
                                                    {lead.email}
                                                </a>
                                            ) : (
                                                <span className="text-xs text-muted-foreground/40">—</span>
                                            )}
                                        </td>
                                        <td className="py-2 px-4">
                                            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border", badge.className)}>
                                                <BadgeIcon className="w-3 h-3" />
                                                {badge.label}
                                            </span>
                                        </td>
                                        <td className="py-2 px-4">
                                            <span className="text-[10px] text-muted-foreground font-mono">{lead.emailPattern || "—"}</span>
                                        </td>
                                        <td className="py-2 px-4">
                                            <span className="text-[10px] text-muted-foreground">
                                                {lead.emailVerifiedAt ? new Date(lead.emailVerifiedAt).toLocaleDateString() : "—"}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* ─── Pagination ─── */}
            {totalPages > 1 && (() => {
                // Generate page numbers with ellipsis
                const pages: (number | string)[] = [];
                if (totalPages <= 7) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                } else {
                    pages.push(1);
                    if (page > 3) pages.push("...");
                    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
                    if (page < totalPages - 2) pages.push("...");
                    pages.push(totalPages);
                }
                return (
                    <div className="flex items-center justify-between px-6 py-3 border-t border-border shrink-0">
                        <span className="text-xs text-muted-foreground">
                            {totalLeads.toLocaleString()} leads · Page {page} of {totalPages}
                        </span>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                                className="h-7 px-2 rounded border border-input text-xs hover:bg-muted disabled:opacity-40 transition-colors">Prev</button>
                            {pages.map((p, i) =>
                                typeof p === "string" ? (
                                    <span key={`ellipsis-${i}`} className="text-xs text-muted-foreground px-1">…</span>
                                ) : (
                                    <button key={p} onClick={() => setPage(p)}
                                        className={cn("h-7 w-7 rounded border text-xs transition-colors",
                                            p === page ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-muted"
                                        )}>{p}</button>
                                )
                            )}
                            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                                className="h-7 px-2 rounded border border-input text-xs hover:bg-muted disabled:opacity-40 transition-colors">Next</button>
                        </div>
                    </div>
                );
            })()}

            {/* ═══════════════════════════════════════════
                         FIND EMAILS MODAL
               ═══════════════════════════════════════════ */}
            {showEnrichModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in">
                    <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-scale">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <div>
                                <h2 className="text-sm font-semibold text-foreground">Find Emails</h2>
                                <p className="text-xs text-muted-foreground">Generate &amp; verify email addresses from lead data</p>
                            </div>
                            <button onClick={() => setShowEnrichModal(false)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-muted">
                                <RiCloseLine className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Scope */}
                            <div>
                                <label className="text-xs font-semibold text-foreground block mb-2">Target</label>
                                <div className="space-y-2">
                                    {selectedIds.size > 0 && (
                                        <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors">
                                            <input type="radio" name="enrich-scope" value="selected" checked={enrichScope === "selected"} onChange={() => setEnrichScope("selected")} className="w-3.5 h-3.5 text-primary" />
                                            <div>
                                                <p className="text-xs font-medium text-foreground">Selected leads ({selectedIds.size})</p>
                                                <p className="text-[10px] text-muted-foreground">Only process the checked leads</p>
                                            </div>
                                        </label>
                                    )}
                                    <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors">
                                        <input type="radio" name="enrich-scope" value="list" checked={enrichScope === "list"} onChange={() => setEnrichScope("list")} className="w-3.5 h-3.5 text-primary" />
                                        <div className="flex-1">
                                            <p className="text-xs font-medium text-foreground">Specific list</p>
                                            <p className="text-[10px] text-muted-foreground">Process all leads in a list</p>
                                        </div>
                                    </label>
                                    {enrichScope === "list" && (
                                        <select value={enrichListId} onChange={(e) => setEnrichListId(e.target.value)}
                                            className="ml-6 h-8 w-[calc(100%-1.5rem)] rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring/30">
                                            <option value="all">All Leads</option>
                                            {lists.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.leadCount})</option>)}
                                        </select>
                                    )}
                                    <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors">
                                        <input type="radio" name="enrich-scope" value="all" checked={enrichScope === "all"} onChange={() => setEnrichScope("all")} className="w-3.5 h-3.5 text-primary" />
                                        <div>
                                            <p className="text-xs font-medium text-foreground">All leads</p>
                                            <p className="text-[10px] text-muted-foreground">Process every lead in the database</p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Options */}
                            <div>
                                <label className="text-xs font-semibold text-foreground block mb-2">Options</label>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors">
                                        <input type="checkbox" checked={enrichRetry} onChange={(e) => setEnrichRetry(e.target.checked)} className="w-3.5 h-3.5 text-primary rounded" />
                                        <div>
                                            <p className="text-xs font-medium text-foreground">Retry failed/not found</p>
                                            <p className="text-[10px] text-muted-foreground">Re-process leads that previously failed or returned no result</p>
                                        </div>
                                    </label>
                                    <label className={cn("flex items-center gap-2 p-2.5 rounded-lg border border-border transition-colors", hasApiKey ? "cursor-pointer hover:bg-muted/30" : "opacity-50 cursor-not-allowed")}>
                                        <input type="checkbox" checked={enrichUseAi} onChange={(e) => setEnrichUseAi(e.target.checked)} disabled={!hasApiKey} className="w-3.5 h-3.5 text-primary rounded" />
                                        <div>
                                            <p className="text-xs font-medium text-foreground">
                                                Use AI Fallback
                                                {!hasApiKey && <span className="text-red-500 font-normal ml-1">(Requires OpenAI Key in Settings)</span>}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">Utilize LLM to guess standard email formats if regular combinations fail</p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Info */}
                            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                                <p className="text-[10px] text-muted-foreground">
                                    <strong className="text-foreground">How it works:</strong> For each lead, we guess the email from name + company domain,
                                    then verify via SMTP. Processing speed: ~1 lead/sec to avoid blacklisting.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 px-6 py-3 border-t border-border">
                            <button onClick={() => setShowEnrichModal(false)} className="h-8 px-4 rounded-md border border-input text-xs font-medium hover:bg-muted transition-colors">Cancel</button>
                            <button onClick={startEnrichment} className="flex items-center gap-1.5 h-8 px-5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                                <RiSearchLine className="w-3.5 h-3.5" /> Start Finding Emails
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════
                         VERIFY EMAILS MODAL
               ═══════════════════════════════════════════ */}
            {showVerifyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in">
                    <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-scale">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <div>
                                <h2 className="text-sm font-semibold text-foreground">Verify Emails</h2>
                                <p className="text-xs text-muted-foreground">Re-check if existing emails are still valid</p>
                            </div>
                            <button onClick={() => setShowVerifyModal(false)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-muted">
                                <RiCloseLine className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Scope */}
                            <div>
                                <label className="text-xs font-semibold text-foreground block mb-2">Target</label>
                                <div className="space-y-2">
                                    {selectedIds.size > 0 && (
                                        <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors">
                                            <input type="radio" name="verify-scope" value="selected" checked={verifyScope === "selected"} onChange={() => setVerifyScope("selected")} className="w-3.5 h-3.5 text-primary" />
                                            <div>
                                                <p className="text-xs font-medium text-foreground">Selected leads ({selectedIds.size})</p>
                                                <p className="text-[10px] text-muted-foreground">Only verify checked leads with emails</p>
                                            </div>
                                        </label>
                                    )}
                                    <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors">
                                        <input type="radio" name="verify-scope" value="list" checked={verifyScope === "list"} onChange={() => setVerifyScope("list")} className="w-3.5 h-3.5 text-primary" />
                                        <div className="flex-1">
                                            <p className="text-xs font-medium text-foreground">Specific list</p>
                                            <p className="text-[10px] text-muted-foreground">Verify all leads with emails in a list</p>
                                        </div>
                                    </label>
                                    {verifyScope === "list" && (
                                        <select value={verifyListId} onChange={(e) => setVerifyListId(e.target.value)}
                                            className="ml-6 h-8 w-[calc(100%-1.5rem)] rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring/30">
                                            <option value="all">All Leads</option>
                                            {lists.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.leadCount})</option>)}
                                        </select>
                                    )}
                                    <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors">
                                        <input type="radio" name="verify-scope" value="all" checked={verifyScope === "all"} onChange={() => setVerifyScope("all")} className="w-3.5 h-3.5 text-primary" />
                                        <div>
                                            <p className="text-xs font-medium text-foreground">All leads with emails</p>
                                            <p className="text-[10px] text-muted-foreground">Re-verify every lead that has an email</p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Info */}
                            <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                                <p className="text-[10px] text-muted-foreground">
                                    <strong className="text-foreground">What this does:</strong> Connects to each domain&apos;s mail server (SMTP)
                                    to verify if the mailbox exists. Results: valid, invalid, or catch-all.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 px-6 py-3 border-t border-border">
                            <button onClick={() => setShowVerifyModal(false)} className="h-8 px-4 rounded-md border border-input text-xs font-medium hover:bg-muted transition-colors">Cancel</button>
                            <button onClick={startVerification} className="flex items-center gap-1.5 h-8 px-5 rounded-md bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 transition-colors">
                                <RiShieldCheckLine className="w-3.5 h-3.5" /> Start Verification
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════
                         FIND DOMAINS MODAL
               ═══════════════════════════════════════════ */}
            {showDomainModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in">
                    <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-scale">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <div>
                                <h2 className="text-sm font-semibold text-foreground">Find Domains</h2>
                                <p className="text-xs text-muted-foreground">Discover company websites from lead data</p>
                            </div>
                            <button onClick={() => setShowDomainModal(false)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-muted">
                                <RiCloseLine className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-foreground block mb-2">Target</label>
                                <div className="space-y-2">
                                    {selectedIds.size > 0 && (
                                        <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors">
                                            <input type="radio" name="domain-scope" value="selected" checked={domainScope === "selected"} onChange={() => setDomainScope("selected")} className="w-3.5 h-3.5 text-primary" />
                                            <div>
                                                <p className="text-xs font-medium text-foreground">Selected leads ({selectedIds.size})</p>
                                                <p className="text-[10px] text-muted-foreground">Find domains for selected leads&apos; companies</p>
                                            </div>
                                        </label>
                                    )}
                                    <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors">
                                        <input type="radio" name="domain-scope" value="list" checked={domainScope === "list"} onChange={() => setDomainScope("list")} className="w-3.5 h-3.5 text-primary" />
                                        <div className="flex-1">
                                            <p className="text-xs font-medium text-foreground">Specific list</p>
                                            <p className="text-[10px] text-muted-foreground">Find domains for all companies in a list</p>
                                        </div>
                                    </label>
                                    {domainScope === "list" && (
                                        <select value={domainListId} onChange={(e) => setDomainListId(e.target.value)}
                                            className="ml-6 h-8 w-[calc(100%-1.5rem)] rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring/30">
                                            <option value="all">All Leads</option>
                                            {lists.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.leadCount})</option>)}
                                        </select>
                                    )}
                                    <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors">
                                        <input type="radio" name="domain-scope" value="all" checked={domainScope === "all"} onChange={() => setDomainScope("all")} className="w-3.5 h-3.5 text-primary" />
                                        <div>
                                            <p className="text-xs font-medium text-foreground">All leads</p>
                                            <p className="text-[10px] text-muted-foreground">Find domains for every company</p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Options */}
                            <div>
                                <label className="text-xs font-semibold text-foreground block mb-2">Options</label>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors">
                                        <input type="checkbox" checked={domainRerun} onChange={(e) => setDomainRerun(e.target.checked)} className="w-3.5 h-3.5 text-primary rounded" />
                                        <div>
                                            <p className="text-xs font-medium text-foreground">Overwrite existing domains</p>
                                            <p className="text-[10px] text-muted-foreground">Force re-search for leads that already have a website</p>
                                        </div>
                                    </label>
                                    <label className={cn("flex items-center gap-2 p-2.5 rounded-lg border border-border transition-colors", hasApiKey ? "cursor-pointer hover:bg-muted/30" : "opacity-50 cursor-not-allowed")}>
                                        <input type="checkbox" checked={domainUseAi} onChange={(e) => setDomainUseAi(e.target.checked)} disabled={!hasApiKey} className="w-3.5 h-3.5 text-primary rounded" />
                                        <div>
                                            <p className="text-xs font-medium text-foreground">
                                                Use AI Fallback
                                                {!hasApiKey && <span className="text-red-500 font-normal ml-1">(Requires OpenAI Key in Settings)</span>}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">Ask AI to analyze search results for complex or challenging company names</p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/10">
                                <p className="text-[10px] text-muted-foreground">
                                    <strong className="text-foreground">How it works:</strong> Groups leads by company, then uses DNS probing + Google Search to find each company&apos;s
                                    website. High-confidence results are saved automatically. Low-confidence results are shown for manual review.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 px-6 py-3 border-t border-border">
                            <button onClick={() => setShowDomainModal(false)} className="h-8 px-4 rounded-md border border-input text-xs font-medium hover:bg-muted transition-colors">Cancel</button>
                            <button onClick={startDomainSearch} className="flex items-center gap-1.5 h-8 px-5 rounded-md bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 transition-colors">
                                <RiGlobalLine className="w-3.5 h-3.5" /> Start Finding Domains
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════
                         DOMAIN REVIEW MODAL
               ═══════════════════════════════════════════ */}
            {showReviewModal && reviewItems.length > 0 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in">
                    <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden animate-fade-in-scale">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <div>
                                <h2 className="text-sm font-semibold text-foreground">Review Domains</h2>
                                <p className="text-xs text-muted-foreground">{reviewItems.length} companies need manual review (low confidence)</p>
                            </div>
                            <button onClick={() => setShowReviewModal(false)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-muted">
                                <RiCloseLine className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto max-h-[55vh] space-y-2">
                            {reviewItems.map((item, i) => (
                                <div key={i} className="p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs font-semibold text-foreground">{item.company}</span>
                                        <span className="text-[10px] text-muted-foreground">({item.leadCount} leads)</span>
                                        {item.confidence > 0 && (
                                            <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded",
                                                item.confidence >= 50 ? "bg-amber-500/10 text-amber-500" : "bg-red-500/10 text-red-500"
                                            )}>{item.confidence}% confidence</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={reviewDomains[item.company] || ""}
                                            onChange={(e) => setReviewDomains((prev) => ({ ...prev, [item.company]: e.target.value }))}
                                            placeholder="Enter domain (e.g. company.com)"
                                            className="flex-1 h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring/30"
                                        />
                                    </div>
                                    {item.alternatives && item.alternatives.length > 0 && (
                                        <div className="flex items-center gap-1 mt-1.5">
                                            <span className="text-[10px] text-muted-foreground">Suggestions:</span>
                                            {item.alternatives.map((alt: string) => (
                                                <button
                                                    key={alt}
                                                    onClick={() => setReviewDomains((prev) => ({ ...prev, [item.company]: alt }))}
                                                    className="text-[10px] text-primary hover:underline cursor-pointer"
                                                >{alt}</button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-between items-center px-6 py-3 border-t border-border">
                            <button onClick={() => setShowReviewModal(false)} className="h-8 px-4 rounded-md border border-input text-xs font-medium hover:bg-muted transition-colors">Skip All</button>
                            <button onClick={saveReviewDomains} className="flex items-center gap-1.5 h-8 px-5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                                <RiCheckboxCircleLine className="w-3.5 h-3.5" /> Save Domains
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════
                         MOVE TO LIST MODAL
               ═══════════════════════════════════════════ */}
            {showMoveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in">
                    <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in-scale">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <div>
                                <h2 className="text-sm font-semibold text-foreground">Move to List</h2>
                                <p className="text-xs text-muted-foreground">{selectedIds.size} leads selected</p>
                            </div>
                            <button onClick={() => setShowMoveModal(false)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-muted">
                                <RiCloseLine className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-foreground block mb-2">Select List</label>
                                <select
                                    value={moveTargetList}
                                    onChange={(e) => setMoveTargetList(e.target.value)}
                                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring/30"
                                >
                                    <option value="">Choose a list...</option>
                                    {lists.map((l) => (
                                        <option key={l.id} value={l.id}>{l.name} ({l.leadCount})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="p-3 rounded-lg bg-muted/50 border border-border">
                                <p className="text-[10px] text-muted-foreground">
                                    Moves the selected leads to the chosen list. This updates their list assignment but keeps all other data (email, domain, status) intact.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 px-6 py-3 border-t border-border">
                            <button onClick={() => setShowMoveModal(false)} className="h-8 px-4 rounded-md border border-input text-xs font-medium hover:bg-muted transition-colors">Cancel</button>
                            <button onClick={moveToList} disabled={!moveTargetList || moving}
                                className="flex items-center gap-1.5 h-8 px-5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors">
                                {moving ? <RiLoader4Line className="w-3.5 h-3.5 animate-spin" /> : <RiArrowRightLine className="w-3.5 h-3.5" />}
                                {moving ? "Moving..." : "Move Leads"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
