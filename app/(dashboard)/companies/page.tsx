"use client";

import * as React from "react";
import { AppHeader } from "@/components/app-header";
import { cn } from "@/lib/utils";
import {
    RiAddLine,
    RiLoader4Line,
    RiCloseLine,
    RiDeleteBinLine,
    RiSearchLine,
    RiBuilding2Line,
    RiGlobalLine,
    RiTeamLine,
    RiPhoneLine,
    RiMapPinLine,
} from "@remixicon/react";

interface Company {
    id: string;
    name: string;
    domain: string | null;
    industry: string | null;
    size: string | null;
    website: string | null;
    phone: string | null;
    address: string | null;
    notes: string | null;
    _count: { contacts: number };
    createdAt: string;
}

const sizeLabels: Record<string, string> = {
    "1-10": "1-10 employees",
    "11-50": "11-50 employees",
    "51-200": "51-200 employees",
    "201-500": "201-500 employees",
    "500+": "500+ employees",
};

import { API, apiFetch } from "@/lib/api";
import { toast } from "sonner";

export default function CompaniesPage() {
    const [companies, setCompanies] = React.useState<Company[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [search, setSearch] = React.useState("");
    const [showModal, setShowModal] = React.useState(false);
    const [saving, setSaving] = React.useState(false);

    // Form
    const [name, setName] = React.useState("");
    const [domain, setDomain] = React.useState("");
    const [industry, setIndustry] = React.useState("");
    const [size, setSize] = React.useState("");
    const [website, setWebsite] = React.useState("");
    const [phone, setPhone] = React.useState("");
    const [address, setAddress] = React.useState("");
    const [notes, setNotes] = React.useState("");

    const fetchCompanies = async () => {
        try {
            const res = await apiFetch(`${API}/api/companies`);
            const data = await res.json();
            if (data.success) setCompanies(data.companies);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    React.useEffect(() => { fetchCompanies(); }, []);

    const filtered = React.useMemo(() => {
        if (!search.trim()) return companies;
        const q = search.toLowerCase();
        return companies.filter((c) =>
            c.name.toLowerCase().includes(q) ||
            (c.industry && c.industry.toLowerCase().includes(q)) ||
            (c.domain && c.domain.toLowerCase().includes(q))
        );
    }, [companies, search]);

    const handleCreate = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            const res = await apiFetch(`${API}/api/companies`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    domain: domain.trim() || null,
                    industry: industry.trim() || null,
                    size: size || null,
                    website: website.trim() || null,
                    phone: phone.trim() || null,
                    address: address.trim() || null,
                    notes: notes.trim() || null,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setCompanies((prev) => [{ ...data.company, _count: { contacts: 0 } }, ...prev]);
                setShowModal(false);
                resetForm();
                toast.success("Company created.");
            }
        } catch (err) { console.error(err); toast.error("Failed to create company."); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id: string) => {
        setCompanies((prev) => prev.filter((c) => c.id !== id));
        try { await apiFetch(`${API}/api/companies/${id}`, { method: "DELETE" }); toast.success("Company deleted."); }
        catch { fetchCompanies(); toast.error("Failed to delete company."); }
    };

    const resetForm = () => {
        setName(""); setDomain(""); setIndustry(""); setSize("");
        setWebsite(""); setPhone(""); setAddress(""); setNotes("");
    };

    if (loading) {
        return (
            <>
                <AppHeader title="Companies" subtitle="Manage your accounts" />
                <div className="flex items-center justify-center h-[60vh]">
                    <RiLoader4Line className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            </>
        );
    }

    return (
        <>
            <AppHeader title="Companies" subtitle={`${companies.length} companies`} />
            <div className="p-6 space-y-6">
                {/* Toolbar */}
                <div className="flex items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search companies..."
                            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" />
                    </div>
                    <button onClick={() => { resetForm(); setShowModal(true); }}
                        className="flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0">
                        <RiAddLine className="w-4 h-4" /> Add Company
                    </button>
                </div>

                {/* Companies Table */}
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Company</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Industry</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Size</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Website</th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contacts</th>
                                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[60px]"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 && (
                                <tr><td colSpan={6} className="py-12 text-center text-muted-foreground/60 text-sm">
                                    <RiBuilding2Line className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" />
                                    No companies found
                                </td></tr>
                            )}
                            {filtered.map((co, i) => (
                                <tr key={co.id}
                                    className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors animate-fade-in"
                                    style={{ animationDelay: `${i * 0.03}s` }}>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                                                {co.name.slice(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-foreground text-sm">{co.name}</p>
                                                {co.domain && <p className="text-[10px] text-muted-foreground">{co.domain}</p>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-muted-foreground text-xs hidden md:table-cell">{co.industry || "—"}</td>
                                    <td className="py-3 px-4 hidden lg:table-cell">
                                        {co.size ? (
                                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                                <RiTeamLine className="w-3 h-3" />
                                                {sizeLabels[co.size] || co.size}
                                            </span>
                                        ) : "—"}
                                    </td>
                                    <td className="py-3 px-4 hidden lg:table-cell">
                                        {co.website ? (
                                            <a href={co.website.startsWith("http") ? co.website : `https://${co.website}`} target="_blank" rel="noopener"
                                                className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                                                <RiGlobalLine className="w-3 h-3" />
                                                {co.website.replace(/^https?:\/\//, "")}
                                            </a>
                                        ) : <span className="text-xs text-muted-foreground">—</span>}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                                            {co._count.contacts}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <button onClick={() => handleDelete(co.id)}
                                            className="p-1.5 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors">
                                            <RiDeleteBinLine className="w-3.5 h-3.5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ─── Add Company Modal ─── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
                    <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h3 className="text-sm font-semibold text-foreground">New Company</h3>
                            <button onClick={() => setShowModal(false)} className="p-1 rounded-md hover:bg-muted"><RiCloseLine className="w-4 h-4 text-muted-foreground" /></button>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground">Company Name *</label>
                                <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus
                                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="Acme Corporation" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Domain</label>
                                    <input type="text" value={domain} onChange={(e) => setDomain(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="acme.com" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Industry</label>
                                    <input type="text" value={industry} onChange={(e) => setIndustry(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="Technology" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Size</label>
                                    <select value={size} onChange={(e) => setSize(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30">
                                        <option value="">Select size</option>
                                        <option value="1-10">1-10</option>
                                        <option value="11-50">11-50</option>
                                        <option value="51-200">51-200</option>
                                        <option value="201-500">201-500</option>
                                        <option value="500+">500+</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Website</label>
                                    <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="https://acme.com" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Phone</label>
                                    <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="+1 555 123 4567" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Address</label>
                                    <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="123 Main St, NY" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground">Notes</label>
                                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="Optional notes..." />
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
                            <button onClick={() => setShowModal(false)} className="h-9 px-4 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancel</button>
                            <button onClick={handleCreate} disabled={!name.trim() || saving}
                                className="flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                                {saving && <RiLoader4Line className="w-4 h-4 animate-spin" />}
                                Add Company
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
