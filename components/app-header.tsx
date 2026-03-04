"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    RiSunLine,
    RiMoonLine,
    RiSearchLine,
    RiNotification3Line,
    RiDeleteBinLine,
    RiTimeLine,
    RiUserSearchLine,
    RiContactsBook3Line,
    RiBuilding2Line,
    RiKanbanView,
    RiFileList3Line,
    RiPriceTag3Line,
    RiProjectorLine,
    RiMegaphoneLine,
    RiWalletLine,
    RiFolderOpenLine,
    RiCloseLine,
    RiLoader4Line,
    RiCommandLine,
    RiCornerDownLeftLine,
    RiArrowUpDownLine,
    RiDashboardLine,
    RiRadarLine,
    RiMailLine,
    RiMailSendLine,
    RiInboxLine,
    RiPieChartLine,
    RiFlowChart,
    RiSettings4Line,
    RiLoopLeftLine,
    RiAddLine,
    RiUploadCloud2Line,
    RiCompassLine,
    RiFlashlightLine,
    RiMoneyDollarCircleLine,
} from "@remixicon/react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { LanguageSwitcher } from "@/components/language-switcher";

// ── Notification types ──
interface Notification {
    id: string;
    title: string;
    message: string;
    type: "info" | "success" | "warning" | "error";
    read: boolean;
    createdAt: Date;
    href?: string;
}

const NOTIFICATION_TYPE_STYLES: Record<string, string> = {
    info: "bg-blue-500",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    error: "bg-red-500",
};

function timeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

// ── Types ──
interface SearchResult {
    id: string;
    type: string;       // "page" | "action" | "lead" | "contact" | ...
    category: string;   // grouping label
    title: string;
    subtitle?: string;
    href: string;
    extra?: string;
    icon?: React.ComponentType<{ className?: string }>;
    iconColor?: string;
}

// ── Category meta for API results ──
const TYPE_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
    lead:     { label: "Leads",     icon: RiUserSearchLine,    color: "text-blue-500" },
    contact:  { label: "Contacts",  icon: RiContactsBook3Line, color: "text-emerald-500" },
    company:  { label: "Companies", icon: RiBuilding2Line,     color: "text-violet-500" },
    deal:     { label: "Deals",     icon: RiKanbanView,        color: "text-amber-500" },
    invoice:  { label: "Invoices",  icon: RiFileList3Line,     color: "text-cyan-500" },
    proposal: { label: "Proposals", icon: RiPriceTag3Line,     color: "text-pink-500" },
    project:  { label: "Projects",  icon: RiProjectorLine,     color: "text-orange-500" },
    campaign: { label: "Campaigns", icon: RiMegaphoneLine,     color: "text-indigo-500" },
    expense:  { label: "Expenses",  icon: RiWalletLine,        color: "text-red-500" },
    file:     { label: "Files",     icon: RiFolderOpenLine,    color: "text-stone-500" },
};

// ── Static: Pages / Modules ──
interface StaticItem {
    id: string;
    type: "page" | "action";
    title: string;
    subtitle?: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    iconColor: string;
    keywords: string[]; // searchable terms (Turkish + English)
}

const PAGES: StaticItem[] = [
    { id: "p-dashboard",   type: "page", title: "Dashboard",       subtitle: "Overview & statistics",              href: "/",            icon: RiDashboardLine,         iconColor: "text-primary",       keywords: ["dashboard", "anasayfa", "genel bakış", "overview", "istatistik"] },
    { id: "p-engine",      type: "page", title: "Lead Engine",     subtitle: "Discover & generate leads",         href: "/engine",      icon: RiRadarLine,             iconColor: "text-blue-500",      keywords: ["engine", "lead engine", "lead bul", "lead üret", "discover", "generate", "radar"] },
    { id: "p-leads",       type: "page", title: "Leads",           subtitle: "Manage all leads",                  href: "/leads",       icon: RiUserSearchLine,        iconColor: "text-blue-500",      keywords: ["leads", "lead", "müşteri adayı", "potansiyel", "aday"] },
    { id: "p-enrichment",  type: "page", title: "Enrichment",      subtitle: "Email discovery & verification",    href: "/mails",       icon: RiMailLine,              iconColor: "text-sky-500",       keywords: ["enrichment", "email", "e-posta", "doğrulama", "verification", "mail"] },
    { id: "p-campaigns",   type: "page", title: "Campaigns",       subtitle: "Email & outreach campaigns",        href: "/campaigns",   icon: RiMailSendLine,          iconColor: "text-indigo-500",    keywords: ["campaigns", "kampanya", "outreach", "toplu mail", "email kampanyası"] },
    { id: "p-pipeline",    type: "page", title: "Pipeline",        subtitle: "Sales pipeline & deals",            href: "/pipeline",    icon: RiKanbanView,            iconColor: "text-amber-500",     keywords: ["pipeline", "satış", "deal", "kanban", "fırsat", "anlaşma"] },
    { id: "p-contacts",    type: "page", title: "Contacts",        subtitle: "People & relationships",            href: "/contacts",    icon: RiContactsBook3Line,     iconColor: "text-emerald-500",   keywords: ["contacts", "kişi", "kişiler", "müşteri", "iletişim", "rehber"] },
    { id: "p-companies",   type: "page", title: "Companies",       subtitle: "Organizations & clients",           href: "/companies",   icon: RiBuilding2Line,         iconColor: "text-violet-500",    keywords: ["companies", "şirket", "firma", "organizasyon", "kurum", "müşteri firma"] },
    { id: "p-inbox",       type: "page", title: "Inbox",           subtitle: "Messages & communication",          href: "/inbox",       icon: RiInboxLine,             iconColor: "text-teal-500",      keywords: ["inbox", "gelen kutusu", "mesaj", "communication"] },
    { id: "p-finance",     type: "page", title: "Finance Overview", subtitle: "Revenue, expenses & reports",      href: "/finance",     icon: RiPieChartLine,          iconColor: "text-green-500",     keywords: ["finance", "finans", "gelir", "gider", "rapor", "mali", "para"] },
    { id: "p-invoices",    type: "page", title: "Invoices",        subtitle: "Create & track invoices",           href: "/invoices",    icon: RiFileList3Line,         iconColor: "text-cyan-500",      keywords: ["invoices", "fatura", "faturalar", "invoice", "ödeme", "tahsilat"] },
    { id: "p-expenses",    type: "page", title: "Expenses",        subtitle: "Track business expenses",           href: "/expenses",    icon: RiWalletLine,            iconColor: "text-red-500",       keywords: ["expenses", "gider", "masraf", "harcama", "maliyet"] },
    { id: "p-proposals",   type: "page", title: "Proposals",       subtitle: "Quotes & proposals",                href: "/proposals",   icon: RiPriceTag3Line,         iconColor: "text-pink-500",      keywords: ["proposals", "teklif", "teklifler", "quote", "fiyat teklifi"] },
    { id: "p-recurring",   type: "page", title: "Recurring",       subtitle: "Recurring revenue & expenses",      href: "/recurring",   icon: RiLoopLeftLine,          iconColor: "text-purple-500",    keywords: ["recurring", "tekrarlayan", "abonelik", "düzenli gelir", "düzenli gider"] },
    { id: "p-projects",    type: "page", title: "Projects",        subtitle: "Manage projects & tasks",           href: "/projects",    icon: RiProjectorLine,         iconColor: "text-orange-500",    keywords: ["projects", "proje", "projeler", "görev", "task"] },
    { id: "p-files",       type: "page", title: "Files",           subtitle: "Documents, uploads & attachments",  href: "/files",       icon: RiFolderOpenLine,        iconColor: "text-stone-500",     keywords: ["files", "dosya", "dosyalar", "belge", "döküman", "ek", "upload", "yükleme"] },
    { id: "p-automations", type: "page", title: "Automations",     subtitle: "Workflow automations",              href: "/automations", icon: RiFlowChart,             iconColor: "text-lime-500",      keywords: ["automations", "otomasyon", "workflow", "akış", "otomatik"] },
    { id: "p-settings",    type: "page", title: "Settings",        subtitle: "App configuration",                 href: "/settings",    icon: RiSettings4Line,         iconColor: "text-stone-400",     keywords: ["settings", "ayarlar", "yapılandırma", "config", "tercihler"] },
];

// ── Static: Quick Actions ──
const ACTIONS: StaticItem[] = [
    { id: "a-new-lead",       type: "action", title: "New Lead",        subtitle: "Add a new lead to the system",    href: "/leads",     icon: RiAddLine,            iconColor: "text-blue-500",    keywords: ["new lead", "yeni lead", "lead ekle", "lead oluştur", "add lead"] },
    { id: "a-new-contact",    type: "action", title: "New Contact",     subtitle: "Create a new contact",            href: "/contacts",  icon: RiAddLine,            iconColor: "text-emerald-500", keywords: ["new contact", "yeni kişi", "kişi ekle", "contact oluştur"] },
    { id: "a-new-company",    type: "action", title: "New Company",     subtitle: "Add a new company",               href: "/companies", icon: RiAddLine,            iconColor: "text-violet-500",  keywords: ["new company", "yeni şirket", "firma ekle", "şirket oluştur"] },
    { id: "a-new-invoice",    type: "action", title: "New Invoice",     subtitle: "Create a new invoice",            href: "/invoices",  icon: RiAddLine,            iconColor: "text-cyan-500",    keywords: ["new invoice", "yeni fatura", "fatura oluştur", "fatura ekle"] },
    { id: "a-new-proposal",   type: "action", title: "New Proposal",    subtitle: "Create a new proposal",           href: "/proposals", icon: RiAddLine,            iconColor: "text-pink-500",    keywords: ["new proposal", "yeni teklif", "teklif oluştur", "teklif ekle"] },
    { id: "a-new-project",    type: "action", title: "New Project",     subtitle: "Start a new project",             href: "/projects",  icon: RiAddLine,            iconColor: "text-orange-500",  keywords: ["new project", "yeni proje", "proje oluştur", "proje ekle"] },
    { id: "a-new-campaign",   type: "action", title: "New Campaign",    subtitle: "Launch a new campaign",           href: "/campaigns", icon: RiAddLine,            iconColor: "text-indigo-500",  keywords: ["new campaign", "yeni kampanya", "kampanya oluştur"] },
    { id: "a-new-expense",    type: "action", title: "New Expense",     subtitle: "Record a new expense",            href: "/expenses",  icon: RiAddLine,            iconColor: "text-red-500",     keywords: ["new expense", "yeni gider", "masraf ekle", "harcama ekle"] },
    { id: "a-upload-file",    type: "action", title: "Upload File",     subtitle: "Upload documents or images",      href: "/files",     icon: RiUploadCloud2Line,   iconColor: "text-stone-500",   keywords: ["upload", "dosya yükle", "yükle", "belge yükle"] },
    { id: "a-find-leads",     type: "action", title: "Find Leads",      subtitle: "Search for new leads with engine", href: "/engine",   icon: RiRadarLine,          iconColor: "text-blue-500",    keywords: ["find leads", "lead bul", "lead ara", "arama", "keşfet"] },
];

// ── Local fuzzy match ──
function matchesQuery(item: StaticItem, q: string): boolean {
    const lower = q.toLowerCase();
    if (item.title.toLowerCase().includes(lower)) return true;
    if (item.subtitle && item.subtitle.toLowerCase().includes(lower)) return true;
    return item.keywords.some((kw) => kw.includes(lower));
}

// ── Hook: Debounced value ──
function useDebounce<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = React.useState(value);
    React.useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

// ── Props ──
interface AppHeaderProps {
    title: string;
    subtitle?: string;
}

export function AppHeader({ title, subtitle }: AppHeaderProps) {
    const { theme, setTheme } = useTheme();
    const router = useRouter();
    const [mounted, setMounted] = React.useState(false);

    // Search state
    const [query, setQuery] = React.useState("");
    const [apiResults, setApiResults] = React.useState<SearchResult[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [open, setOpen] = React.useState(false);
    const [activeIndex, setActiveIndex] = React.useState(-1);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const debouncedQuery = useDebounce(query, 250);

    // ── Notification state — backed by API with polling ──
    const [notifications, setNotifications] = React.useState<Notification[]>([]);
    const [notifOpen, setNotifOpen] = React.useState(false);
    const notifRef = React.useRef<HTMLDivElement>(null);
    const unreadCount = notifications.filter((n) => !n.read).length;

    const fetchNotifications = React.useCallback(async () => {
        try {
            const res = await apiFetch("http://localhost:3001/api/notifications?limit=30");
            const data = await res.json();
            if (data.success) {
                setNotifications(
                    (data.notifications || []).map((n: any) => ({
                        ...n,
                        createdAt: new Date(n.createdAt),
                    }))
                );
            }
        } catch { /* silently fail */ }
    }, []);

    // Initial fetch + polling every 15 seconds
    React.useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 15000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    // Close notification panel on outside click
    React.useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setNotifOpen(false);
            }
        }
        if (notifOpen) document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [notifOpen]);

    const markAsRead = async (id: string) => {
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
        apiFetch(`http://localhost:3001/api/notifications/${id}/read`, { method: "PATCH" }).catch(() => {});
    };

    const markAllAsRead = async () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        apiFetch("http://localhost:3001/api/notifications/read-all", { method: "PATCH" }).catch(() => {});
        toast.success("All notifications marked as read");
    };

    const dismissNotification = async (id: string) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        apiFetch(`http://localhost:3001/api/notifications/${id}`, { method: "DELETE" }).catch(() => {});
    };

    // ⌘K shortcut
    React.useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                inputRef.current?.focus();
                setOpen(true);
            }
            if (e.key === "Escape") {
                setOpen(false);
                inputRef.current?.blur();
            }
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, []);

    // Fetch API results on debounced query change
    React.useEffect(() => {
        if (!debouncedQuery || debouncedQuery.length < 2) {
            setApiResults([]);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);

        apiFetch(`http://localhost:3001/api/global-search?q=${encodeURIComponent(debouncedQuery)}&limit=25`)
            .then((r) => r.json())
            .then((data) => {
                if (!cancelled) {
                    setApiResults(
                        (data.results || []).map((r: any) => ({
                            ...r,
                            category: r.type, // keep original type as category
                        }))
                    );
                }
            })
            .catch(() => {
                if (!cancelled) setApiResults([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [debouncedQuery]);

    // Close on outside click
    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // ── Compute combined results ──
    const allResults: SearchResult[] = React.useMemo(() => {
        const q = query.trim();
        const combined: SearchResult[] = [];

        if (!q) {
            // Empty query: show suggested quick actions + top pages
            for (const a of ACTIONS.slice(0, 5)) {
                combined.push({
                    id: a.id, type: a.type, category: "action",
                    title: a.title, subtitle: a.subtitle, href: a.href,
                    icon: a.icon, iconColor: a.iconColor,
                });
            }
            for (const p of PAGES.slice(0, 6)) {
                combined.push({
                    id: p.id, type: p.type, category: "page",
                    title: p.title, subtitle: p.subtitle, href: p.href,
                    icon: p.icon, iconColor: p.iconColor,
                });
            }
            return combined;
        }

        // 1) Match pages
        const matchedPages = PAGES.filter((p) => matchesQuery(p, q));
        for (const p of matchedPages) {
            combined.push({
                id: p.id, type: p.type, category: "page",
                title: p.title, subtitle: p.subtitle, href: p.href,
                icon: p.icon, iconColor: p.iconColor,
            });
        }

        // 2) Match actions
        const matchedActions = ACTIONS.filter((a) => matchesQuery(a, q));
        for (const a of matchedActions) {
            combined.push({
                id: a.id, type: a.type, category: "action",
                title: a.title, subtitle: a.subtitle, href: a.href,
                icon: a.icon, iconColor: a.iconColor,
            });
        }

        // 3) API data results
        for (const r of apiResults) {
            combined.push(r);
        }

        return combined;
    }, [query, apiResults]);

    // ── Grouped for display ──
    const grouped = React.useMemo(() => {
        const map: { key: string; label: string; icon: React.ComponentType<{ className?: string }>; iconColor: string; items: SearchResult[] }[] = [];
        const seen = new Set<string>();

        for (const r of allResults) {
            const key = r.category;
            if (!seen.has(key)) {
                seen.add(key);
                let label: string;
                let icon: React.ComponentType<{ className?: string }>;
                let iconColor: string;

                if (key === "page") {
                    label = "Pages"; icon = RiCompassLine; iconColor = "text-primary";
                } else if (key === "action") {
                    label = "Quick Actions"; icon = RiFlashlightLine; iconColor = "text-amber-500";
                } else {
                    const meta = TYPE_META[key];
                    label = meta?.label || key;
                    icon = meta?.icon || RiSearchLine;
                    iconColor = meta?.color || "text-muted-foreground";
                }

                map.push({ key, label, icon, iconColor, items: [] });
            }
            map.find((g) => g.key === key)!.items.push(r);
        }
        return map;
    }, [allResults]);

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!open || allResults.length === 0) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => (i < allResults.length - 1 ? i + 1 : 0));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => (i > 0 ? i - 1 : allResults.length - 1));
        } else if (e.key === "Enter" && activeIndex >= 0) {
            e.preventDefault();
            navigateTo(allResults[activeIndex]);
        }
    };

    // Scroll active item into view
    React.useEffect(() => {
        if (activeIndex >= 0) {
            const el = containerRef.current?.querySelector(`[data-idx="${activeIndex}"]`);
            el?.scrollIntoView({ block: "nearest" });
        }
    }, [activeIndex]);

    const navigateTo = (result: SearchResult) => {
        setOpen(false);
        setQuery("");
        setApiResults([]);
        router.push(result.href);
    };

    const showDropdown = open;

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-md px-6">
            {/* Left: Title */}
            <div className="flex flex-col">
                <h1 className="text-lg font-semibold tracking-tight text-foreground">
                    {title}
                </h1>
                {subtitle && (
                    <p className="text-xs text-muted-foreground">{subtitle}</p>
                )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
                {/* ───── Global Command Palette ───── */}
                <div className="relative hidden md:block" ref={containerRef}>
                    <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setOpen(true);
                            setActiveIndex(-1);
                        }}
                        onFocus={() => setOpen(true)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search everything…"
                        className={cn(
                            "h-9 w-56 xl:w-80 rounded-md border border-input bg-muted/50 pl-9 pr-16 text-sm",
                            "placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/40",
                            "transition-all duration-200"
                        )}
                    />
                    {/* Shortcut badge or clear button */}
                    {query ? (
                        <button
                            onClick={() => { setQuery(""); setApiResults([]); setActiveIndex(-1); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <RiCloseLine className="w-4 h-4" />
                        </button>
                    ) : (
                        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden xl:inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            <RiCommandLine className="w-3 h-3" />K
                        </kbd>
                    )}

                    {/* Loading spinner */}
                    {loading && (
                        <RiLoader4Line className="absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
                    )}

                    {/* ─── Dropdown ─── */}
                    {showDropdown && (
                        <div
                            className={cn(
                                "absolute top-full right-0 mt-2 w-[460px] max-h-[520px] overflow-y-auto",
                                "rounded-lg border border-border bg-popover shadow-xl",
                                "scrollbar-thin animate-in fade-in-0 zoom-in-95 duration-150"
                            )}
                        >
                            {/* Loading state for API */}
                            {loading && apiResults.length === 0 && query.length >= 2 && grouped.length <= 0 ? (
                                <div className="flex items-center justify-center py-8">
                                    <RiLoader4Line className="w-5 h-5 text-muted-foreground animate-spin mr-2" />
                                    <span className="text-sm text-muted-foreground">Searching…</span>
                                </div>
                            ) : allResults.length === 0 && query.length >= 2 ? (
                                <div className="py-8 text-center">
                                    <RiSearchLine className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                                    <p className="text-sm text-muted-foreground">No results for &ldquo;{query}&rdquo;</p>
                                    <p className="text-xs text-muted-foreground/60 mt-1">Try &ldquo;fatura&rdquo;, &ldquo;leads&rdquo;, or a contact name</p>
                                </div>
                            ) : (
                                <>
                                    {grouped.map((group) => {
                                        const GIcon = group.icon;
                                        return (
                                            <div key={group.key}>
                                                <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 bg-muted/80 backdrop-blur-sm border-b border-border/50">
                                                    <GIcon className={cn("w-3.5 h-3.5", group.iconColor)} />
                                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                        {group.label}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground/50 ml-auto">{group.items.length}</span>
                                                </div>
                                                {group.items.map((result) => {
                                                    const idx = allResults.indexOf(result);
                                                    const isActive = idx === activeIndex;

                                                    // Determine icon
                                                    let ItemIcon: React.ComponentType<{ className?: string }>;
                                                    let itemIconColor: string;
                                                    if (result.icon) {
                                                        ItemIcon = result.icon;
                                                        itemIconColor = result.iconColor || "text-muted-foreground";
                                                    } else {
                                                        const meta = TYPE_META[result.type] || TYPE_META[result.category];
                                                        ItemIcon = meta?.icon || RiSearchLine;
                                                        itemIconColor = meta?.color || "text-muted-foreground";
                                                    }

                                                    return (
                                                        <button
                                                            key={result.id}
                                                            data-idx={idx}
                                                            onMouseEnter={() => setActiveIndex(idx)}
                                                            onClick={() => navigateTo(result)}
                                                            className={cn(
                                                                "flex items-center gap-3 w-full px-3 py-2 text-left transition-colors duration-75",
                                                                isActive ? "bg-accent" : "hover:bg-accent/50"
                                                            )}
                                                        >
                                                            <div className={cn(
                                                                "flex items-center justify-center w-7 h-7 rounded-md shrink-0",
                                                                result.type === "action" ? "bg-amber-500/10" : result.type === "page" ? "bg-primary/10" : "bg-muted"
                                                            )}>
                                                                <ItemIcon className={cn("w-4 h-4", itemIconColor)} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium text-foreground truncate">
                                                                    {result.title}
                                                                </p>
                                                                {result.subtitle && (
                                                                    <p className="text-[11px] text-muted-foreground truncate">{result.subtitle}</p>
                                                                )}
                                                            </div>
                                                            {result.extra && (
                                                                <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md shrink-0">
                                                                    {result.extra}
                                                                </span>
                                                            )}
                                                            {result.type === "page" && (
                                                                <span className="text-[10px] text-muted-foreground/40 shrink-0">Go to →</span>
                                                            )}
                                                            {result.type === "action" && (
                                                                <span className="text-[10px] text-amber-500/60 shrink-0">Action</span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}

                                    {/* Loading indicator for API while local results are shown */}
                                    {loading && query.length >= 2 && (
                                        <div className="flex items-center gap-2 px-3 py-2 border-t border-border/50">
                                            <RiLoader4Line className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
                                            <span className="text-[11px] text-muted-foreground">Searching database…</span>
                                        </div>
                                    )}

                                    {/* Footer hints */}
                                    <div className="sticky bottom-0 flex items-center gap-4 px-3 py-1.5 border-t border-border bg-muted/80 backdrop-blur-sm text-[10px] text-muted-foreground">
                                        <span className="flex items-center gap-1"><RiArrowUpDownLine className="w-3 h-3" /> Navigate</span>
                                        <span className="flex items-center gap-1"><RiCornerDownLeftLine className="w-3 h-3" /> Open</span>
                                        <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded border border-border bg-background text-[9px]">Esc</kbd> Close</span>
                                        <span className="ml-auto opacity-60">{allResults.length} results</span>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Mobile search button */}
                <button
                    className={cn(
                        "flex md:hidden items-center justify-center w-9 h-9 rounded-md border border-input",
                        "hover:bg-accent hover:text-accent-foreground transition-all duration-200",
                        "text-muted-foreground"
                    )}
                    onClick={() => { inputRef.current?.focus(); setOpen(true); }}
                >
                    <RiSearchLine className="w-4 h-4" />
                </button>

                {/* Theme Toggle */}
                {mounted && (
                    <button
                        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                        className={cn(
                            "flex items-center justify-center w-9 h-9 rounded-md border border-input",
                            "hover:bg-accent hover:text-accent-foreground transition-all duration-200",
                            "text-muted-foreground"
                        )}
                        aria-label="Toggle theme"
                    >
                        {theme === "dark" ? (
                            <RiSunLine className="w-4 h-4" />
                        ) : (
                            <RiMoonLine className="w-4 h-4" />
                        )}
                    </button>
                )}

                {/* Language Switcher */}
                <LanguageSwitcher />

                {/* Notifications */}
                <div className="relative" ref={notifRef}>
                    <button
                        onClick={() => setNotifOpen(!notifOpen)}
                        className={cn(
                            "relative flex items-center justify-center w-9 h-9 rounded-md border border-input",
                            "hover:bg-accent hover:text-accent-foreground transition-all duration-200",
                            "text-muted-foreground",
                            notifOpen && "bg-accent text-accent-foreground"
                        )}
                    >
                        <RiNotification3Line className="w-4 h-4" />
                        {unreadCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary border-2 border-background text-[9px] font-bold text-primary-foreground px-1">
                                {unreadCount > 9 ? "9+" : unreadCount}
                            </span>
                        )}
                    </button>

                    {/* Notification dropdown */}
                    {notifOpen && (
                        <div className="absolute right-0 top-[calc(100%+8px)] w-[380px] max-h-[480px] rounded-lg border border-border bg-popover shadow-xl z-50 overflow-hidden flex flex-col">
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
                                    {unreadCount > 0 && (
                                        <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                                            {unreadCount} new
                                        </span>
                                    )}
                                </div>
                                {unreadCount > 0 && (
                                    <button
                                        onClick={markAllAsRead}
                                        className="text-[11px] text-primary hover:underline font-medium"
                                    >
                                        Mark all read
                                    </button>
                                )}
                            </div>

                            {/* Notification list */}
                            <div className="flex-1 overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                        <RiNotification3Line className="w-8 h-8 mb-2 opacity-30" />
                                        <p className="text-sm">No notifications</p>
                                        <p className="text-[11px] opacity-70">You're all caught up!</p>
                                    </div>
                                ) : (
                                    notifications.map((notif) => (
                                        <div
                                            key={notif.id}
                                            className={cn(
                                                "group flex gap-3 px-4 py-3 border-b border-border/50 transition-colors cursor-pointer hover:bg-accent/50",
                                                !notif.read && "bg-primary/[0.03]"
                                            )}
                                            onClick={() => {
                                                markAsRead(notif.id);
                                                if (notif.href) {
                                                    router.push(notif.href);
                                                    setNotifOpen(false);
                                                }
                                            }}
                                        >
                                            {/* Type indicator */}
                                            <div className="mt-1.5 shrink-0">
                                                <div className={cn("w-2 h-2 rounded-full", NOTIFICATION_TYPE_STYLES[notif.type], notif.read && "opacity-30")} />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className={cn("text-sm truncate", !notif.read ? "font-semibold text-foreground" : "font-medium text-muted-foreground")}>
                                                        {notif.title}
                                                    </p>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            dismissNotification(notif.id);
                                                        }}
                                                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                                    >
                                                        <RiDeleteBinLine className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                                <p className="text-[12px] text-muted-foreground line-clamp-2 mt-0.5">
                                                    {notif.message}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <RiTimeLine className="w-3 h-3 text-muted-foreground/60" />
                                                    <span className="text-[10px] text-muted-foreground/60">{timeAgo(notif.createdAt)}</span>
                                                    {!notif.read && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                markAsRead(notif.id);
                                                            }}
                                                            className="text-[10px] text-primary hover:underline ml-auto"
                                                        >
                                                            Mark read
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Footer */}
                            {notifications.length > 0 && (
                                <div className="px-4 py-2 border-t border-border bg-muted/50">
                                    <button
                                        onClick={() => {
                                            setNotifications([]);
                                            apiFetch("http://localhost:3001/api/notifications", { method: "DELETE" }).catch(() => {});
                                            toast.info("All notifications cleared");
                                        }}
                                        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        Clear all notifications
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
