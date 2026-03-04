"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSession, signOut, authClient } from "@/lib/auth-client";
import {
    RiDashboardLine,
    RiUserSearchLine,
    RiKanbanView,
    RiContactsBook3Line,
    RiFlowChart,
    RiSettings4Line,
    RiMenuFoldLine,
    RiMenuUnfoldLine,
    RiBrainLine,
    RiRadarLine,
    RiMailLine,
    RiMegaphoneLine,
    RiBuilding2Line,
    RiMoneyDollarCircleLine,
    RiFileList3Line,
    RiWalletLine,
    RiPriceTag3Line,
    RiProjectorLine,
    RiInboxLine,
    RiPieChartLine,
    RiArrowDownSLine,
    RiTeamLine,
    RiMailSendLine,
    RiLoopLeftLine,
    RiFolderOpenLine,
    RiAddLine,
    RiCheckLine,
    RiLogoutBoxRLine,
    RiUser3Line,
    RiGroupLine,
} from "@remixicon/react";

interface NavItem {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
    group: string;
    icon: React.ComponentType<{ className?: string }>;
    items: NavItem[];
    defaultOpen?: boolean;
}

const navigation: NavSection[] = [
    {
        group: "Overview",
        icon: RiDashboardLine,
        defaultOpen: true,
        items: [
            { name: "Dashboard", href: "/", icon: RiDashboardLine },
        ],
    },
    {
        group: "Sales & Marketing",
        icon: RiMegaphoneLine,
        defaultOpen: true,
        items: [
            { name: "Lead Engine", href: "/engine", icon: RiRadarLine },
            { name: "Leads", href: "/leads", icon: RiUserSearchLine },
            { name: "Enrichment", href: "/mails", icon: RiMailLine },
            { name: "Campaigns", href: "/campaigns", icon: RiMailSendLine },
            { name: "Pipeline", href: "/pipeline", icon: RiKanbanView },
        ],
    },
    {
        group: "CRM & Clients",
        icon: RiTeamLine,
        defaultOpen: false,
        items: [
            { name: "Contacts", href: "/contacts", icon: RiContactsBook3Line },
            { name: "Companies", href: "/companies", icon: RiBuilding2Line },
            { name: "Inbox", href: "/inbox", icon: RiInboxLine },
        ],
    },
    {
        group: "Finance",
        icon: RiMoneyDollarCircleLine,
        defaultOpen: false,
        items: [
            { name: "Overview", href: "/finance", icon: RiPieChartLine },
            { name: "Invoices", href: "/invoices", icon: RiFileList3Line },
            { name: "Expenses", href: "/expenses", icon: RiWalletLine },
            { name: "Proposals", href: "/proposals", icon: RiPriceTag3Line },
            { name: "Recurring", href: "/recurring", icon: RiLoopLeftLine },
        ],
    },
    {
        group: "Operations",
        icon: RiFlowChart,
        defaultOpen: false,
        items: [
            { name: "Projects", href: "/projects", icon: RiProjectorLine },
            { name: "Files", href: "/files", icon: RiFolderOpenLine },
            { name: "Automations", href: "/automations", icon: RiFlowChart },
        ],
    },
    {
        group: "System",
        icon: RiSettings4Line,
        defaultOpen: false,
        items: [
            { name: "Settings", href: "/settings", icon: RiSettings4Line },
        ],
    },
];

export function AppSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [collapsed, setCollapsed] = React.useState(false);
    const [orgDropdownOpen, setOrgDropdownOpen] = React.useState(false);
    const [userDropdownOpen, setUserDropdownOpen] = React.useState(false);
    const orgDropdownRef = React.useRef<HTMLDivElement>(null);
    const userDropdownRef = React.useRef<HTMLDivElement>(null);

    const { data: session } = useSession();
    const { data: activeOrg } = authClient.useActiveOrganization();
    const { data: orgList } = authClient.useListOrganizations();

    // Close dropdowns on outside click
    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (orgDropdownRef.current && !orgDropdownRef.current.contains(e.target as Node)) {
                setOrgDropdownOpen(false);
            }
            if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
                setUserDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // Auto-open section that contains the active route
    const getDefaultOpenSections = () => {
        const openSet = new Set<string>();
        navigation.forEach((section) => {
            if (section.defaultOpen) openSet.add(section.group);
            section.items.forEach((item) => {
                const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                if (isActive) openSet.add(section.group);
            });
        });
        return openSet;
    };

    const [openSections, setOpenSections] = React.useState<Set<string>>(getDefaultOpenSections);

    const toggleSection = (group: string) => {
        setOpenSections((prev) => {
            const next = new Set(prev);
            if (next.has(group)) next.delete(group);
            else next.add(group);
            return next;
        });
    };

    const handleSwitchOrg = async (orgId: string) => {
        await authClient.organization.setActive({ organizationId: orgId });
        setOrgDropdownOpen(false);
        window.location.reload();
    };

    const handleSignOut = async () => {
        await signOut();
        router.push("/login");
    };

    const orgInitial = activeOrg?.name?.charAt(0)?.toUpperCase() || session?.user?.name?.charAt(0)?.toUpperCase() || "P";
    const orgName = activeOrg?.name || "Personal";

    return (
        <aside
            className={cn(
                "fixed left-0 top-0 z-40 h-screen border-r border-border bg-sidebar flex flex-col transition-all duration-300 ease-in-out",
                collapsed ? "w-[68px]" : "w-[260px]"
            )}
        >
            {/* ─── Org Switcher ─── */}
            <div className="relative shrink-0" ref={orgDropdownRef}>
                <button
                    onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
                    className={cn(
                        "flex items-center gap-3 w-full border-b border-border px-4 h-14 hover:bg-sidebar-accent/50 transition-colors",
                        collapsed && "justify-center px-0"
                    )}
                >
                    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary text-primary-foreground text-sm font-bold shrink-0">
                        {orgInitial}
                    </div>
                    {!collapsed && (
                        <>
                            <div className="flex flex-col text-left flex-1 min-w-0">
                                <span className="text-sm font-semibold tracking-tight text-sidebar-foreground truncate">
                                    {orgName}
                                </span>
                                <span className="text-[10px] text-muted-foreground truncate">
                                    {activeOrg ? `${activeOrg.members?.length || 1} members` : "Personal workspace"}
                                </span>
                            </div>
                            <RiArrowDownSLine className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0", orgDropdownOpen && "rotate-180")} />
                        </>
                    )}
                </button>

                {/* Org dropdown */}
                {orgDropdownOpen && !collapsed && (
                    <div className="absolute left-2 right-2 top-[calc(100%+4px)] z-50 rounded-lg border border-border bg-popover shadow-xl overflow-hidden">
                        <div className="px-3 py-2 border-b border-border">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Organizations</p>
                        </div>
                        <div className="py-1 max-h-48 overflow-y-auto">
                            {/* Personal workspace */}
                            <button
                                onClick={async () => { await authClient.organization.setActive({ organizationId: null as any }); setOrgDropdownOpen(false); window.location.reload(); }}
                                className={cn(
                                    "flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-accent transition-colors",
                                    !activeOrg && "bg-accent/50"
                                )}
                            >
                                <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                    {session?.user?.name?.charAt(0)?.toUpperCase() || "P"}
                                </div>
                                <span className="text-sm text-foreground flex-1 truncate">Personal</span>
                                {!activeOrg && <RiCheckLine className="w-4 h-4 text-primary shrink-0" />}
                            </button>

                            {/* Org list */}
                            {orgList?.map((org: any) => (
                                <button
                                    key={org.id}
                                    onClick={() => handleSwitchOrg(org.id)}
                                    className={cn(
                                        "flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-accent transition-colors",
                                        activeOrg?.id === org.id && "bg-accent/50"
                                    )}
                                >
                                    <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                        {org.name?.charAt(0)?.toUpperCase()}
                                    </div>
                                    <span className="text-sm text-foreground flex-1 truncate">{org.name}</span>
                                    {activeOrg?.id === org.id && <RiCheckLine className="w-4 h-4 text-primary shrink-0" />}
                                </button>
                            ))}
                        </div>
                        <div className="border-t border-border p-1">
                            <button
                                onClick={() => { router.push("/settings"); setOrgDropdownOpen(false); }}
                                className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                            >
                                <RiAddLine className="w-4 h-4" />
                                <span>Create organization</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1 scrollbar-thin">
                {navigation.map((section) => {
                    const isOpen = openSections.has(section.group);
                    const hasActiveChild = section.items.some((item) =>
                        item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
                    );

                    return (
                        <div key={section.group}>
                            {/* Section Header (clickable accordion) */}
                            {!collapsed ? (
                                <button
                                    onClick={() => toggleSection(section.group)}
                                    className={cn(
                                        "flex items-center justify-between w-full rounded-md px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors duration-150",
                                        hasActiveChild
                                            ? "text-primary"
                                            : "text-muted-foreground hover:text-sidebar-foreground"
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <section.icon className="w-3.5 h-3.5" />
                                        <span>{section.group}</span>
                                    </div>
                                    <RiArrowDownSLine
                                        className={cn(
                                            "w-3.5 h-3.5 transition-transform duration-200",
                                            isOpen ? "rotate-0" : "-rotate-90"
                                        )}
                                    />
                                </button>
                            ) : (
                                <div className="my-2 mx-auto w-6 border-t border-border/60" />
                            )}

                            {/* Section Items */}
                            <div
                                className={cn(
                                    "overflow-hidden transition-all duration-200",
                                    !collapsed && !isOpen && "max-h-0",
                                    (!collapsed && isOpen) && "max-h-[500px]",
                                    collapsed && "max-h-[500px]"
                                )}
                            >
                                <ul className="space-y-0.5 mt-0.5">
                                    {section.items.map((item) => {
                                        const isActive =
                                            item.href === "/"
                                                ? pathname === "/"
                                                : pathname.startsWith(item.href);
                                        return (
                                            <li key={item.name}>
                                                <Link
                                                    href={item.href}
                                                    className={cn(
                                                        "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-all duration-150",
                                                        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                                        isActive
                                                            ? "bg-primary/10 text-primary font-semibold"
                                                            : "text-sidebar-foreground/70",
                                                        collapsed && "justify-center px-0",
                                                        !collapsed && "ml-2"
                                                    )}
                                                    title={collapsed ? item.name : undefined}
                                                >
                                                    <item.icon className={cn("w-[17px] h-[17px] shrink-0", isActive && "text-primary")} />
                                                    {!collapsed && <span>{item.name}</span>}
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        </div>
                    );
                })}
            </nav>

            {/* ─── User & Collapse ─── */}
            <div className="border-t border-border shrink-0">
                {/* User */}
                <div className="relative" ref={userDropdownRef}>
                    <button
                        onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                        className={cn(
                            "flex items-center gap-3 w-full px-3 py-2.5 hover:bg-sidebar-accent transition-colors",
                            collapsed && "justify-center px-0"
                        )}
                    >
                        <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                            <span className="text-xs font-semibold text-primary">
                                {session?.user?.name?.charAt(0)?.toUpperCase() || "?"}
                            </span>
                        </div>
                        {!collapsed && (
                            <div className="flex flex-col text-left flex-1 min-w-0">
                                <span className="text-sm font-medium text-sidebar-foreground truncate">
                                    {session?.user?.name || "User"}
                                </span>
                                <span className="text-[10px] text-muted-foreground truncate">
                                    {session?.user?.email || ""}
                                </span>
                            </div>
                        )}
                    </button>

                    {/* User dropdown */}
                    {userDropdownOpen && !collapsed && (
                        <div className="absolute left-2 right-2 bottom-[calc(100%+4px)] z-50 rounded-lg border border-border bg-popover shadow-xl overflow-hidden">
                            <div className="px-3 py-2 border-b border-border">
                                <p className="text-sm font-medium text-foreground truncate">{session?.user?.name}</p>
                                <p className="text-[11px] text-muted-foreground truncate">{session?.user?.email}</p>
                            </div>
                            <div className="py-1">
                                <button
                                    onClick={() => { router.push("/settings"); setUserDropdownOpen(false); }}
                                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                                >
                                    <RiUser3Line className="w-4 h-4 text-muted-foreground" />
                                    Profile & Settings
                                </button>
                                <button
                                    onClick={() => { router.push("/settings"); setUserDropdownOpen(false); }}
                                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                                >
                                    <RiGroupLine className="w-4 h-4 text-muted-foreground" />
                                    Manage Organization
                                </button>
                            </div>
                            <div className="border-t border-border py-1">
                                <button
                                    onClick={handleSignOut}
                                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-500 hover:bg-accent transition-colors"
                                >
                                    <RiLogoutBoxRLine className="w-4 h-4" />
                                    Sign out
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Collapse toggle */}
                <div className="px-3 pb-2">
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150 w-full",
                            "hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground",
                            collapsed && "justify-center px-0"
                        )}
                    >
                        {collapsed ? (
                            <RiMenuUnfoldLine className="w-[18px] h-[18px]" />
                        ) : (
                            <>
                                <RiMenuFoldLine className="w-[18px] h-[18px]" />
                                <span>Collapse</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </aside>
    );
}
