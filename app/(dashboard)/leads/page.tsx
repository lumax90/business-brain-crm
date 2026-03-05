"use client";

import * as React from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { cn } from "@/lib/utils";
import {
    RiSearchLine,
    RiFilter3Line,
    RiAddLine,
    RiUpload2Line,
    RiCloseLine,
    RiCheckboxCircleLine,
    RiLoader4Line,
    RiArrowUpLine,
    RiArrowDownLine,
    RiDeleteBinLine,
    RiLinkedinBoxFill,
    RiMailLine,
    RiExternalLinkLine,
    RiArrowRightLine,
    RiFileListLine,
    RiListCheck,
    RiFolder3Line,
    RiFolderAddLine,
    RiSettings3Line,
    RiEyeLine,
    RiEyeOffLine,
    RiDraggable,
    RiArrowLeftSLine,
    RiArrowRightSLine,
    RiMoreLine,
    RiDownload2Line,
    RiCheckboxLine,
    RiCheckboxBlankLine,
    RiCheckboxIndeterminateLine,
    RiArrowGoForwardLine,
    RiAlertLine,
    RiErrorWarningLine,
    RiUserStarLine,
    RiEditLine,
} from "@remixicon/react";

import { API, apiFetch } from "@/lib/api";

// ─── Types ───
interface LeadRow {
    id: string;
    name: string | null;
    email: string | null;
    company: string | null;
    title: string | null;
    phone: string | null;
    linkedinUrl: string | null;
    location: string | null;
    website: string | null;
    status: string;
    source: string;
    score: number;
    tags: string[];
    customFields: Record<string, any>;
    notes: string | null;
    listId: string | null;
    createdAt: string;
    updatedAt: string;
}

interface LeadList {
    id: string;
    name: string;
    description: string | null;
    color: string;
    leadCount: number;
    createdAt: string;
}

interface ColumnDef {
    key: string;
    label: string;
    visible: boolean;
    width: number;
    isCustom: boolean;
    sortable: boolean;
}

const statusColors: Record<string, string> = {
    new: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    contacted: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    qualified: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    unqualified: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
    nurturing: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
    converted: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
};

const listColors = [
    "#6366f1", "#f43f5e", "#10b981", "#f59e0b", "#8b5cf6",
    "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#3b82f6",
];

const CORE_FIELD_OPTIONS = [
    { value: "name", label: "Name" },
    { value: "email", label: "Email" },
    { value: "company", label: "Company" },
    { value: "title", label: "Job Title" },
    { value: "phone", label: "Phone" },
    { value: "linkedinUrl", label: "LinkedIn URL" },
    { value: "location", label: "Location" },
    { value: "website", label: "Website" },
    { value: "status", label: "Status" },
    { value: "source", label: "Source" },
    { value: "score", label: "Score" },
    { value: "tags", label: "Tags" },
    { value: "notes", label: "Notes" },
];

function autoMapColumn(csvColumn: string): string {
    const col = csvColumn.toLowerCase().trim();
    const map: Record<string, string> = {
        name: "name", "full name": "name", "first name": "name", fullname: "name",
        email: "email", "email address": "email", e_mail: "email",
        company: "company", "company name": "company", organization: "company",
        title: "title", "job title": "title", position: "title", role: "title",
        phone: "phone", "phone number": "phone", telephone: "phone", mobile: "phone",
        linkedin: "linkedinUrl", "linkedin url": "linkedinUrl", linkedin_url: "linkedinUrl",
        linkedinurl: "linkedinUrl", "profile url": "linkedinUrl",
        location: "location", city: "location", country: "location",
        website: "website", url: "website", "company website": "website",
        status: "status", source: "source", score: "score", tags: "tags", notes: "notes",
    };
    return map[col] || `custom:${csvColumn}`;
}

const DEFAULT_COLUMNS: ColumnDef[] = [
    { key: "name", label: "Name", visible: true, width: 180, isCustom: false, sortable: true },
    { key: "email", label: "Email", visible: true, width: 200, isCustom: false, sortable: true },
    { key: "company", label: "Company", visible: true, width: 160, isCustom: false, sortable: true },
    { key: "title", label: "Title", visible: true, width: 160, isCustom: false, sortable: false },
    { key: "phone", label: "Phone", visible: false, width: 130, isCustom: false, sortable: false },
    { key: "location", label: "Location", visible: false, width: 140, isCustom: false, sortable: false },
    { key: "website", label: "Website", visible: false, width: 160, isCustom: false, sortable: false },
    { key: "status", label: "Status", visible: true, width: 100, isCustom: false, sortable: true },
    { key: "source", label: "Source", visible: true, width: 110, isCustom: false, sortable: false },
    { key: "score", label: "Score", visible: true, width: 70, isCustom: false, sortable: true },
];

function loadColumns(): ColumnDef[] {
    if (typeof window === "undefined") return DEFAULT_COLUMNS;
    try {
        const saved = localStorage.getItem("lead_columns");
        if (saved) return JSON.parse(saved);
    } catch { }
    return DEFAULT_COLUMNS;
}

function saveColumns(cols: ColumnDef[]) {
    if (typeof window === "undefined") return;
    localStorage.setItem("lead_columns", JSON.stringify(cols));
}

// ─── Pagination Helper ───
function getPageNumbers(current: number, total: number): (number | "...")[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | "...")[] = [];
    if (current <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push("...", total);
    } else if (current >= total - 3) {
        pages.push(1, "...");
        for (let i = total - 4; i <= total; i++) pages.push(i);
    } else {
        pages.push(1, "...", current - 1, current, current + 1, "...", total);
    }
    return pages;
}

export default function LeadsPage() {
    // ─── Data State ───
    const [leads, setLeads] = React.useState<LeadRow[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [total, setTotal] = React.useState(0);
    const [page, setPage] = React.useState(1);
    const [totalPages, setTotalPages] = React.useState(1);

    // ─── Filter State ───
    const [search, setSearch] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState("all");
    const [sourceFilter, setSourceFilter] = React.useState("all");
    const [scoreMin, setScoreMin] = React.useState("");
    const [scoreMax, setScoreMax] = React.useState("");
    const [showFilters, setShowFilters] = React.useState(false);
    const [sortField, setSortField] = React.useState("createdAt");
    const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");

    // ─── Lists State ───
    const [lists, setLists] = React.useState<LeadList[]>([]);
    const [activeList, setActiveList] = React.useState<string>("all");
    const [showNewList, setShowNewList] = React.useState(false);
    const [newListName, setNewListName] = React.useState("");
    const [newListColor, setNewListColor] = React.useState("#6366f1");

    // ─── Column State ───
    const [columns, setColumns] = React.useState<ColumnDef[]>(DEFAULT_COLUMNS);
    const [showColumnSettings, setShowColumnSettings] = React.useState(false);
    const [resizingCol, setResizingCol] = React.useState<string | null>(null);
    const resizeStart = React.useRef<{ x: number; w: number }>({ x: 0, w: 0 });

    // Load saved columns from localStorage after hydration
    React.useEffect(() => {
        try {
            const saved = localStorage.getItem("lead_columns");
            if (saved) {
                const parsed = JSON.parse(saved) as ColumnDef[];
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setColumns(parsed);
                }
            }
        } catch { }
    }, []);

    // ─── Import State ───
    const [importOpen, setImportOpen] = React.useState(false);
    const [importStep, setImportStep] = React.useState<1 | 2 | 3>(1);
    const [csvData, setCsvData] = React.useState<Record<string, any>[]>([]);
    const [csvColumns, setCsvColumns] = React.useState<string[]>([]);
    const [columnMapping, setColumnMapping] = React.useState<Record<string, string>>({});
    const [importing, setImporting] = React.useState(false);
    const [importResult, setImportResult] = React.useState<{ imported: number; total: number } | null>(null);
    const [importListId, setImportListId] = React.useState<string>("none");
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // ─── Add Lead State ───
    const [showAddLead, setShowAddLead] = React.useState(false);
    const [newLead, setNewLead] = React.useState<Record<string, string>>({});

    // ─── Edit Lead State ───
    const [showEditLead, setShowEditLead] = React.useState(false);
    const [editLeadData, setEditLeadData] = React.useState<Record<string, string>>({});
    const [editLeadId, setEditLeadId] = React.useState<string | null>(null);

    // ─── Selection State ───
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
    const [showBulkStatus, setShowBulkStatus] = React.useState(false);
    const [showBulkMove, setShowBulkMove] = React.useState(false);

    // ─── List Delete Confirmation ───
    const [deleteListTarget, setDeleteListTarget] = React.useState<LeadList | null>(null);

    // ─── Fetch Lists ───
    const fetchLists = React.useCallback(async () => {
        try {
            const res = await apiFetch(`${API}/api/lists`);
            const data = await res.json();
            if (data.success) setLists(data.lists);
        } catch (err) { console.error(err); }
    }, []);

    React.useEffect(() => { fetchLists(); }, [fetchLists]);

    // ─── Fetch Leads ───
    const fetchLeads = React.useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(page), limit: "50", sort: sortField, order: sortOrder,
            });
            if (search) params.set("search", search);
            if (statusFilter !== "all") params.set("status", statusFilter);
            if (sourceFilter !== "all") params.set("source", sourceFilter);
            if (activeList !== "all") params.set("listId", activeList);

            const res = await apiFetch(`${API}/api/leads?${params}`);
            const data = await res.json();

            if (data.success) {
                setLeads(data.leads);
                setTotal(data.pagination.total);
                setTotalPages(data.pagination.totalPages);

                // Discover custom field keys and add to columns if new
                const customKeys = new Set<string>();
                data.leads.forEach((lead: LeadRow) => {
                    if (lead.customFields) Object.keys(lead.customFields).forEach((k) => customKeys.add(k));
                });
                setColumns((prev) => {
                    const existing = new Set(prev.map((c) => c.key));
                    let updated = [...prev];
                    customKeys.forEach((key) => {
                        if (!existing.has(key)) {
                            updated.push({ key, label: key, visible: true, width: 130, isCustom: true, sortable: false });
                        }
                    });
                    if (updated.length !== prev.length) saveColumns(updated);
                    return updated;
                });
            }
        } catch (err) {
            console.error("Fetch leads error:", err);
        } finally {
            setLoading(false);
        }
    }, [page, search, statusFilter, sourceFilter, sortField, sortOrder, activeList]);

    React.useEffect(() => { fetchLeads(); }, [fetchLeads]);

    // ─── Debounced Search ───
    const searchTimeout = React.useRef<NodeJS.Timeout>(null);
    const handleSearchChange = (value: string) => {
        setSearch(value);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => setPage(1), 300);
    };

    // ─── Sort ───
    const toggleSort = (field: string) => {
        if (sortField === field) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        else { setSortField(field); setSortOrder("desc"); }
        setPage(1);
    };

    // ─── Column Helpers ───
    const visibleColumns = columns.filter((c) => c.visible);

    const toggleColumnVisibility = (key: string) => {
        setColumns((prev) => {
            const updated = prev.map((c) => c.key === key ? { ...c, visible: !c.visible } : c);
            saveColumns(updated);
            return updated;
        });
    };

    const moveColumn = (key: string, direction: -1 | 1) => {
        setColumns((prev) => {
            const idx = prev.findIndex((c) => c.key === key);
            if (idx < 0) return prev;
            const newIdx = idx + direction;
            if (newIdx < 0 || newIdx >= prev.length) return prev;
            const updated = [...prev];
            [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
            saveColumns(updated);
            return updated;
        });
    };

    // ─── Column Resize ───
    const handleResizeStart = (key: string, e: React.MouseEvent) => {
        e.preventDefault();
        const col = columns.find((c) => c.key === key);
        if (!col) return;
        setResizingCol(key);
        resizeStart.current = { x: e.clientX, w: col.width };

        const handleMove = (me: MouseEvent) => {
            const delta = me.clientX - resizeStart.current.x;
            setColumns((prev) => prev.map((c) => c.key === key ? { ...c, width: Math.max(60, resizeStart.current.w + delta) } : c));
        };
        const handleUp = () => {
            document.removeEventListener("mousemove", handleMove);
            document.removeEventListener("mouseup", handleUp);
            setResizingCol(null);
            setColumns((prev) => { saveColumns(prev); return prev; });
        };
        document.addEventListener("mousemove", handleMove);
        document.addEventListener("mouseup", handleUp);
    };

    // ─── Create List ───
    const createList = async () => {
        if (!newListName.trim()) return;
        try {
            await apiFetch(`${API}/api/lists`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newListName.trim(), color: newListColor }),
            });
            setNewListName("");
            setShowNewList(false);
            fetchLists();
            toast.success(`List "${newListName.trim()}" created`);
        } catch (err) { console.error(err); toast.error("Failed to create list"); }
    };

    const confirmDeleteList = async () => {
        if (!deleteListTarget) return;
        try {
            await apiFetch(`${API}/api/lists/${deleteListTarget.id}`, { method: "DELETE" });
            if (activeList === deleteListTarget.id) setActiveList("all");
            setDeleteListTarget(null);
            fetchLists();
            fetchLeads();
            toast.success("List deleted");
        } catch (err) { console.error(err); toast.error("Failed to delete list"); }
    };

    // ─── Selection Helpers ───
    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === leads.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(leads.map((l) => l.id)));
    };

    const clearSelection = () => setSelectedIds(new Set());

    // ─── Bulk Operations ───
    const bulkDelete = async () => {
        if (selectedIds.size === 0) return;
        try {
            await apiFetch(`${API}/api/leads/bulk-delete`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: Array.from(selectedIds) }),
            });
            clearSelection();
            fetchLeads();
            fetchLists();
            toast.success(`${selectedIds.size} leads deleted`);
        } catch (err) { console.error(err); toast.error("Failed to delete leads"); }
    };

    const bulkMove = async (listId: string | null) => {
        if (selectedIds.size === 0) return;
        try {
            await apiFetch(`${API}/api/leads/bulk-move`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: Array.from(selectedIds), listId }),
            });
            clearSelection();
            setShowBulkMove(false);
            fetchLeads();
            fetchLists();
            toast.success(`${selectedIds.size} leads moved`);
        } catch (err) { console.error(err); toast.error("Failed to move leads"); }
    };

    const bulkStatus = async (status: string) => {
        if (selectedIds.size === 0) return;
        try {
            await apiFetch(`${API}/api/leads/bulk-status`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: Array.from(selectedIds), status }),
            });
            clearSelection();
            setShowBulkStatus(false);
            fetchLeads();
            toast.success(`Status updated for ${selectedIds.size} leads`);
        } catch (err) { console.error(err); toast.error("Failed to update status"); }
    };

    // ─── Export ───
    const exportSelected = () => {
        const toExport = selectedIds.size > 0
            ? leads.filter((l) => selectedIds.has(l.id))
            : leads;
        const rows = toExport.map((lead) => {
            const row: Record<string, any> = {};
            visibleColumns.forEach((col) => {
                if (col.isCustom) row[col.label] = lead.customFields?.[col.key] || "";
                else row[col.label] = (lead as any)[col.key] || "";
            });
            return row;
        });
        const csv = Papa.unparse(rows);
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Exported ${toExport.length} leads`);
    };



    // ─── File Upload ───
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const ext = file.name.split(".").pop()?.toLowerCase();

        if (ext === "csv") {
            Papa.parse(file, {
                header: true, skipEmptyLines: true,
                complete: (result) => {
                    const data = result.data as Record<string, any>[];
                    if (data.length > 0) {
                        const cols = Object.keys(data[0]);
                        setCsvData(data);
                        setCsvColumns(cols);
                        const mapping: Record<string, string> = {};
                        cols.forEach((col) => { mapping[col] = autoMapColumn(col); });
                        setColumnMapping(mapping);
                        setImportStep(2);
                    }
                },
            });
        } else if (ext === "json") {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    let parsed = JSON.parse(event.target?.result as string);
                    if (!Array.isArray(parsed)) parsed = [parsed];
                    if (parsed.length > 0) {
                        const cols = [...new Set(parsed.flatMap((row: any) => Object.keys(row)))] as string[];
                        setCsvData(parsed);
                        setCsvColumns(cols);
                        const mapping: Record<string, string> = {};
                        cols.forEach((col) => { mapping[col] = autoMapColumn(col); });
                        setColumnMapping(mapping);
                        setImportStep(2);
                    }
                } catch { }
            };
            reader.readAsText(file);
        }
    };

    const executeImport = async () => {
        setImporting(true);
        try {
            const body: any = { leads: csvData, mapping: columnMapping };
            if (importListId !== "none") body.listId = importListId;
            const res = await apiFetch(`${API}/api/leads/import`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.success) {
                setImportResult({ imported: data.imported, total: data.total });
                setImportStep(3);
                fetchLeads();
                fetchLists();
                toast.success(`${data.imported} leads imported successfully`);
            }
        } catch (err) { console.error(err); toast.error("Import failed"); }
        finally { setImporting(false); }
    };

    const closeImport = () => {
        setImportOpen(false); setImportStep(1); setCsvData([]); setCsvColumns([]);
        setColumnMapping({}); setImportResult(null); setImportListId("none");
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // ─── Add Lead ───
    const handleAddLead = async () => {
        try {
            const body: any = { ...newLead };
            if (activeList !== "all") body.listId = activeList;
            await apiFetch(`${API}/api/leads`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
            });
            setShowAddLead(false);
            setNewLead({});
            fetchLeads();
            toast.success("Lead created");
        } catch (err) { console.error(err); toast.error("Failed to create lead"); }
    };

    // ─── Edit Lead ───
    const handleEditLead = async () => {
        if (!editLeadId) return;
        try {
            await apiFetch(`${API}/api/leads/${editLeadId}`, {
                method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editLeadData),
            });
            setShowEditLead(false);
            setEditLeadData({});
            setEditLeadId(null);
            fetchLeads();
            toast.success("Lead updated");
        } catch (err) { console.error(err); toast.error("Failed to update lead"); }
    };

    // ─── Delete Lead ───
    const deleteLead = async (id: string) => {
        try { await apiFetch(`${API}/api/leads/${id}`, { method: "DELETE" }); fetchLeads(); toast.success("Lead deleted"); } catch { toast.error("Failed to delete lead"); }
    };

    // ─── Convert Lead to Contact ───
    const convertLead = async (id: string) => {
        try {
            const res = await apiFetch(`${API}/api/leads/${id}/convert`, { method: "POST" });
            const data = await res.json();
            if (data.success) {
                alert(`✅ ${data.message}`);
                fetchLeads();
            } else {
                alert(`❌ Conversion failed: ${data.error}`);
            }
        } catch (err) { console.error(err); alert("Conversion failed"); }
    };

    // ─── Active Filter Count ───
    const activeFilterCount = [statusFilter !== "all", sourceFilter !== "all", !!scoreMin, !!scoreMax]
        .filter(Boolean).length;

    // ─── Cell Renderer ───
    const renderCell = (lead: LeadRow, col: ColumnDef) => {
        const key = col.key;

        if (col.isCustom) {
            return (
                <span className="text-xs text-muted-foreground truncate block">
                    {lead.customFields?.[key] ? String(lead.customFields[key]) : "—"}
                </span>
            );
        }

        switch (key) {
            case "name":
                return (
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                            {(lead.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-foreground truncate">{lead.name || "—"}</span>
                    </div>
                );
            case "email":
                return lead.email ? (
                    <a href={`mailto:${lead.email}`} className="text-xs font-mono text-foreground/80 hover:text-primary truncate block">
                        {lead.email}
                    </a>
                ) : <span className="text-xs text-muted-foreground/40">—</span>;
            case "status":
                return (
                    <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full capitalize", statusColors[lead.status] || "bg-muted text-muted-foreground")}>
                        {lead.status}
                    </span>
                );
            case "source":
                return <span className="text-xs text-muted-foreground capitalize">{lead.source?.replace(/_/g, " ") || "—"}</span>;
            case "score":
                return lead.score > 0 ? (
                    <span className={cn("text-xs font-semibold", lead.score >= 80 ? "text-emerald-600 dark:text-emerald-400" : lead.score >= 50 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                        {lead.score}
                    </span>
                ) : <span className="text-xs text-muted-foreground/40">—</span>;
            default: {
                const val = (lead as any)[key];
                if (key === "linkedinUrl" && val) {
                    return (
                        <a href={val} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-500 hover:underline">
                            <RiLinkedinBoxFill className="w-3 h-3" />Profile
                        </a>
                    );
                }
                return <span className="text-xs text-muted-foreground truncate block">{val || "—"}</span>;
            }
        }
    };

    // ─── Page Numbers ───
    const pageNumbers = getPageNumbers(page, totalPages);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <AppHeader title="Leads" subtitle={`${total.toLocaleString()} leads`} />
            <div className="flex flex-1 overflow-hidden">
                {/* ─── Lists Sidebar ─── */}
                <div className="w-56 shrink-0 border-r border-border bg-card/50 p-3 overflow-y-auto hidden md:block animate-fade-in">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Lists</span>
                        <button onClick={() => setShowNewList(true)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                            <RiFolderAddLine className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* All Leads */}
                    <button
                        onClick={() => { setActiveList("all"); setPage(1); }}
                        className={cn("w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors mb-1", activeList === "all" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                    >
                        <RiListCheck className="w-3.5 h-3.5" />
                        <span className="flex-1 text-left">All Leads</span>
                        <span className="text-[10px] opacity-60">{total}</span>
                    </button>

                    {/* List Items */}
                    {lists.map((list) => (
                        <div key={list.id} className="group flex items-center gap-1 mb-0.5">
                            <button
                                onClick={() => { setActiveList(list.id); setPage(1); }}
                                className={cn("flex-1 flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors", activeList === list.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                            >
                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: list.color }} />
                                <span className="flex-1 text-left truncate">{list.name}</span>
                                <span className="text-[10px] opacity-60">{list.leadCount}</span>
                            </button>
                            <button onClick={() => setDeleteListTarget(list)} className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                                <RiDeleteBinLine className="w-3 h-3" />
                            </button>
                        </div>
                    ))}

                    {/* New List Form */}
                    {showNewList && (
                        <div className="mt-2 p-2 rounded-lg border border-border bg-card space-y-2 animate-fade-in-scale">
                            <input value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="List name..." autoFocus
                                className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring/30"
                                onKeyDown={(e) => e.key === "Enter" && createList()} />
                            <div className="flex items-center gap-1">
                                {listColors.map((c) => (
                                    <button key={c} onClick={() => setNewListColor(c)} className={cn("w-4 h-4 rounded-full transition-transform", newListColor === c && "ring-2 ring-offset-1 ring-primary scale-110")} style={{ backgroundColor: c }} />
                                ))}
                            </div>
                            <div className="flex gap-1.5">
                                <button onClick={() => setShowNewList(false)} className="flex-1 h-6 text-[10px] rounded border border-input hover:bg-muted">Cancel</button>
                                <button onClick={createList} className="flex-1 h-6 text-[10px] rounded bg-primary text-primary-foreground hover:bg-primary/90">Create</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ─── Main Content ─── */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Toolbar */}
                    <div className="px-4 py-3 border-b border-border flex flex-col sm:flex-row items-start sm:items-center gap-2.5 animate-fade-in">
                        <div className="relative flex-1 w-full sm:max-w-xs">
                            <RiSearchLine className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Search leads..."
                                className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all" />
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button onClick={() => setShowFilters(!showFilters)}
                                className={cn("flex items-center gap-1 h-8 px-2.5 rounded-md border border-input text-xs font-medium transition-colors", showFilters ? "bg-primary/10 text-primary border-primary/30" : "hover:bg-muted")}>
                                <RiFilter3Line className="w-3.5 h-3.5" />
                                Filters
                                {activeFilterCount > 0 && <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center">{activeFilterCount}</span>}
                            </button>
                            <button onClick={() => setShowColumnSettings(!showColumnSettings)}
                                className={cn("flex items-center gap-1 h-8 px-2.5 rounded-md border border-input text-xs font-medium transition-colors", showColumnSettings ? "bg-primary/10 text-primary border-primary/30" : "hover:bg-muted")}>
                                <RiSettings3Line className="w-3.5 h-3.5" />
                                Columns
                            </button>
                            <button onClick={() => setShowAddLead(true)} className="flex items-center gap-1 h-8 px-2.5 rounded-md border border-input text-xs font-medium hover:bg-muted transition-colors">
                                <RiAddLine className="w-3.5 h-3.5" />
                                Add Lead
                            </button>
                            <button onClick={() => setImportOpen(true)} className="flex items-center gap-1 h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                                <RiUpload2Line className="w-3.5 h-3.5" />
                                Import
                            </button>

                        </div>
                    </div>

                    {/* Filter Bar */}
                    {showFilters && (
                        <div className="px-4 py-2.5 border-b border-border bg-muted/20 flex items-center gap-2.5 flex-wrap animate-fade-in">
                            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                                className="h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring/30">
                                <option value="all">All Statuses</option>
                                <option value="new">New</option><option value="contacted">Contacted</option>
                                <option value="qualified">Qualified</option><option value="unqualified">Unqualified</option>
                                <option value="nurturing">Nurturing</option><option value="converted">Converted</option>
                            </select>
                            <select value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
                                className="h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring/30">
                                <option value="all">All Sources</option>
                                <option value="csv_import">CSV Import</option><option value="manual">Manual</option>
                                <option value="lead_engine">Lead Engine</option><option value="linkedin">LinkedIn</option>
                            </select>
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] text-muted-foreground">Score:</span>
                                <input value={scoreMin} onChange={(e) => setScoreMin(e.target.value)} placeholder="Min" type="number"
                                    className="h-7 w-14 rounded-md border border-input bg-background px-1.5 text-xs text-center focus:outline-none focus:ring-2 focus:ring-ring/30" />
                                <span className="text-[10px] text-muted-foreground">-</span>
                                <input value={scoreMax} onChange={(e) => setScoreMax(e.target.value)} placeholder="Max" type="number"
                                    className="h-7 w-14 rounded-md border border-input bg-background px-1.5 text-xs text-center focus:outline-none focus:ring-2 focus:ring-ring/30" />
                            </div>
                            {activeFilterCount > 0 && (
                                <button onClick={() => { setStatusFilter("all"); setSourceFilter("all"); setScoreMin(""); setScoreMax(""); setPage(1); }}
                                    className="text-[10px] text-muted-foreground hover:text-foreground ml-auto">
                                    Clear all
                                </button>
                            )}
                        </div>
                    )}

                    {/* Column Settings Panel */}
                    {showColumnSettings && (
                        <div className="px-4 py-2.5 border-b border-border bg-muted/20 animate-fade-in">
                            <div className="flex items-center gap-1 flex-wrap">
                                {columns.map((col) => (
                                    <div key={col.key} className="flex items-center gap-1">
                                        <button onClick={() => toggleColumnVisibility(col.key)}
                                            className={cn("flex items-center gap-1 h-6 px-2 rounded text-[10px] font-medium border transition-colors",
                                                col.visible ? "border-primary/30 bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted")}>
                                            {col.visible ? <RiEyeLine className="w-2.5 h-2.5" /> : <RiEyeOffLine className="w-2.5 h-2.5" />}
                                            {col.label}
                                        </button>
                                        {col.visible && (
                                            <div className="flex">
                                                <button onClick={() => moveColumn(col.key, -1)} className="w-4 h-4 rounded flex items-center justify-center text-muted-foreground hover:text-foreground">
                                                    <RiArrowLeftSLine className="w-3 h-3" />
                                                </button>
                                                <button onClick={() => moveColumn(col.key, 1)} className="w-4 h-4 rounded flex items-center justify-center text-muted-foreground hover:text-foreground">
                                                    <RiArrowRightSLine className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Bulk Actions Bar */}
                    {selectedIds.size > 0 && (
                        <div className="px-4 py-2 border-b border-border bg-primary/5 flex items-center gap-2 animate-fade-in">
                            <span className="text-xs font-semibold text-primary">{selectedIds.size} selected</span>
                            <div className="w-px h-4 bg-border" />
                            <button onClick={bulkDelete} className="flex items-center gap-1 h-6 px-2.5 rounded text-[10px] font-medium text-destructive hover:bg-destructive/10 border border-destructive/20 transition-colors">
                                <RiDeleteBinLine className="w-3 h-3" /> Delete
                            </button>
                            <button onClick={exportSelected} className="flex items-center gap-1 h-6 px-2.5 rounded text-[10px] font-medium text-foreground hover:bg-muted border border-input transition-colors">
                                <RiDownload2Line className="w-3 h-3" /> Export CSV
                            </button>
                            <div className="relative">
                                <button onClick={() => setShowBulkMove(!showBulkMove)} className="flex items-center gap-1 h-6 px-2.5 rounded text-[10px] font-medium text-foreground hover:bg-muted border border-input transition-colors">
                                    <RiArrowGoForwardLine className="w-3 h-3" /> Move to List
                                </button>
                                {showBulkMove && (
                                    <div className="absolute top-7 left-0 z-30 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[160px] animate-fade-in-scale">
                                        <button onClick={() => bulkMove(null)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors">No list (unassign)</button>
                                        {lists.map((l) => (
                                            <button key={l.id} onClick={() => bulkMove(l.id)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                                                {l.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="relative">
                                <button onClick={() => setShowBulkStatus(!showBulkStatus)} className="flex items-center gap-1 h-6 px-2.5 rounded text-[10px] font-medium text-foreground hover:bg-muted border border-input transition-colors">
                                    <RiCheckboxCircleLine className="w-3 h-3" /> Change Status
                                </button>
                                {showBulkStatus && (
                                    <div className="absolute top-7 left-0 z-30 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[140px] animate-fade-in-scale">
                                        {["new", "contacted", "qualified", "unqualified", "nurturing", "converted"].map((s) => (
                                            <button key={s} onClick={() => bulkStatus(s)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors capitalize">{s}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button onClick={clearSelection} className="ml-auto text-[10px] text-muted-foreground hover:text-foreground">Clear selection</button>
                        </div>
                    )}

                    {/* Table */}
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 z-10">
                                <tr className="border-b border-border bg-card">
                                    {/* Select All Checkbox */}
                                    <th className="w-10 py-2.5 px-3">
                                        <button onClick={toggleSelectAll} className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground">
                                            {selectedIds.size === 0 ? <RiCheckboxBlankLine className="w-4 h-4" /> :
                                                selectedIds.size === leads.length ? <RiCheckboxLine className="w-4 h-4 text-primary" /> :
                                                    <RiCheckboxIndeterminateLine className="w-4 h-4 text-primary" />}
                                        </button>
                                    </th>
                                    {visibleColumns.map((col) => (
                                        <th key={col.key} style={{ width: col.width, minWidth: col.width }} className="text-left py-2.5 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider relative select-none group">
                                            <div className="flex items-center gap-1" onClick={() => col.sortable ? toggleSort(col.key) : null}
                                                style={{ cursor: col.sortable ? "pointer" : "default" }}>
                                                {col.label}
                                                {sortField === col.key && (sortOrder === "asc" ? <RiArrowUpLine className="w-2.5 h-2.5" /> : <RiArrowDownLine className="w-2.5 h-2.5" />)}
                                            </div>
                                            {/* Resize handle */}
                                            <div onMouseDown={(e) => handleResizeStart(col.key, e)}
                                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-primary/30 transition-opacity" />
                                        </th>
                                    ))}
                                    <th className="text-right py-2.5 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-16">
                                        <RiMoreLine className="w-3 h-3 ml-auto" />
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={visibleColumns.length + 2} className="text-center py-20">
                                        <RiLoader4Line className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                                        <p className="text-xs text-muted-foreground mt-2">Loading leads...</p>
                                    </td></tr>
                                ) : leads.length === 0 ? (
                                    <tr><td colSpan={visibleColumns.length + 2} className="text-center py-20">
                                        <RiFileListLine className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                                        <p className="text-sm font-medium text-muted-foreground">No leads yet</p>
                                        <p className="text-xs text-muted-foreground/60 mt-1">Import a CSV/JSON file or add leads manually</p>
                                        <button onClick={() => setImportOpen(true)} className="mt-3 flex items-center gap-1 h-7 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 mx-auto">
                                            <RiUpload2Line className="w-3 h-3" /> Import
                                        </button>
                                    </td></tr>
                                ) : (
                                    leads.map((lead, i) => (
                                        <tr key={lead.id} className={cn("border-b border-border/40 hover:bg-muted/30 transition-colors", selectedIds.has(lead.id) && "bg-primary/5")} style={{ animationDelay: `${i * 0.01}s` }}>
                                            {/* Checkbox */}
                                            <td className="w-10 py-2 px-3">
                                                <button onClick={() => toggleSelect(lead.id)} className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground">
                                                    {selectedIds.has(lead.id) ? <RiCheckboxLine className="w-4 h-4 text-primary" /> : <RiCheckboxBlankLine className="w-4 h-4" />}
                                                </button>
                                            </td>
                                            {visibleColumns.map((col) => (
                                                <td key={col.key} style={{ width: col.width, minWidth: col.width, maxWidth: col.width }} className="py-2 px-3 overflow-hidden">
                                                    {renderCell(lead, col)}
                                                </td>
                                            ))}
                                            <td className="py-2 px-3 text-right w-24">
                                                <div className="flex items-center justify-end gap-1">
                                                    {lead.status !== "converted" && (
                                                        <button onClick={() => convertLead(lead.id)} className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors" title="Convert to CRM Contact">
                                                            <RiUserStarLine className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                    <button onClick={() => { setEditLeadId(lead.id); setEditLeadData(Object.fromEntries(Object.entries(lead).filter(([_, v]) => typeof v === 'string' || typeof v === 'number').map(([k, v]) => [k, String(v)]))); setShowEditLead(true); }} className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 transition-colors" title="Edit Lead">
                                                        <RiEditLine className="w-3 h-3" />
                                                    </button>
                                                    <button onClick={() => deleteLead(lead.id)} className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Delete Lead">
                                                        <RiDeleteBinLine className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* ─── Pagination ─── */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-card shrink-0">
                            <p className="text-[10px] text-muted-foreground">
                                {((page - 1) * 50) + 1}–{Math.min(page * 50, total)} of {total.toLocaleString()}
                            </p>
                            <div className="flex items-center gap-0.5">
                                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}
                                    className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground disabled:opacity-30 hover:bg-muted transition-colors">
                                    <RiArrowLeftSLine className="w-4 h-4" />
                                </button>
                                {pageNumbers.map((p, i) =>
                                    p === "..." ? (
                                        <span key={`dots-${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-muted-foreground">…</span>
                                    ) : (
                                        <button key={p} onClick={() => setPage(p as number)}
                                            className={cn("w-7 h-7 rounded text-xs font-medium transition-colors",
                                                page === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                                            {p}
                                        </button>
                                    )
                                )}
                                <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
                                    className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground disabled:opacity-30 hover:bg-muted transition-colors">
                                    <RiArrowRightSLine className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Import Modal ─── */}
            {importOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in">
                    <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden animate-fade-in-scale">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <div>
                                <h2 className="text-sm font-semibold text-foreground">Import Leads</h2>
                                <p className="text-xs text-muted-foreground">
                                    {importStep === 1 && "Upload a CSV or JSON file"}
                                    {importStep === 2 && `Map ${csvColumns.length} columns · ${csvData.length.toLocaleString()} rows`}
                                    {importStep === 3 && "Import complete"}
                                </p>
                            </div>
                            <button onClick={closeImport} className="w-7 h-7 rounded flex items-center justify-center hover:bg-muted"><RiCloseLine className="w-4 h-4" /></button>
                        </div>

                        {importStep === 1 && (
                            <div className="p-6">
                                <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-12 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all">
                                    <RiUpload2Line className="w-8 h-8 text-muted-foreground/40 mb-3" />
                                    <p className="text-sm font-medium text-foreground mb-1">Drop file or click to browse</p>
                                    <p className="text-xs text-muted-foreground">CSV and JSON supported</p>
                                    <input ref={fileInputRef} type="file" accept=".csv,.json" onChange={handleFileUpload} className="hidden" />
                                </label>
                            </div>
                        )}

                        {importStep === 2 && (
                            <div className="p-6 overflow-y-auto max-h-[55vh]">
                                {/* Target List */}
                                <div className="mb-4">
                                    <label className="text-xs font-semibold text-foreground mb-1 block">Assign to List</label>
                                    <select value={importListId} onChange={(e) => setImportListId(e.target.value)}
                                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring/30">
                                        <option value="none">No list (All Leads)</option>
                                        {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                                    </select>
                                </div>

                                {/* Preview */}
                                <p className="text-xs font-semibold text-foreground mb-1.5">Preview (first 3 rows)</p>
                                <div className="overflow-x-auto rounded-lg border border-border mb-4">
                                    <table className="w-full text-[10px]">
                                        <thead><tr className="bg-muted/30 border-b border-border">
                                            {csvColumns.map((col) => <th key={col} className="text-left py-1.5 px-2 font-semibold text-muted-foreground whitespace-nowrap">{col}</th>)}
                                        </tr></thead>
                                        <tbody>
                                            {csvData.slice(0, 3).map((row, i) => (
                                                <tr key={i} className="border-b border-border/50">
                                                    {csvColumns.map((col) => <td key={col} className="py-1 px-2 text-muted-foreground whitespace-nowrap max-w-[120px] truncate">{row[col] ?? "—"}</td>)}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <p className="text-xs font-semibold text-foreground mb-1.5">Column Mapping</p>
                                <div className="space-y-1.5">
                                    {csvColumns.map((col) => (
                                        <div key={col} className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                                            <span className="text-xs font-medium text-foreground w-1/3 truncate">{col}</span>
                                            <RiArrowRightLine className="w-3 h-3 text-muted-foreground shrink-0" />
                                            <select value={columnMapping[col] || "skip"} onChange={(e) => setColumnMapping((prev) => ({ ...prev, [col]: e.target.value }))}
                                                className="flex-1 h-6 rounded-md border border-input bg-background px-1.5 text-[10px] focus:outline-none focus:ring-2 focus:ring-ring/30">
                                                <optgroup label="Core Fields">
                                                    {CORE_FIELD_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                </optgroup>
                                                <optgroup label="Other">
                                                    <option value={`custom:${col}`}>➕ Custom: {col}</option>
                                                    <option value="skip">⏭ Skip</option>
                                                </optgroup>
                                            </select>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border">
                                    <button onClick={() => setImportStep(1)} className="h-7 px-3 rounded-md border border-input text-xs hover:bg-muted">Back</button>
                                    <button onClick={executeImport} disabled={importing}
                                        className={cn("flex items-center gap-1 h-7 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium", importing ? "opacity-50" : "hover:bg-primary/90")}>
                                        {importing ? <><RiLoader4Line className="w-3 h-3 animate-spin" />Importing...</> : <><RiCheckboxCircleLine className="w-3 h-3" />Import {csvData.length.toLocaleString()}</>}
                                    </button>
                                </div>
                            </div>
                        )}

                        {importStep === 3 && importResult && (
                            <div className="p-6 text-center">
                                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                                    <RiCheckboxCircleLine className="w-6 h-6 text-emerald-500" />
                                </div>
                                <h3 className="text-sm font-semibold mb-1">Import Complete</h3>
                                <p className="text-xs text-muted-foreground mb-4">{importResult.imported.toLocaleString()} leads imported · {importResult.total.toLocaleString()} total</p>
                                <button onClick={closeImport} className="h-7 px-5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90">Done</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ─── Add Lead Modal ─── */}
            {showAddLead && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in">
                    <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-scale">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <h2 className="text-sm font-semibold text-foreground">Add Lead</h2>
                            <button onClick={() => { setShowAddLead(false); setNewLead({}); }} className="w-7 h-7 rounded flex items-center justify-center hover:bg-muted"><RiCloseLine className="w-4 h-4" /></button>
                        </div>
                        <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
                            {columns.filter((c) => !c.isCustom && c.key !== "score").map((col) => (
                                <div key={col.key} className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">{col.label}</label>
                                    {col.key === "status" ? (
                                        <select value={newLead[col.key] || "new"} onChange={(e) => setNewLead({ ...newLead, [col.key]: e.target.value })}
                                            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                                            <option value="new">New</option><option value="contacted">Contacted</option>
                                            <option value="qualified">Qualified</option><option value="unqualified">Unqualified</option>
                                            <option value="nurturing">Nurturing</option>
                                        </select>
                                    ) : (
                                        <input value={newLead[col.key] || ""} onChange={(e) => setNewLead({ ...newLead, [col.key]: e.target.value })}
                                            placeholder={`Enter ${col.label.toLowerCase()}`}
                                            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30" />
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end gap-2 px-6 py-3 border-t border-border">
                            <button onClick={() => { setShowAddLead(false); setNewLead({}); }} className="h-7 px-3 rounded-md border border-input text-xs hover:bg-muted">Cancel</button>
                            <button onClick={handleAddLead} className="h-7 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90">
                                <RiAddLine className="w-3 h-3 inline mr-1" />Add Lead
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showEditLead && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in">
                    <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-scale">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <h2 className="text-sm font-semibold text-foreground">Edit Lead</h2>
                            <button onClick={() => { setShowEditLead(false); setEditLeadData({}); setEditLeadId(null); }} className="w-7 h-7 rounded flex items-center justify-center hover:bg-muted"><RiCloseLine className="w-4 h-4" /></button>
                        </div>
                        <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
                            {columns.filter((c) => !c.isCustom && c.key !== "score").map((col) => (
                                <div key={col.key} className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">{col.label}</label>
                                    {col.key === "status" ? (
                                        <select value={editLeadData[col.key] || "new"} onChange={(e) => setEditLeadData({ ...editLeadData, [col.key]: e.target.value })}
                                            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                                            <option value="new">New</option><option value="contacted">Contacted</option>
                                            <option value="qualified">Qualified</option><option value="unqualified">Unqualified</option>
                                            <option value="nurturing">Nurturing</option><option value="converted">Converted</option>
                                        </select>
                                    ) : (
                                        <input value={editLeadData[col.key] || ""} onChange={(e) => setEditLeadData({ ...editLeadData, [col.key]: e.target.value })}
                                            placeholder={`Enter ${col.label.toLowerCase()}`}
                                            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30" />
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end gap-2 px-6 py-3 border-t border-border">
                            <button onClick={() => { setShowEditLead(false); setEditLeadData({}); setEditLeadId(null); }} className="h-7 px-3 rounded-md border border-input text-xs hover:bg-muted">Cancel</button>
                            <button onClick={handleEditLead} className="h-7 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90">
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── List Delete Confirmation ─── */}
            {deleteListTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in">
                    <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in-scale">
                        <div className="p-6 text-center">
                            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
                                <RiErrorWarningLine className="w-6 h-6 text-amber-500" />
                            </div>
                            <h3 className="text-sm font-semibold text-foreground mb-1">Delete &quot;{deleteListTarget.name}&quot;?</h3>
                            <p className="text-xs text-muted-foreground mb-5">
                                Are you sure you want to delete this list? The leads inside will not be deleted.
                            </p>
                            <div className="space-y-2 flex gap-2">
                                <button onClick={() => setDeleteListTarget(null)}
                                    className="flex-1 h-9 rounded-md border border-input text-xs font-medium hover:bg-muted transition-colors">
                                    Cancel
                                </button>
                                <button onClick={() => confirmDeleteList()}
                                    className="flex-1 h-9 rounded-md border border-destructive/30 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors">
                                    Delete List
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
