"use client";

import * as React from "react";
import { AppHeader } from "@/components/app-header";
import { cn } from "@/lib/utils";
import { ScrapedLead, EmailResult, EmailVerificationStatus } from "@/lib/types";
import {
    RiSearchLine,
    RiRadarLine,
    RiMailLine,
    RiCheckboxCircleLine,
    RiCloseLine,
    RiQuestionLine,
    RiAlertLine,
    RiLinkedinBoxFill,
    RiAddLine,
    RiLoader4Line,
    RiExternalLinkLine,
    RiShieldCheckLine,
    RiArrowRightLine,
    RiEditLine,
} from "@remixicon/react";

const emailStatusConfig: Record<EmailVerificationStatus, { label: string; color: string; icon: React.ReactNode }> = {
    valid: {
        label: "Valid",
        color: "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10",
        icon: <RiCheckboxCircleLine className="w-3 h-3" />,
    },
    invalid: {
        label: "Invalid",
        color: "text-rose-700 dark:text-rose-400 bg-rose-500/10",
        icon: <RiCloseLine className="w-3 h-3" />,
    },
    catch_all: {
        label: "Catch-All",
        color: "text-amber-700 dark:text-amber-400 bg-amber-500/10",
        icon: <RiAlertLine className="w-3 h-3" />,
    },
    unknown: {
        label: "Unknown",
        color: "text-stone-600 dark:text-stone-400 bg-stone-500/10",
        icon: <RiQuestionLine className="w-3 h-3" />,
    },
    unverified: {
        label: "Unverified",
        color: "text-stone-500 dark:text-stone-400 bg-stone-500/10",
        icon: <RiQuestionLine className="w-3 h-3" />,
    },
    error: {
        label: "Error",
        color: "text-rose-600 dark:text-rose-400 bg-rose-500/10",
        icon: <RiAlertLine className="w-3 h-3" />,
    },
};

const SCRAPER_API = process.env.NEXT_PUBLIC_SCRAPER_URL || "http://localhost:3001";

export default function LeadEnginePage() {
    const [jobTitle, setJobTitle] = React.useState("");
    const [location, setLocation] = React.useState("");
    const [industry, setIndustry] = React.useState("");
    const [keywords, setKeywords] = React.useState("");
    const [searching, setSearching] = React.useState(false);
    const [results, setResults] = React.useState<ScrapedLead[]>([]);
    const [searchDone, setSearchDone] = React.useState(false);
    const [findingEmail, setFindingEmail] = React.useState<string | null>(null);
    const [emailResults, setEmailResults] = React.useState<Record<string, EmailResult[]>>({});
    const [expandedRow, setExpandedRow] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    // Search and Edit state
    const [localSearch, setLocalSearch] = React.useState("");
    const [editIndex, setEditIndex] = React.useState<number | null>(null);
    const [editLeadData, setEditLeadData] = React.useState<Partial<ScrapedLead>>({});

    const filteredResults = React.useMemo(() => {
        if (!localSearch.trim()) return results;
        const lower = localSearch.toLowerCase();
        return results.filter(
            (r) =>
                r.name?.toLowerCase().includes(lower) ||
                r.company?.toLowerCase().includes(lower) ||
                r.title?.toLowerCase().includes(lower) ||
                r.email?.toLowerCase().includes(lower)
        );
    }, [results, localSearch]);

    const handleSaveEdit = () => {
        if (editIndex === null) return;
        setResults((prev) =>
            prev.map((l, idx) => (idx === editIndex ? { ...l, ...editLeadData } as ScrapedLead : l))
        );
        setEditIndex(null);
        setEditLeadData({});
    };

    const handleSearch = async () => {
        if (!jobTitle.trim()) return;

        setSearching(true);
        setSearchDone(false);
        setResults([]);
        setEmailResults({});
        setError(null);

        try {
            const res = await fetch(`${SCRAPER_API}/api/search/xray`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jobTitle: jobTitle.trim(),
                    location: location.trim() || undefined,
                    industry: industry.trim() || undefined,
                    keywords: keywords.trim() || undefined,
                    maxResults: 20,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || data.error || "Search failed");
            }

            setResults(data.leads || []);
            setSearchDone(true);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Search failed";
            setError(message);
        } finally {
            setSearching(false);
        }
    };

    const handleFindEmail = async (lead: ScrapedLead, index: number) => {
        const key = `${lead.name}-${index}`;
        setFindingEmail(key);

        try {
            const nameParts = lead.name.split(" ");
            const firstName = nameParts[0] || "";
            const lastName = nameParts.slice(1).join(" ") || "";

            const res = await fetch(`${SCRAPER_API}/api/email/find`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    firstName,
                    lastName,
                    company: lead.company,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || data.error || "Email search failed");
            }

            setEmailResults((prev) => ({ ...prev, [key]: data.results || [] }));
            setExpandedRow(key);

            // Update the lead with the best email found
            const bestEmail = data.results?.find(
                (r: EmailResult) => r.status === "valid" || r.status === "catch_all"
            );
            if (bestEmail) {
                setResults((prev) =>
                    prev.map((l, i) =>
                        i === index
                            ? { ...l, email: bestEmail.email, emailStatus: bestEmail.status }
                            : l
                    )
                );
            }
        } catch (err: unknown) {
            console.error("Email finding error:", err);
        } finally {
            setFindingEmail(null);
        }
    };

    const handleAddToCrm = (_lead: ScrapedLead, index: number) => {
        setResults((prev) =>
            prev.map((l, i) => (i === index ? { ...l, addedToCrm: true } : l))
        );
    };

    return (
        <>
            <AppHeader title="Lead Engine" subtitle="Find leads without paid APIs" />
            <div className="p-6 space-y-6">
                {/* Search Panel */}
                <div className="rounded-xl border border-border bg-card p-6 animate-fade-in">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <RiRadarLine className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-foreground">
                                LinkedIn X-Ray Search
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                Find professionals via Google — no API keys required
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-foreground">
                                Job Title *
                            </label>
                            <input
                                type="text"
                                value={jobTitle}
                                onChange={(e) => setJobTitle(e.target.value)}
                                placeholder='e.g. "Marketing Director"'
                                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/40 transition-all"
                                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-foreground">
                                Location
                            </label>
                            <input
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder='e.g. "London" or "United States"'
                                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/40 transition-all"
                                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-foreground">
                                Industry
                            </label>
                            <input
                                type="text"
                                value={industry}
                                onChange={(e) => setIndustry(e.target.value)}
                                placeholder='e.g. "SaaS" or "Healthcare"'
                                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/40 transition-all"
                                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-foreground">
                                Keywords
                            </label>
                            <input
                                type="text"
                                value={keywords}
                                onChange={(e) => setKeywords(e.target.value)}
                                placeholder="Additional search terms"
                                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/40 transition-all"
                                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSearch}
                            disabled={searching || !jobTitle.trim()}
                            className={cn(
                                "flex items-center gap-2 h-9 px-5 rounded-md bg-primary text-primary-foreground text-sm font-medium transition-colors",
                                searching || !jobTitle.trim()
                                    ? "opacity-50 cursor-not-allowed"
                                    : "hover:bg-primary/90"
                            )}
                        >
                            {searching ? (
                                <>
                                    <RiLoader4Line className="w-4 h-4 animate-spin" />
                                    Searching...
                                </>
                            ) : (
                                <>
                                    <RiSearchLine className="w-4 h-4" />
                                    Search Leads
                                </>
                            )}
                        </button>

                        {searching && (
                            <p className="text-xs text-muted-foreground animate-pulse">
                                Scraping Google results... this may take 10-30 seconds
                            </p>
                        )}
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 animate-fade-in-scale">
                        <div className="flex items-center gap-2">
                            <RiAlertLine className="w-4 h-4 text-destructive" />
                            <p className="text-sm font-medium text-destructive">
                                Search Error
                            </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{error}</p>
                    </div>
                )}

                {/* Results */}
                {searchDone && (
                    <div className="space-y-3 animate-fade-in">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <h3 className="text-sm font-semibold text-foreground">
                                Results{" "}
                                <span className="text-muted-foreground font-normal">
                                    ({filteredResults.length} leads found)
                                </span>
                            </h3>
                            <div>
                                <div className="relative">
                                    <RiSearchLine className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder="Search by name, company..."
                                        value={localSearch}
                                        onChange={(e) => setLocalSearch(e.target.value)}
                                        className="h-8 w-full sm:w-64 rounded-md border border-input bg-background pl-8 pr-3 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/40 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {filteredResults.length === 0 ? (
                            <div className="rounded-xl border border-border bg-card p-12 text-center">
                                <RiSearchLine className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                                <p className="text-sm font-medium text-muted-foreground">
                                    No results found
                                </p>
                                <p className="text-xs text-muted-foreground/60 mt-1">
                                    Try broadening your search criteria
                                </p>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-border bg-card overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-border bg-muted/30">
                                                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                    Person
                                                </th>
                                                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                    Company
                                                </th>
                                                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                                                    Email
                                                </th>
                                                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                    LinkedIn
                                                </th>
                                                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredResults.map((lead) => {
                                                const originalIndex = results.indexOf(lead);
                                                const key = `${lead.name}-${originalIndex}`;
                                                const isFinding = findingEmail === key;
                                                const hasEmailResults = emailResults[key];
                                                const isExpanded = expandedRow === key;

                                                return (
                                                    <React.Fragment key={key}>
                                                        <tr
                                                            className={cn(
                                                                "border-b border-border/60 hover:bg-muted/30 transition-colors animate-fade-in",
                                                                isExpanded && "bg-muted/20"
                                                            )}
                                                            style={{ animationDelay: `${originalIndex * 0.03}s` }}
                                                        >
                                                            {/* Person */}
                                                            <td className="py-3 px-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                                                        {lead.name
                                                                            .split(" ")
                                                                            .map((n) => n[0])
                                                                            .join("")
                                                                            .slice(0, 2)}
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-medium text-foreground">
                                                                            {lead.name}
                                                                        </p>
                                                                        <p className="text-xs text-muted-foreground">
                                                                            {lead.title}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            {/* Company */}
                                                            <td className="py-3 px-4">
                                                                <span className="text-sm text-foreground">
                                                                    {lead.company || "—"}
                                                                </span>
                                                            </td>

                                                            {/* Email */}
                                                            <td className="py-3 px-4 hidden lg:table-cell">
                                                                {lead.email ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-mono text-foreground">
                                                                            {lead.email}
                                                                        </span>
                                                                        {lead.emailStatus && (
                                                                            <span
                                                                                className={cn(
                                                                                    "flex items-center gap-1 text-[10px] font-medium rounded-full px-1.5 py-0.5",
                                                                                    emailStatusConfig[lead.emailStatus]
                                                                                        .color
                                                                                )}
                                                                            >
                                                                                {emailStatusConfig[lead.emailStatus].icon}
                                                                                {emailStatusConfig[lead.emailStatus].label}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-xs text-muted-foreground/50">
                                                                        Not found yet
                                                                    </span>
                                                                )}
                                                            </td>

                                                            {/* LinkedIn */}
                                                            <td className="py-3 px-4">
                                                                <a
                                                                    href={lead.linkedinUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                                                >
                                                                    <RiLinkedinBoxFill className="w-3.5 h-3.5" />
                                                                    Profile
                                                                    <RiExternalLinkLine className="w-2.5 h-2.5" />
                                                                </a>
                                                            </td>

                                                            <td className="py-3 px-4 text-right">
                                                                <div className="flex items-center justify-end gap-1.5">
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditIndex(originalIndex);
                                                                            setEditLeadData({ ...lead });
                                                                        }}
                                                                        className="flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-input text-xs font-medium transition-colors hover:bg-muted hover:text-foreground text-muted-foreground"
                                                                    >
                                                                        <RiEditLine className="w-3 h-3" />
                                                                        Edit
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleFindEmail(lead, originalIndex)}
                                                                        disabled={isFinding}
                                                                        className={cn(
                                                                            "flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-input text-xs font-medium transition-colors",
                                                                            isFinding
                                                                                ? "opacity-50 cursor-not-allowed"
                                                                                : "hover:bg-muted hover:text-foreground text-muted-foreground"
                                                                        )}
                                                                    >
                                                                        {isFinding ? (
                                                                            <RiLoader4Line className="w-3 h-3 animate-spin" />
                                                                        ) : (
                                                                            <RiMailLine className="w-3 h-3" />
                                                                        )}
                                                                        {hasEmailResults ? "Retry" : "Find Email"}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleAddToCrm(lead, originalIndex)}
                                                                        disabled={lead.addedToCrm}
                                                                        className={cn(
                                                                            "flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium transition-colors",
                                                                            lead.addedToCrm
                                                                                ? "bg-primary/10 text-primary cursor-default"
                                                                                : "bg-primary text-primary-foreground hover:bg-primary/90"
                                                                        )}
                                                                    >
                                                                        {lead.addedToCrm ? (
                                                                            <>
                                                                                <RiCheckboxCircleLine className="w-3 h-3" />
                                                                                Added
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <RiAddLine className="w-3 h-3" />
                                                                                Add to CRM
                                                                            </>
                                                                        )}
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>

                                                        {/* Expanded Email Results */}
                                                        {isExpanded && hasEmailResults && (
                                                            <tr className="animate-fade-in-scale">
                                                                <td colSpan={5} className="px-4 py-3 bg-muted/10">
                                                                    <div className="ml-11">
                                                                        <div className="flex items-center gap-2 mb-2">
                                                                            <RiShieldCheckLine className="w-3.5 h-3.5 text-primary" />
                                                                            <span className="text-xs font-semibold text-foreground">
                                                                                Email Verification Results
                                                                            </span>
                                                                            <button
                                                                                onClick={() => setExpandedRow(null)}
                                                                                className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                                                                            >
                                                                                Collapse
                                                                            </button>
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            {emailResults[key].map(
                                                                                (result: EmailResult, j: number) => (
                                                                                    <div
                                                                                        key={j}
                                                                                        className="flex items-center justify-between py-1.5 px-3 rounded-md hover:bg-muted/30"
                                                                                    >
                                                                                        <div className="flex items-center gap-3">
                                                                                            <span className="text-xs font-mono text-foreground">
                                                                                                {result.email}
                                                                                            </span>
                                                                                            <span className="text-[10px] text-muted-foreground">
                                                                                                ({result.pattern})
                                                                                            </span>
                                                                                        </div>
                                                                                        <span
                                                                                            className={cn(
                                                                                                "flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5",
                                                                                                emailStatusConfig[result.status]
                                                                                                    ?.color ||
                                                                                                emailStatusConfig.unverified
                                                                                                    .color
                                                                                            )}
                                                                                        >
                                                                                            {emailStatusConfig[result.status]
                                                                                                ?.icon ||
                                                                                                emailStatusConfig.unverified
                                                                                                    .icon}
                                                                                            {emailStatusConfig[result.status]
                                                                                                ?.label ||
                                                                                                result.status}
                                                                                        </span>
                                                                                    </div>
                                                                                )
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* How It Works */}
                {!searchDone && !searching && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in stagger-2">
                        {[
                            {
                                step: "1",
                                title: "X-Ray Search",
                                desc: "Google searches for LinkedIn profiles matching your criteria. No LinkedIn login needed.",
                                icon: <RiSearchLine className="w-5 h-5" />,
                            },
                            {
                                step: "2",
                                title: "Find & Verify Email",
                                desc: "Generates email patterns from name + company, then verifies via SMTP — completely free.",
                                icon: <RiMailLine className="w-5 h-5" />,
                            },
                            {
                                step: "3",
                                title: "Add to CRM",
                                desc: "One click to add verified leads to your pipeline. Ready for outreach.",
                                icon: <RiArrowRightLine className="w-5 h-5" />,
                            },
                        ].map((item) => (
                            <div
                                key={item.step}
                                className="rounded-xl border border-border bg-card p-5 group hover:border-primary/30 transition-all"
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/15 transition-colors">
                                        {item.icon}
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                        Step {item.step}
                                    </span>
                                </div>
                                <h3 className="text-sm font-semibold text-foreground mb-1">
                                    {item.title}
                                </h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {item.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Edit Modal */}
                {editIndex !== null && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in">
                        <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-scale">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                                <h2 className="text-sm font-semibold text-foreground">Edit Result</h2>
                                <button onClick={() => { setEditIndex(null); setEditLeadData({}); }} className="w-7 h-7 rounded flex items-center justify-center hover:bg-muted"><RiCloseLine className="w-4 h-4" /></button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-foreground">Name</label>
                                    <input value={editLeadData.name || ""} onChange={(e) => setEditLeadData({ ...editLeadData, name: e.target.value })}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-foreground">Company</label>
                                    <input value={editLeadData.company || ""} onChange={(e) => setEditLeadData({ ...editLeadData, company: e.target.value })}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-foreground">Job Title</label>
                                    <input value={editLeadData.title || ""} onChange={(e) => setEditLeadData({ ...editLeadData, title: e.target.value })}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-foreground">LinkedIn URL</label>
                                    <input value={editLeadData.linkedinUrl || ""} onChange={(e) => setEditLeadData({ ...editLeadData, linkedinUrl: e.target.value })}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 px-6 py-3 border-t border-border bg-muted/10">
                                <button onClick={() => { setEditIndex(null); setEditLeadData({}); }} className="h-8 px-4 rounded-md border border-input text-xs font-medium hover:bg-muted transition-colors">Cancel</button>
                                <button onClick={handleSaveEdit} className="h-8 px-5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
