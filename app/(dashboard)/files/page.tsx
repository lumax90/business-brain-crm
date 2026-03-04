"use client";

import * as React from "react";
import { AppHeader } from "@/components/app-header";
import { cn } from "@/lib/utils";
import {
    RiLoader4Line,
    RiCloseLine,
    RiDeleteBinLine,
    RiSearchLine,
    RiUpload2Line,
    RiFileTextLine,
    RiImageLine,
    RiFilePdf2Line,
    RiFileExcel2Line,
    RiFileWord2Line,
    RiFileZipLine,
    RiVideoLine,
    RiMusic2Line,
    RiFile3Line,
    RiDownload2Line,
    RiEyeLine,
    RiLink,
    RiLinkUnlink,
    RiEdit2Line,
    RiGridLine,
    RiListUnordered,
    RiFolder3Line,
    RiFolder2Line,
    RiFolderLine,
    RiCheckLine,
    RiArrowUpLine,
    RiArrowDownLine,
    RiUserSearchLine,
    RiTeamLine,
    RiBuilding2Line,
    RiFlowChart,
    RiFileList3Line,
    RiMoneyDollarCircleLine,
    RiPriceTag3Line,
    RiMegaphoneLine,
    RiProjector2Line,
    RiInbox2Line,
} from "@remixicon/react";

import { API, apiFetch } from "@/lib/api";
import { toast } from "sonner";

// ── Types ──
interface FileItem {
    id: string;
    name: string;
    originalName: string;
    mimeType: string;
    size: number;
    path: string;
    description: string | null;
    tags: string;
    entityType: string | null;
    entityId: string | null;
    entityName: string | null;
    folder: string;
    createdAt: string;
    updatedAt: string;
}

interface FileSummary {
    totalFiles: number;
    totalSize: number;
    folderCounts: Record<string, number>;
    entityCounts: Record<string, number>;
}

// ── Config ──
const folderConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    general: { label: "General", icon: <RiFolderLine className="w-3.5 h-3.5" />, color: "text-stone-500 bg-stone-500/10" },
    contracts: { label: "Contracts", icon: <RiFileTextLine className="w-3.5 h-3.5" />, color: "text-blue-500 bg-blue-500/10" },
    invoices: { label: "Invoices", icon: <RiFileList3Line className="w-3.5 h-3.5" />, color: "text-emerald-500 bg-emerald-500/10" },
    proposals: { label: "Proposals", icon: <RiFileTextLine className="w-3.5 h-3.5" />, color: "text-violet-500 bg-violet-500/10" },
    receipts: { label: "Receipts", icon: <RiPriceTag3Line className="w-3.5 h-3.5" />, color: "text-amber-500 bg-amber-500/10" },
    images: { label: "Images", icon: <RiImageLine className="w-3.5 h-3.5" />, color: "text-pink-500 bg-pink-500/10" },
    other: { label: "Other", icon: <RiFolder2Line className="w-3.5 h-3.5" />, color: "text-stone-400 bg-stone-400/10" },
};

const entityConfig: Record<string, { label: string; icon: React.ReactNode; color: string; href: string }> = {
    lead: { label: "Lead", icon: <RiUserSearchLine className="w-3 h-3" />, color: "text-blue-500", href: "/leads" },
    contact: { label: "Contact", icon: <RiTeamLine className="w-3 h-3" />, color: "text-violet-500", href: "/contacts" },
    company: { label: "Company", icon: <RiBuilding2Line className="w-3 h-3" />, color: "text-indigo-500", href: "/companies" },
    project: { label: "Project", icon: <RiProjector2Line className="w-3 h-3" />, color: "text-teal-500", href: "/projects" },
    proposal: { label: "Proposal", icon: <RiFileTextLine className="w-3 h-3" />, color: "text-violet-500", href: "/proposals" },
    invoice: { label: "Invoice", icon: <RiFileList3Line className="w-3 h-3" />, color: "text-emerald-500", href: "/invoices" },
    deal: { label: "Deal", icon: <RiFlowChart className="w-3 h-3" />, color: "text-amber-500", href: "/pipeline" },
    expense: { label: "Expense", icon: <RiMoneyDollarCircleLine className="w-3 h-3" />, color: "text-rose-500", href: "/expenses" },
    campaign: { label: "Campaign", icon: <RiMegaphoneLine className="w-3 h-3" />, color: "text-pink-500", href: "/campaigns" },
};

function formatSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getFileIcon(mimeType: string): React.ReactNode {
    if (mimeType.startsWith("image/")) return <RiImageLine className="w-5 h-5 text-pink-500" />;
    if (mimeType === "application/pdf") return <RiFilePdf2Line className="w-5 h-5 text-red-500" />;
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType === "text/csv") return <RiFileExcel2Line className="w-5 h-5 text-emerald-500" />;
    if (mimeType.includes("word") || mimeType.includes("document")) return <RiFileWord2Line className="w-5 h-5 text-blue-500" />;
    if (mimeType.includes("zip") || mimeType.includes("compressed") || mimeType.includes("archive")) return <RiFileZipLine className="w-5 h-5 text-amber-500" />;
    if (mimeType.startsWith("video/")) return <RiVideoLine className="w-5 h-5 text-violet-500" />;
    if (mimeType.startsWith("audio/")) return <RiMusic2Line className="w-5 h-5 text-indigo-500" />;
    if (mimeType.startsWith("text/")) return <RiFileTextLine className="w-5 h-5 text-stone-500" />;
    return <RiFile3Line className="w-5 h-5 text-stone-400" />;
}

function getFileIconLarge(mimeType: string): React.ReactNode {
    if (mimeType.startsWith("image/")) return <RiImageLine className="w-8 h-8 text-pink-500" />;
    if (mimeType === "application/pdf") return <RiFilePdf2Line className="w-8 h-8 text-red-500" />;
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType === "text/csv") return <RiFileExcel2Line className="w-8 h-8 text-emerald-500" />;
    if (mimeType.includes("word") || mimeType.includes("document")) return <RiFileWord2Line className="w-8 h-8 text-blue-500" />;
    if (mimeType.includes("zip") || mimeType.includes("compressed") || mimeType.includes("archive")) return <RiFileZipLine className="w-8 h-8 text-amber-500" />;
    if (mimeType.startsWith("video/")) return <RiVideoLine className="w-8 h-8 text-violet-500" />;
    if (mimeType.startsWith("audio/")) return <RiMusic2Line className="w-8 h-8 text-indigo-500" />;
    if (mimeType.startsWith("text/")) return <RiFileTextLine className="w-8 h-8 text-stone-500" />;
    return <RiFile3Line className="w-8 h-8 text-stone-400" />;
}

function isPreviewable(mimeType: string): boolean {
    return mimeType.startsWith("image/") || mimeType === "application/pdf";
}

export default function FilesPage() {
    const [loading, setLoading] = React.useState(true);
    const [files, setFiles] = React.useState<FileItem[]>([]);
    const [summary, setSummary] = React.useState<FileSummary | null>(null);
    const [search, setSearch] = React.useState("");
    const [folderFilter, setFolderFilter] = React.useState("all");
    const [entityFilter, setEntityFilter] = React.useState("all");
    const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");
    const [sortBy, setSortBy] = React.useState("createdAt");
    const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");
    const [selected, setSelected] = React.useState<Set<string>>(new Set());

    // Modals
    const [showUpload, setShowUpload] = React.useState(false);
    const [showPreview, setShowPreview] = React.useState<FileItem | null>(null);
    const [showEdit, setShowEdit] = React.useState<FileItem | null>(null);
    const [showLink, setShowLink] = React.useState<FileItem | null>(null);

    // Upload state
    const [uploading, setUploading] = React.useState(false);
    const [dragActive, setDragActive] = React.useState(false);
    const [uploadFolder, setUploadFolder] = React.useState("general");
    const [uploadEntityType, setUploadEntityType] = React.useState("");
    const [uploadEntityId, setUploadEntityId] = React.useState("");
    const [uploadDescription, setUploadDescription] = React.useState("");
    const [pendingFiles, setPendingFiles] = React.useState<File[]>([]);

    // Edit state
    const [editName, setEditName] = React.useState("");
    const [editDescription, setEditDescription] = React.useState("");
    const [editFolder, setEditFolder] = React.useState("");

    // Link state
    const [linkEntityType, setLinkEntityType] = React.useState("");
    const [linkEntityId, setLinkEntityId] = React.useState("");
    const [linkEntities, setLinkEntities] = React.useState<any[]>([]);
    const [linkSearching, setLinkSearching] = React.useState(false);

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // ── Fetch files ──
    const fetchFiles = React.useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            if (folderFilter !== "all") params.set("folder", folderFilter);
            if (entityFilter !== "all") params.set("entityType", entityFilter);
            params.set("sort", sortBy);
            params.set("order", sortOrder);
            const res = await apiFetch(`${API}/api/files?${params}`);
            const data = await res.json();
            setFiles(data.files || []);
            setSummary(data.summary || null);
        } catch {
            setFiles([]);
        } finally {
            setLoading(false);
        }
    }, [search, folderFilter, entityFilter, sortBy, sortOrder]);

    React.useEffect(() => {
        fetchFiles();
    }, [fetchFiles]);

    // ── Upload ──
    const handleUpload = async () => {
        if (pendingFiles.length === 0) return;
        setUploading(true);
        try {
            const formData = new FormData();
            pendingFiles.forEach((f) => formData.append("files", f));
            formData.append("folder", uploadFolder);
            if (uploadDescription) formData.append("description", uploadDescription);
            if (uploadEntityType) formData.append("entityType", uploadEntityType);
            if (uploadEntityId) formData.append("entityId", uploadEntityId);

            await apiFetch(`${API}/api/files`, { method: "POST", body: formData });
            resetUpload();
            fetchFiles();
            toast.success("File uploaded.");
        } catch (err) {
            console.error("Upload failed:", err);
            toast.error("Failed to upload file.");
        } finally {
            setUploading(false);
        }
    };

    const resetUpload = () => {
        setShowUpload(false);
        setPendingFiles([]);
        setUploadFolder("general");
        setUploadEntityType("");
        setUploadEntityId("");
        setUploadDescription("");
    };

    // ── Drag & Drop ──
    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
        else if (e.type === "dragleave") setDragActive(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files?.length) {
            setPendingFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
            if (!showUpload) setShowUpload(true);
        }
    };

    // ── Delete ──
    const handleDelete = async (id: string) => {
        if (!confirm("Delete this file permanently?")) return;
        try {
            await apiFetch(`${API}/api/files/${id}`, { method: "DELETE" });
            fetchFiles();
            toast.success("File deleted.");
        } catch { toast.error("Failed to delete file."); }
    };

    const handleBulkDelete = async () => {
        if (selected.size === 0) return;
        if (!confirm(`Delete ${selected.size} file(s) permanently?`)) return;
        try {
            await apiFetch(`${API}/api/files/bulk-delete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: Array.from(selected) }),
            });
            setSelected(new Set());
            fetchFiles();
            toast.success("Files deleted.");
        } catch { toast.error("Failed to delete files."); }
    };

    // ── Edit ──
    const openEdit = (file: FileItem) => {
        setShowEdit(file);
        setEditName(file.name);
        setEditDescription(file.description || "");
        setEditFolder(file.folder);
    };

    const handleEdit = async () => {
        if (!showEdit) return;
        try {
            await apiFetch(`${API}/api/files/${showEdit.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: editName, description: editDescription, folder: editFolder }),
            });
            setShowEdit(null);
            fetchFiles();
            toast.success("File renamed.");
        } catch { toast.error("Failed to rename file."); }
    };

    // ── Link to entity ──
    const openLink = (file: FileItem) => {
        setShowLink(file);
        setLinkEntityType(file.entityType || "");
        setLinkEntityId(file.entityId || "");
        setLinkEntities([]);
    };

    const fetchLinkEntities = async (type: string) => {
        if (!type) { setLinkEntities([]); return; }
        setLinkSearching(true);
        try {
            let url = "";
            switch (type) {
                case "lead": url = `${API}/api/leads?limit=100`; break;
                case "contact": url = `${API}/api/contacts`; break;
                case "company": url = `${API}/api/companies`; break;
                case "project": url = `${API}/api/projects`; break;
                case "proposal": url = `${API}/api/proposals`; break;
                case "invoice": url = `${API}/api/invoices`; break;
                case "deal": url = `${API}/api/deals`; break;
                case "expense": url = `${API}/api/expenses`; break;
                case "campaign": url = `${API}/api/campaigns`; break;
            }
            const res = await apiFetch(url);
            const data = await res.json();
            const key = type === "deal" ? "deals" : type === "lead" ? "leads" : type === "company" ? "companies" :
                type === "expense" ? "expenses" : type === "campaign" ? "campaigns" :
                    type === "proposal" ? "proposals" : type === "invoice" ? "invoices" :
                        type === "contact" ? "contacts" : type === "project" ? "projects" : type + "s";
            const items = data[key] || [];
            setLinkEntities(items.map((item: any) => ({
                id: item.id,
                label: item.name || item.title || item.clientName || item.invoiceNumber || item.proposalNumber || item.description || item.id,
            })));
        } catch {
            setLinkEntities([]);
        } finally {
            setLinkSearching(false);
        }
    };

    const handleLink = async () => {
        if (!showLink) return;
        try {
            if (linkEntityType && linkEntityId) {
                await apiFetch(`${API}/api/files/${showLink.id}/link`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ entityType: linkEntityType, entityId: linkEntityId }),
                });
                toast.success("File linked.");
            } else {
                await apiFetch(`${API}/api/files/${showLink.id}/unlink`, { method: "POST" });
                toast.success("File unlinked.");
            }
            setShowLink(null);
            fetchFiles();
        } catch { toast.error("Failed to link file."); }
    };

    // ── Selection ──
    const toggleSelect = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selected.size === files.length) setSelected(new Set());
        else setSelected(new Set(files.map((f) => f.id)));
    };

    // ── Sort ──
    const handleSort = (field: string) => {
        if (sortBy === field) setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
        else { setSortBy(field); setSortOrder("desc"); }
    };

    const SortIcon = ({ field }: { field: string }) => (
        sortBy === field
            ? sortOrder === "asc" ? <RiArrowUpLine className="w-3 h-3" /> : <RiArrowDownLine className="w-3 h-3" />
            : null
    );

    // ── Loading ──
    if (loading) {
        return (
            <>
                <AppHeader title="Files" subtitle="Loading file manager..." />
                <div className="flex items-center justify-center h-[60vh]">
                    <RiLoader4Line className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            </>
        );
    }

    return (
        <>
            <AppHeader title="Files" subtitle={`${summary?.totalFiles || 0} files · ${formatSize(summary?.totalSize || 0)} total`} />
            <div
                className="flex-1 overflow-auto p-6 space-y-5"
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
            >
                {/* ── Drop overlay ── */}
                {dragActive && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary/50 rounded-xl">
                        <div className="text-center space-y-3">
                            <RiUpload2Line className="w-12 h-12 text-primary mx-auto" />
                            <p className="text-lg font-semibold text-foreground">Drop files to upload</p>
                            <p className="text-sm text-muted-foreground">Files will be uploaded to the current folder</p>
                        </div>
                    </div>
                )}

                {/* ── Folder summary bar ── */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    <button
                        onClick={() => setFolderFilter("all")}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all whitespace-nowrap",
                            folderFilter === "all"
                                ? "border-primary/40 bg-primary/5 text-primary"
                                : "border-border bg-card text-muted-foreground hover:border-primary/20"
                        )}
                    >
                        <RiFolder3Line className="w-3.5 h-3.5" /> All Files
                        <span className="ml-0.5 text-[10px] opacity-70">{summary?.totalFiles || 0}</span>
                    </button>
                    {Object.entries(folderConfig).map(([key, cfg]) => {
                        const count = summary?.folderCounts[key] || 0;
                        if (count === 0 && folderFilter !== key) return null;
                        return (
                            <button
                                key={key}
                                onClick={() => setFolderFilter(folderFilter === key ? "all" : key)}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all whitespace-nowrap",
                                    folderFilter === key
                                        ? "border-primary/40 bg-primary/5 text-primary"
                                        : "border-border bg-card text-muted-foreground hover:border-primary/20"
                                )}
                            >
                                <span className={cfg.color.split(" ")[0]}>{cfg.icon}</span>
                                {cfg.label}
                                <span className="ml-0.5 text-[10px] opacity-70">{count}</span>
                            </button>
                        );
                    })}
                </div>

                {/* ── Toolbar ── */}
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search files..."
                            className="w-full h-9 rounded-lg border border-input bg-card pl-9 pr-4 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/30"
                        />
                    </div>

                    {/* Entity filter */}
                    <select
                        value={entityFilter}
                        onChange={(e) => setEntityFilter(e.target.value)}
                        className="h-9 rounded-lg border border-input bg-card px-3 text-sm text-foreground min-w-[130px]"
                    >
                        <option value="all">All types</option>
                        <option value="">Unlinked</option>
                        {Object.entries(entityConfig).map(([key, cfg]) => (
                            <option key={key} value={key}>{cfg.label}</option>
                        ))}
                    </select>

                    {/* View toggle */}
                    <div className="flex items-center border border-input rounded-lg overflow-hidden">
                        <button
                            onClick={() => setViewMode("grid")}
                            className={cn("p-2 transition-colors", viewMode === "grid" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}
                        >
                            <RiGridLine className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode("list")}
                            className={cn("p-2 transition-colors", viewMode === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}
                        >
                            <RiListUnordered className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex-1" />

                    {/* Bulk actions */}
                    {selected.size > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            className="h-9 px-3 rounded-lg bg-red-500/10 text-red-600 text-xs font-medium border border-red-500/20 hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
                        >
                            <RiDeleteBinLine className="w-3.5 h-3.5" /> Delete {selected.size}
                        </button>
                    )}

                    {/* Upload button */}
                    <button
                        onClick={() => setShowUpload(true)}
                        className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
                    >
                        <RiUpload2Line className="w-4 h-4" /> Upload
                    </button>
                </div>

                {/* ── Empty state ── */}
                {files.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                            <RiInbox2Line className="w-8 h-8 text-muted-foreground/50" />
                        </div>
                        <h3 className="text-base font-semibold text-foreground mb-1">No files yet</h3>
                        <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                            Upload your first file by clicking the Upload button or drag &amp; drop files anywhere on this page.
                        </p>
                        <button
                            onClick={() => setShowUpload(true)}
                            className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
                        >
                            <RiUpload2Line className="w-4 h-4" /> Upload Files
                        </button>
                    </div>
                )}

                {/* ── Grid View ── */}
                {files.length > 0 && viewMode === "grid" && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {files.map((file) => (
                            <div
                                key={file.id}
                                className={cn(
                                    "group relative rounded-xl border bg-card p-3 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer",
                                    selected.has(file.id) && "border-primary/50 bg-primary/5"
                                )}
                            >
                                {/* Selection checkbox */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleSelect(file.id); }}
                                    className={cn(
                                        "absolute top-2 left-2 w-5 h-5 rounded border flex items-center justify-center transition-all z-10",
                                        selected.has(file.id)
                                            ? "border-primary bg-primary text-primary-foreground"
                                            : "border-border bg-card text-transparent group-hover:text-muted-foreground group-hover:border-muted-foreground/40"
                                    )}
                                >
                                    <RiCheckLine className="w-3 h-3" />
                                </button>

                                {/* Preview area */}
                                <div
                                    className="flex items-center justify-center h-20 mb-3 rounded-lg bg-muted/50"
                                    onClick={() => isPreviewable(file.mimeType) ? setShowPreview(file) : window.open(`${API}/api/files/download/${file.id}`, "_blank")}
                                >
                                    {file.mimeType.startsWith("image/") ? (
                                        <img
                                            src={`${API}/api/files/preview/${file.id}`}
                                            alt={file.name}
                                            className="max-h-full max-w-full object-contain rounded-md"
                                        />
                                    ) : (
                                        getFileIconLarge(file.mimeType)
                                    )}
                                </div>

                                {/* Info */}
                                <p className="text-xs font-medium text-foreground truncate" title={file.name}>{file.name}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">{formatSize(file.size)} · {formatDate(file.createdAt)}</p>

                                {/* Entity badge */}
                                {file.entityType && file.entityName && (
                                    <div className={cn("flex items-center gap-1 mt-1.5 text-[10px] font-medium", entityConfig[file.entityType]?.color || "text-muted-foreground")}>
                                        {entityConfig[file.entityType]?.icon}
                                        <span className="truncate">{file.entityName}</span>
                                    </div>
                                )}

                                {/* Hover actions */}
                                <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    <button onClick={(e) => { e.stopPropagation(); openEdit(file); }} className="w-6 h-6 rounded bg-card border border-border flex items-center justify-center hover:bg-muted" title="Edit">
                                        <RiEdit2Line className="w-3 h-3 text-muted-foreground" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); openLink(file); }} className="w-6 h-6 rounded bg-card border border-border flex items-center justify-center hover:bg-muted" title="Link">
                                        <RiLink className="w-3 h-3 text-muted-foreground" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); window.open(`${API}/api/files/download/${file.id}`, "_blank"); }} className="w-6 h-6 rounded bg-card border border-border flex items-center justify-center hover:bg-muted" title="Download">
                                        <RiDownload2Line className="w-3 h-3 text-muted-foreground" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(file.id); }} className="w-6 h-6 rounded bg-card border border-red-500/20 flex items-center justify-center hover:bg-red-500/10" title="Delete">
                                        <RiDeleteBinLine className="w-3 h-3 text-red-500" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── List View ── */}
                {files.length > 0 && viewMode === "list" && (
                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="w-10 p-3">
                                        <button onClick={toggleSelectAll} className={cn(
                                            "w-4 h-4 rounded border flex items-center justify-center",
                                            selected.size === files.length && files.length > 0
                                                ? "border-primary bg-primary text-primary-foreground"
                                                : "border-border"
                                        )}>
                                            {selected.size === files.length && files.length > 0 && <RiCheckLine className="w-2.5 h-2.5" />}
                                        </button>
                                    </th>
                                    <th className="text-left p-3 font-medium text-muted-foreground">
                                        <button onClick={() => handleSort("name")} className="flex items-center gap-1 hover:text-foreground">
                                            Name <SortIcon field="name" />
                                        </button>
                                    </th>
                                    <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">
                                        <button onClick={() => handleSort("size")} className="flex items-center gap-1 hover:text-foreground">
                                            Size <SortIcon field="size" />
                                        </button>
                                    </th>
                                    <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Folder</th>
                                    <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Linked To</th>
                                    <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">
                                        <button onClick={() => handleSort("createdAt")} className="flex items-center gap-1 hover:text-foreground">
                                            Date <SortIcon field="createdAt" />
                                        </button>
                                    </th>
                                    <th className="w-28 p-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {files.map((file) => (
                                    <tr
                                        key={file.id}
                                        className={cn(
                                            "border-b border-border/50 hover:bg-muted/30 transition-colors group",
                                            selected.has(file.id) && "bg-primary/5"
                                        )}
                                    >
                                        <td className="p-3">
                                            <button onClick={() => toggleSelect(file.id)} className={cn(
                                                "w-4 h-4 rounded border flex items-center justify-center",
                                                selected.has(file.id)
                                                    ? "border-primary bg-primary text-primary-foreground"
                                                    : "border-border"
                                            )}>
                                                {selected.has(file.id) && <RiCheckLine className="w-2.5 h-2.5" />}
                                            </button>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-2.5">
                                                {getFileIcon(file.mimeType)}
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                                                    <p className="text-[10px] text-muted-foreground truncate">{file.originalName}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3 hidden md:table-cell">
                                            <span className="text-xs text-muted-foreground">{formatSize(file.size)}</span>
                                        </td>
                                        <td className="p-3 hidden lg:table-cell">
                                            <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full", folderConfig[file.folder]?.color || "text-stone-500 bg-stone-500/10")}>
                                                {folderConfig[file.folder]?.icon}
                                                {folderConfig[file.folder]?.label || file.folder}
                                            </span>
                                        </td>
                                        <td className="p-3 hidden lg:table-cell">
                                            {file.entityType && file.entityName ? (
                                                <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium", entityConfig[file.entityType]?.color || "text-muted-foreground")}>
                                                    {entityConfig[file.entityType]?.icon}
                                                    <span className="truncate max-w-[120px]">{file.entityName}</span>
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-muted-foreground/50">—</span>
                                            )}
                                        </td>
                                        <td className="p-3 hidden md:table-cell">
                                            <span className="text-xs text-muted-foreground">{formatDate(file.createdAt)}</span>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                                                {isPreviewable(file.mimeType) && (
                                                    <button onClick={() => setShowPreview(file)} className="w-7 h-7 rounded-md border border-border flex items-center justify-center hover:bg-muted" title="Preview">
                                                        <RiEyeLine className="w-3.5 h-3.5 text-muted-foreground" />
                                                    </button>
                                                )}
                                                <button onClick={() => openEdit(file)} className="w-7 h-7 rounded-md border border-border flex items-center justify-center hover:bg-muted" title="Edit">
                                                    <RiEdit2Line className="w-3.5 h-3.5 text-muted-foreground" />
                                                </button>
                                                <button onClick={() => openLink(file)} className="w-7 h-7 rounded-md border border-border flex items-center justify-center hover:bg-muted" title="Link">
                                                    <RiLink className="w-3.5 h-3.5 text-muted-foreground" />
                                                </button>
                                                <button onClick={() => window.open(`${API}/api/files/download/${file.id}`, "_blank")} className="w-7 h-7 rounded-md border border-border flex items-center justify-center hover:bg-muted" title="Download">
                                                    <RiDownload2Line className="w-3.5 h-3.5 text-muted-foreground" />
                                                </button>
                                                <button onClick={() => handleDelete(file.id)} className="w-7 h-7 rounded-md border border-red-500/20 flex items-center justify-center hover:bg-red-500/10" title="Delete">
                                                    <RiDeleteBinLine className="w-3.5 h-3.5 text-red-500" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ═══════════════════════ UPLOAD MODAL ═══════════════════════ */}
            {showUpload && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => resetUpload()}>
                    <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-border">
                            <h2 className="text-base font-semibold text-foreground">Upload Files</h2>
                            <button onClick={resetUpload} className="text-muted-foreground hover:text-foreground"><RiCloseLine className="w-5 h-5" /></button>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* Drop zone */}
                            <div
                                className={cn(
                                    "border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer",
                                    dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                                )}
                                onClick={() => fileInputRef.current?.click()}
                                onDragEnter={handleDrag}
                                onDragOver={handleDrag}
                                onDragLeave={handleDrag}
                                onDrop={handleDrop}
                            >
                                <RiUpload2Line className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                                <p className="text-sm font-medium text-foreground">Click or drag files here</p>
                                <p className="text-xs text-muted-foreground mt-1">Max 50 MB per file · Up to 20 files</p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files?.length) setPendingFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                                    }}
                                />
                            </div>

                            {/* Pending files */}
                            {pendingFiles.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-xs font-medium text-muted-foreground">{pendingFiles.length} file(s) selected</p>
                                    {pendingFiles.map((f, i) => (
                                        <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-muted/50">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {getFileIcon(f.type || "application/octet-stream")}
                                                <span className="text-xs text-foreground truncate">{f.name}</span>
                                                <span className="text-[10px] text-muted-foreground shrink-0">{formatSize(f.size)}</span>
                                            </div>
                                            <button
                                                onClick={() => setPendingFiles((prev) => prev.filter((_, ii) => ii !== i))}
                                                className="text-muted-foreground hover:text-red-500 shrink-0 ml-2"
                                            >
                                                <RiCloseLine className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Folder */}
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Folder</label>
                                <select
                                    value={uploadFolder}
                                    onChange={(e) => setUploadFolder(e.target.value)}
                                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm"
                                >
                                    {Object.entries(folderConfig).map(([key, cfg]) => (
                                        <option key={key} value={key}>{cfg.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Link to entity (optional) */}
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Link to (optional)</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <select
                                        value={uploadEntityType}
                                        onChange={(e) => { setUploadEntityType(e.target.value); setUploadEntityId(""); }}
                                        className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                                    >
                                        <option value="">No link</option>
                                        {Object.entries(entityConfig).map(([key, cfg]) => (
                                            <option key={key} value={key}>{cfg.label}</option>
                                        ))}
                                    </select>
                                    {uploadEntityType && (
                                        <input
                                            value={uploadEntityId}
                                            onChange={(e) => setUploadEntityId(e.target.value)}
                                            placeholder="Entity ID"
                                            className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description (optional)</label>
                                <input
                                    value={uploadDescription}
                                    onChange={(e) => setUploadDescription(e.target.value)}
                                    placeholder="Brief description..."
                                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 p-5 border-t border-border">
                            <button onClick={resetUpload} className="h-9 px-4 rounded-lg border border-input text-sm font-medium hover:bg-muted transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={handleUpload}
                                disabled={pendingFiles.length === 0 || uploading}
                                className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {uploading ? <RiLoader4Line className="w-4 h-4 animate-spin" /> : <RiUpload2Line className="w-4 h-4" />}
                                {uploading ? "Uploading..." : `Upload ${pendingFiles.length} file(s)`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════ PREVIEW MODAL ═══════════════════════ */}
            {showPreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowPreview(null)}>
                    <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <div className="flex items-center gap-2 min-w-0">
                                {getFileIcon(showPreview.mimeType)}
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-foreground truncate">{showPreview.name}</p>
                                    <p className="text-[10px] text-muted-foreground">{formatSize(showPreview.size)} · {showPreview.mimeType}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => window.open(`${API}/api/files/download/${showPreview.id}`, "_blank")}
                                    className="h-8 px-3 rounded-lg border border-input text-xs font-medium hover:bg-muted transition-colors flex items-center gap-1.5"
                                >
                                    <RiDownload2Line className="w-3.5 h-3.5" /> Download
                                </button>
                                <button onClick={() => setShowPreview(null)} className="text-muted-foreground hover:text-foreground"><RiCloseLine className="w-5 h-5" /></button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-muted/30 min-h-[300px]">
                            {showPreview.mimeType.startsWith("image/") ? (
                                <img
                                    src={`${API}/api/files/preview/${showPreview.id}`}
                                    alt={showPreview.name}
                                    className="max-w-full max-h-[70vh] object-contain rounded-lg"
                                />
                            ) : showPreview.mimeType === "application/pdf" ? (
                                <iframe
                                    src={`${API}/api/files/preview/${showPreview.id}`}
                                    className="w-full h-[70vh] rounded-lg border border-border"
                                />
                            ) : null}
                        </div>
                        {/* File details */}
                        {(showPreview.entityType || showPreview.description) && (
                            <div className="p-4 border-t border-border space-y-1">
                                {showPreview.description && <p className="text-xs text-muted-foreground">{showPreview.description}</p>}
                                {showPreview.entityType && showPreview.entityName && (
                                    <div className={cn("flex items-center gap-1.5 text-xs font-medium", entityConfig[showPreview.entityType]?.color || "text-muted-foreground")}>
                                        {entityConfig[showPreview.entityType]?.icon}
                                        Linked to {entityConfig[showPreview.entityType]?.label}: {showPreview.entityName}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══════════════════════ EDIT MODAL ═══════════════════════ */}
            {showEdit && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowEdit(null)}>
                    <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-border">
                            <h2 className="text-base font-semibold text-foreground">Edit File</h2>
                            <button onClick={() => setShowEdit(null)} className="text-muted-foreground hover:text-foreground"><RiCloseLine className="w-5 h-5" /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">File Name</label>
                                <input
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description</label>
                                <input
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    placeholder="Brief description..."
                                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Folder</label>
                                <select
                                    value={editFolder}
                                    onChange={(e) => setEditFolder(e.target.value)}
                                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm"
                                >
                                    {Object.entries(folderConfig).map(([key, cfg]) => (
                                        <option key={key} value={key}>{cfg.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 p-5 border-t border-border">
                            <button onClick={() => setShowEdit(null)} className="h-9 px-4 rounded-lg border border-input text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
                            <button onClick={handleEdit} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">Save Changes</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════ LINK MODAL ═══════════════════════ */}
            {showLink && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowLink(null)}>
                    <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-border">
                            <h2 className="text-base font-semibold text-foreground">Link to Entity</h2>
                            <button onClick={() => setShowLink(null)} className="text-muted-foreground hover:text-foreground"><RiCloseLine className="w-5 h-5" /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-xs text-muted-foreground">
                                Connect <span className="font-medium text-foreground">{showLink.name}</span> to a CRM entity so it&apos;s accessible from that record.
                            </p>

                            {/* Current link */}
                            {showLink.entityType && showLink.entityName && (
                                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                                    <div className={cn("flex items-center gap-1.5 text-xs font-medium", entityConfig[showLink.entityType]?.color || "text-muted-foreground")}>
                                        {entityConfig[showLink.entityType]?.icon}
                                        {entityConfig[showLink.entityType]?.label}: {showLink.entityName}
                                    </div>
                                    <button
                                        onClick={async () => {
                                            try {
                                                await apiFetch(`${API}/api/files/${showLink.id}/unlink`, { method: "POST" });
                                                setShowLink(null);
                                                fetchFiles();
                                                toast.success("File unlinked.");
                                            } catch { toast.error("Failed to unlink file."); }
                                        }}
                                        className="text-red-500 hover:text-red-600 text-xs font-medium flex items-center gap-1"
                                    >
                                        <RiLinkUnlink className="w-3 h-3" /> Unlink
                                    </button>
                                </div>
                            )}

                            {/* Entity type selector */}
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Entity Type</label>
                                <select
                                    value={linkEntityType}
                                    onChange={(e) => { setLinkEntityType(e.target.value); setLinkEntityId(""); fetchLinkEntities(e.target.value); }}
                                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm"
                                >
                                    <option value="">No link</option>
                                    {Object.entries(entityConfig).map(([key, cfg]) => (
                                        <option key={key} value={key}>{cfg.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Entity picker */}
                            {linkEntityType && (
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Select {entityConfig[linkEntityType]?.label}</label>
                                    {linkSearching ? (
                                        <div className="flex items-center justify-center py-4">
                                            <RiLoader4Line className="w-4 h-4 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : (
                                        <div className="max-h-48 overflow-y-auto rounded-lg border border-input">
                                            {linkEntities.length === 0 ? (
                                                <p className="p-3 text-xs text-muted-foreground text-center">No {entityConfig[linkEntityType]?.label}s found</p>
                                            ) : (
                                                linkEntities.map((item: any) => (
                                                    <button
                                                        key={item.id}
                                                        onClick={() => setLinkEntityId(item.id)}
                                                        className={cn(
                                                            "w-full text-left px-3 py-2 text-sm border-b border-border/50 last:border-0 hover:bg-muted/50 transition-colors flex items-center justify-between",
                                                            linkEntityId === item.id && "bg-primary/5 text-primary"
                                                        )}
                                                    >
                                                        <span className="truncate">{item.label}</span>
                                                        {linkEntityId === item.id && <RiCheckLine className="w-4 h-4 text-primary shrink-0" />}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center justify-end gap-2 p-5 border-t border-border">
                            <button onClick={() => setShowLink(null)} className="h-9 px-4 rounded-lg border border-input text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
                            <button onClick={handleLink} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                                {linkEntityType && linkEntityId ? "Link File" : "Unlink File"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
