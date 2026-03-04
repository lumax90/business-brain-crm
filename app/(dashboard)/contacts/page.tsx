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
    RiMailLine,
    RiPhoneLine,
    RiUser3Line,
    RiBuilding2Line,
    RiPencilLine,
    RiSaveLine,
    RiCalendarLine,
    RiFileList3Line,
    RiArrowLeftLine,
} from "@remixicon/react";

interface Company {
    id: string;
    name: string;
}

interface Contact {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    role: string | null;
    tags: string;
    notes: string | null;
    source: string;
    company: Company | null;
    companyId: string | null;
    lastContactedAt: string | null;
    createdAt: string;
}

import { API, apiFetch } from "@/lib/api";
import { toast } from "sonner";

export default function ContactsPage() {
    const [contacts, setContacts] = React.useState<Contact[]>([]);
    const [companies, setCompanies] = React.useState<Company[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [search, setSearch] = React.useState("");
    const [showModal, setShowModal] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [selectedContact, setSelectedContact] = React.useState<Contact | null>(null);
    const [editing, setEditing] = React.useState(false);
    const [editForm, setEditForm] = React.useState<Partial<Contact>>({});

    // Form
    const [name, setName] = React.useState("");
    const [email, setEmail] = React.useState("");
    const [phone, setPhone] = React.useState("");
    const [role, setRole] = React.useState("");
    const [companyId, setCompanyId] = React.useState("");
    const [notes, setNotes] = React.useState("");

    const fetchData = async () => {
        try {
            const [cRes, coRes] = await Promise.all([
                apiFetch(`${API}/api/contacts`).then((r) => r.json()),
                apiFetch(`${API}/api/companies`).then((r) => r.json()),
            ]);
            if (cRes.success) setContacts(cRes.contacts);
            if (coRes.success) setCompanies(coRes.companies);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    React.useEffect(() => { fetchData(); }, []);

    const filtered = React.useMemo(() => {
        if (!search.trim()) return contacts;
        const q = search.toLowerCase();
        return contacts.filter((c) =>
            c.name.toLowerCase().includes(q) ||
            (c.email && c.email.toLowerCase().includes(q)) ||
            (c.company && c.company.name.toLowerCase().includes(q)) ||
            (c.role && c.role.toLowerCase().includes(q))
        );
    }, [contacts, search]);

    const handleCreate = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            const res = await apiFetch(`${API}/api/contacts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    email: email.trim() || null,
                    phone: phone.trim() || null,
                    role: role.trim() || null,
                    companyId: companyId || null,
                    notes: notes.trim() || null,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setContacts((prev) => [data.contact, ...prev]);
                setShowModal(false);
                resetForm();
                toast.success("Contact created.");
            }
        } catch (err) { console.error(err); toast.error("Failed to create contact."); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id: string) => {
        setContacts((prev) => prev.filter((c) => c.id !== id));
        if (selectedContact?.id === id) setSelectedContact(null);
        try {
            await apiFetch(`${API}/api/contacts/${id}`, { method: "DELETE" });
            toast.success("Contact deleted.");
        }
        catch { toast.error("Failed to delete contact."); fetchData(); }
    };

    const openDetail = (contact: Contact) => {
        setSelectedContact(contact);
        setEditing(false);
        setEditForm({});
    };

    const startEditing = () => {
        if (!selectedContact) return;
        setEditForm({
            name: selectedContact.name,
            email: selectedContact.email,
            phone: selectedContact.phone,
            role: selectedContact.role,
            companyId: selectedContact.companyId,
            notes: selectedContact.notes,
        });
        setEditing(true);
    };

    const handleUpdate = async () => {
        if (!selectedContact || !editForm.name?.trim()) return;
        setSaving(true);
        try {
            const res = await apiFetch(`${API}/api/contacts/${selectedContact.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: editForm.name?.trim(),
                    email: editForm.email?.trim() || null,
                    phone: editForm.phone?.trim() || null,
                    role: editForm.role?.trim() || null,
                    companyId: editForm.companyId || null,
                    notes: editForm.notes?.trim() || null,
                }),
            });
            const data = await res.json();
            if (data.success) {
                const updated = data.contact;
                setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
                setSelectedContact(updated);
                setEditing(false);
                toast.success("Contact updated.");
            }
        } catch (err) { console.error(err); toast.error("Failed to update contact."); }
        finally { setSaving(false); }
    };

    const resetForm = () => {
        setName(""); setEmail(""); setPhone(""); setRole(""); setCompanyId(""); setNotes("");
    };

    const parseTags = (tagsStr: string): string[] => {
        try { return JSON.parse(tagsStr); } catch { return []; }
    };

    if (loading) {
        return (
            <>
                <AppHeader title="Contacts" subtitle="Your CRM contacts" />
                <div className="flex items-center justify-center h-[60vh]">
                    <RiLoader4Line className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            </>
        );
    }

    return (
        <>
            <AppHeader title="Contacts" subtitle={`${contacts.length} contacts`} />
            <div className="p-6 space-y-6">
                {/* Toolbar */}
                <div className="flex items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search contacts..."
                            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                        />
                    </div>
                    <button onClick={() => { resetForm(); setShowModal(true); }}
                        className="flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0">
                        <RiAddLine className="w-4 h-4" /> Add Contact
                    </button>
                </div>

                {/* Contact Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filtered.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground/60">
                            <RiUser3Line className="w-8 h-8 mb-2" />
                            <p className="text-sm">No contacts found</p>
                        </div>
                    )}
                    {filtered.map((contact, i) => {
                        const tags = parseTags(contact.tags);
                        const initials = contact.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                        const isSelected = selectedContact?.id === contact.id;
                        return (
                            <div
                                key={contact.id}
                                onClick={() => openDetail(contact)}
                                className={cn(
                                    "group rounded-xl border bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all animate-fade-in cursor-pointer",
                                    isSelected ? "border-primary/50 ring-1 ring-primary/20" : "border-border"
                                )}
                                style={{ animationDelay: `${i * 0.04}s` }}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                                            {initials}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">{contact.name}</p>
                                            {contact.role && <p className="text-xs text-muted-foreground">{contact.role}</p>}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(contact.id); }}
                                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-muted-foreground/40 hover:text-rose-500 transition-all"
                                    >
                                        <RiDeleteBinLine className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                {contact.company && (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                                        <RiBuilding2Line className="w-3 h-3" />
                                        {contact.company.name}
                                    </div>
                                )}

                                <div className="space-y-1 mb-3">
                                    {contact.email && (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <RiMailLine className="w-3 h-3 shrink-0" />
                                            <span className="truncate">{contact.email}</span>
                                        </div>
                                    )}
                                    {contact.phone && (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <RiPhoneLine className="w-3 h-3 shrink-0" />
                                            <span>{contact.phone}</span>
                                        </div>
                                    )}
                                </div>

                                {tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {tags.slice(0, 3).map((tag: string) => (
                                            <span key={tag} className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                                                {tag}
                                            </span>
                                        ))}
                                        {tags.length > 3 && (
                                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground/60">
                                                +{tags.length - 3}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ─── Contact Detail Panel ─── */}
            {selectedContact && (
                <div className="fixed inset-0 z-40 flex justify-end" onClick={() => { setSelectedContact(null); setEditing(false); }}>
                    <div className="absolute inset-0 bg-black/30 animate-fade-in" />
                    <div
                        className="relative w-full max-w-md bg-card border-l border-border shadow-xl h-full overflow-y-auto animate-in slide-in-from-right-5 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
                            <div className="flex items-center gap-2">
                                <button onClick={() => { setSelectedContact(null); setEditing(false); }}
                                    className="p-1 rounded-md hover:bg-muted"><RiArrowLeftLine className="w-4 h-4 text-muted-foreground" /></button>
                                <h3 className="text-sm font-semibold text-foreground">Contact Details</h3>
                            </div>
                            <div className="flex items-center gap-1">
                                {!editing ? (
                                    <button onClick={startEditing}
                                        className="flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                                        <RiPencilLine className="w-3.5 h-3.5" /> Edit
                                    </button>
                                ) : (
                                    <>
                                        <button onClick={() => setEditing(false)}
                                            className="h-8 px-3 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancel</button>
                                        <button onClick={handleUpdate} disabled={saving}
                                            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                                            {saving ? <RiLoader4Line className="w-3.5 h-3.5 animate-spin" /> : <RiSaveLine className="w-3.5 h-3.5" />} Save
                                        </button>
                                    </>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(selectedContact.id); }}
                                    className="p-1.5 rounded-md text-muted-foreground/40 hover:text-rose-500 hover:bg-rose-500/10 transition-all">
                                    <RiDeleteBinLine className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Avatar + Name */}
                        <div className="flex flex-col items-center py-6 border-b border-border">
                            {(() => {
                                const initials = selectedContact.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                                return (
                                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold mb-3">
                                        {initials}
                                    </div>
                                );
                            })()}
                            {!editing ? (
                                <>
                                    <p className="text-base font-semibold text-foreground">{selectedContact.name}</p>
                                    {selectedContact.role && <p className="text-sm text-muted-foreground mt-0.5">{selectedContact.role}</p>}
                                    {selectedContact.company && (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                                            <RiBuilding2Line className="w-3 h-3" /> {selectedContact.company.name}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="w-full px-5 space-y-2 mt-1">
                                    <input type="text" value={editForm.name || ""} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="Name" />
                                    <input type="text" value={editForm.role || ""} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                                        className="h-8 w-full rounded-md border border-input bg-background px-3 text-xs text-center focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="Role" />
                                    <select value={editForm.companyId || ""} onChange={(e) => setEditForm((f) => ({ ...f, companyId: e.target.value }))}
                                        className="h-8 w-full rounded-md border border-input bg-background px-3 text-xs text-center focus:outline-none focus:ring-2 focus:ring-ring/30">
                                        <option value="">No company</option>
                                        {companies.map((co) => <option key={co.id} value={co.id}>{co.name}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* Info Fields */}
                        <div className="p-5 space-y-4">
                            {/* Email */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Email</label>
                                {!editing ? (
                                    <div className="flex items-center gap-2 text-sm text-foreground">
                                        <RiMailLine className="w-3.5 h-3.5 text-muted-foreground" />
                                        {selectedContact.email ? (
                                            <a href={`mailto:${selectedContact.email}`} className="hover:text-primary hover:underline">{selectedContact.email}</a>
                                        ) : <span className="text-muted-foreground/50">—</span>}
                                    </div>
                                ) : (
                                    <input type="email" value={editForm.email || ""} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="email@example.com" />
                                )}
                            </div>

                            {/* Phone */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Phone</label>
                                {!editing ? (
                                    <div className="flex items-center gap-2 text-sm text-foreground">
                                        <RiPhoneLine className="w-3.5 h-3.5 text-muted-foreground" />
                                        {selectedContact.phone ? (
                                            <a href={`tel:${selectedContact.phone}`} className="hover:text-primary hover:underline">{selectedContact.phone}</a>
                                        ) : <span className="text-muted-foreground/50">—</span>}
                                    </div>
                                ) : (
                                    <input type="text" value={editForm.phone || ""} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="+1 555 123 4567" />
                                )}
                            </div>

                            {/* Notes */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</label>
                                {!editing ? (
                                    <p className="text-sm text-foreground whitespace-pre-wrap">
                                        {selectedContact.notes || <span className="text-muted-foreground/50">No notes</span>}
                                    </p>
                                ) : (
                                    <textarea value={editForm.notes || ""} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} rows={3}
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="Notes..." />
                                )}
                            </div>

                            {/* Tags */}
                            {(() => {
                                const tags = parseTags(selectedContact.tags);
                                if (tags.length === 0) return null;
                                return (
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tags</label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {tags.map((tag: string) => (
                                                <span key={tag} className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">{tag}</span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Meta */}
                            <div className="pt-3 border-t border-border space-y-2">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <RiCalendarLine className="w-3 h-3" />
                                    Created {new Date(selectedContact.createdAt).toLocaleDateString()}
                                </div>
                                {selectedContact.lastContactedAt && (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <RiMailLine className="w-3 h-3" />
                                        Last contacted {new Date(selectedContact.lastContactedAt).toLocaleDateString()}
                                    </div>
                                )}
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <RiFileList3Line className="w-3 h-3" />
                                    Source: {selectedContact.source || "Manual"}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Add Contact Modal ─── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
                    <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h3 className="text-sm font-semibold text-foreground">New Contact</h3>
                            <button onClick={() => setShowModal(false)} className="p-1 rounded-md hover:bg-muted"><RiCloseLine className="w-4 h-4 text-muted-foreground" /></button>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground">Name *</label>
                                <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus
                                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="John Doe" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Email</label>
                                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="john@example.com" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Phone</label>
                                    <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="+1 555 123 4567" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Role</label>
                                    <input type="text" value={role} onChange={(e) => setRole(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="CEO, CTO, etc." />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Company</label>
                                    <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30">
                                        <option value="">None</option>
                                        {companies.map((co) => <option key={co.id} value={co.id}>{co.name}</option>)}
                                    </select>
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
                                Add Contact
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
