"use client";

import * as React from "react";
import { AppHeader } from "@/components/app-header";
import { cn } from "@/lib/utils";
import { useSession, authClient } from "@/lib/auth-client";
import {
    RiSettings4Line,
    RiUser3Line,
    RiFlowChart,
    RiPaletteLine,
    RiDatabase2Line,
    RiShieldLine,
    RiSaveLine,
    RiPlugLine,
    RiLoader4Line,
    RiGroupLine,
    RiMailSendLine,
    RiDeleteBinLine,
    RiCheckLine,
    RiCloseLine,
    RiTimeLine,
} from "@remixicon/react";

const settingsSections = [
    { id: "profile", label: "Profile", icon: RiUser3Line },
    { id: "organization", label: "Organization", icon: RiGroupLine },
    { id: "security", label: "Security", icon: RiShieldLine },
    { id: "general", label: "General", icon: RiSettings4Line },
    { id: "pipeline", label: "Pipeline", icon: RiFlowChart },
    { id: "integrations", label: "Integrations", icon: RiPaletteLine },
    { id: "enrichment", label: "Enrichment APIs", icon: RiPlugLine },
    { id: "data", label: "Data", icon: RiDatabase2Line },
];

import { API, apiFetch } from "@/lib/api";
import { toast } from "sonner";

// ─── Helper: input class ───
const inputCls = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/40";

// ─── Section card wrapper ───
function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={cn("space-y-4 rounded-xl border border-border bg-card p-5", className)}>{children}</div>;
}

// FeedbackBanner removed — using sonner toast instead

export default function SettingsPage() {
    const [activeSection, setActiveSection] = React.useState("profile");

    // ─── Auth data ───
    const { data: session, isPending: sessionLoading } = useSession();
    const { data: activeOrg } = authClient.useActiveOrganization();
    const { data: orgList } = authClient.useListOrganizations();

    // ─── Feedback (sonner toast) ───
    const flash = (message: string, type: "success" | "error" = "success") => {
        if (type === "error") toast.error(message);
        else toast.success(message);
    };

    // ─── Profile state ───
    const [profileName, setProfileName] = React.useState("");
    const [profileSaving, setProfileSaving] = React.useState(false);

    React.useEffect(() => {
        if (session?.user?.name) setProfileName(session.user.name);
    }, [session?.user?.name]);

    const handleUpdateProfile = async () => {
        if (!profileName.trim()) return;
        try {
            setProfileSaving(true);
            await authClient.updateUser({ name: profileName.trim() });
            flash("Profile updated successfully.");
        } catch {
            flash("Failed to update profile.", "error");
        } finally {
            setProfileSaving(false);
        }
    };

    // ─── Security state ───
    const [currentPassword, setCurrentPassword] = React.useState("");
    const [newPassword, setNewPassword] = React.useState("");
    const [confirmPassword, setConfirmPassword] = React.useState("");
    const [passwordSaving, setPasswordSaving] = React.useState(false);

    const handleChangePassword = async () => {
        if (newPassword.length < 8) { flash("Password must be at least 8 characters.", "error"); return; }
        if (newPassword !== confirmPassword) { flash("Passwords do not match.", "error"); return; }
        try {
            setPasswordSaving(true);
            await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: false });
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            flash("Password changed successfully.");
        } catch {
            flash("Failed to change password. Check your current password.", "error");
        } finally {
            setPasswordSaving(false);
        }
    };

    // ─── Organization state ───
    const [orgCreating, setOrgCreating] = React.useState(false);
    const [newOrgName, setNewOrgName] = React.useState("");
    const [newOrgSlug, setNewOrgSlug] = React.useState("");
    const [inviteEmail, setInviteEmail] = React.useState("");
    const [inviteRole, setInviteRole] = React.useState<"member" | "admin">("member");
    const [inviting, setInviting] = React.useState(false);
    const [members, setMembers] = React.useState<any[]>([]);
    const [invitations, setInvitations] = React.useState<any[]>([]);
    const [loadingMembers, setLoadingMembers] = React.useState(false);
    const [showDeleteOrgModal, setShowDeleteOrgModal] = React.useState(false);
    const [deleteOrgConfirmText, setDeleteOrgConfirmText] = React.useState("");
    const [deletingOrg, setDeletingOrg] = React.useState(false);

    // Fetch members when org changes
    React.useEffect(() => {
        if (!activeOrg?.id) { setMembers([]); setInvitations([]); return; }
        const fetchMembers = async () => {
            setLoadingMembers(true);
            try {
                const res = await authClient.organization.getFullOrganization({ query: { organizationId: activeOrg.id } });
                if (res?.data) {
                    setMembers(res.data.members || []);
                    setInvitations((res.data.invitations || []).filter((i: any) => i.status === "pending"));
                }
            } catch {
                // silently fail
            } finally {
                setLoadingMembers(false);
            }
        };
        fetchMembers();
    }, [activeOrg?.id]);

    const handleDeleteOrg = async () => {
        if (!activeOrg?.id || deleteOrgConfirmText !== activeOrg.name) return;
        try {
            setDeletingOrg(true);
            await authClient.organization.delete({ organizationId: activeOrg.id });
            flash("Organization deleted successfully.");
            setShowDeleteOrgModal(false);
            setDeleteOrgConfirmText("");
        } catch {
            flash("Failed to delete organization.", "error");
        } finally {
            setDeletingOrg(false);
        }
    };

    const handleCreateOrg = async () => {
        if (!newOrgName.trim()) return;
        const slug = newOrgSlug.trim() || newOrgName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        try {
            setOrgCreating(true);
            await authClient.organization.create({ name: newOrgName.trim(), slug });
            setNewOrgName("");
            setNewOrgSlug("");
            flash("Organization created successfully.");
        } catch {
            flash("Failed to create organization.", "error");
        } finally {
            setOrgCreating(false);
        }
    };

    const handleInviteMember = async () => {
        if (!inviteEmail.trim() || !activeOrg?.id) return;
        try {
            setInviting(true);
            await authClient.organization.inviteMember({
                email: inviteEmail.trim(),
                role: inviteRole,
                organizationId: activeOrg.id,
            });
            setInviteEmail("");
            flash(`Invitation sent to ${inviteEmail.trim()}`);
            // Refresh members
            const res = await authClient.organization.getFullOrganization({ query: { organizationId: activeOrg.id } });
            if (res?.data) {
                setMembers(res.data.members || []);
                setInvitations((res.data.invitations || []).filter((i: any) => i.status === "pending"));
            }
        } catch {
            flash("Failed to send invitation.", "error");
        } finally {
            setInviting(false);
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        if (!activeOrg?.id) return;
        try {
            await authClient.organization.removeMember({ memberIdOrEmail: memberId, organizationId: activeOrg.id });
            setMembers(prev => prev.filter(m => m.id !== memberId));
            flash("Member removed.");
        } catch {
            flash("Failed to remove member.", "error");
        }
    };

    const handleCancelInvitation = async (invitationId: string) => {
        if (!activeOrg?.id) return;
        try {
            await authClient.organization.cancelInvitation({ invitationId });
            flash("Invitation cancelled.");
            // Refresh from server to get actual state
            const res = await authClient.organization.getFullOrganization({ query: { organizationId: activeOrg.id } });
            if (res?.data) {
                setMembers(res.data.members || []);
                setInvitations((res.data.invitations || []).filter((i: any) => i.status === "pending"));
            }
        } catch {
            flash("Failed to cancel invitation.", "error");
        }
    };

    // ─── App Settings state ───
    const [settings, setSettings] = React.useState<Record<string, string>>({});
    const [saving, setSaving] = React.useState(false);
    const [loading, setLoading] = React.useState(true);

    const fetchSettings = React.useCallback(async () => {
        try {
            setLoading(true);
            const res = await apiFetch(`${API}/api/settings`);
            const data = await res.json();
            if (data.success) {
                setSettings(data.settings);
            }
        } catch (err) {
            console.error("Failed to fetch settings:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const handleSave = async (keysToSave: string[]) => {
        try {
            setSaving(true);
            const payload: Record<string, string> = {};
            for (const k of keysToSave) {
                if (settings[k] !== undefined) payload[k] = settings[k];
            }

            const res = await apiFetch(`${API}/api/settings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            flash("Settings saved.");
        } catch (err) {
            console.error("Failed to save settings:", err);
            flash("Failed to save settings.", "error");
        } finally {
            setSaving(false);
        }
    };

    const updateSetting = (key: string, value: string) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const roleLabel = (role: string) => {
        switch (role) {
            case "owner": return { text: "Owner", color: "text-amber-700 dark:text-amber-400 bg-amber-500/10" };
            case "admin": return { text: "Admin", color: "text-blue-700 dark:text-blue-400 bg-blue-500/10" };
            default: return { text: "Member", color: "text-muted-foreground bg-muted" };
        }
    };

    return (
        <>
            <AppHeader title="Settings" subtitle="Configure your workspace" />
            <div className="p-6">


                <div className="flex gap-6 animate-fade-in">
                    {/* Sidebar Navigation */}
                    <div className="w-48 shrink-0 space-y-0.5">
                        {settingsSections.map((section) => (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id)}
                                className={cn(
                                    "flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm font-medium transition-all duration-150",
                                    activeSection === section.id
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                )}
                            >
                                <section.icon className="w-4 h-4" />
                                {section.label}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="flex-1 max-w-2xl">

                        {/* ═══════════════ PROFILE ═══════════════ */}
                        {activeSection === "profile" && (
                            <div className="space-y-6 animate-fade-in">
                                <div>
                                    <h3 className="text-base font-semibold text-foreground mb-1">Profile</h3>
                                    <p className="text-xs text-muted-foreground">Your personal information</p>
                                </div>

                                {sessionLoading ? (
                                    <div className="flex justify-center p-8"><RiLoader4Line className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                                ) : (
                                    <SectionCard>
                                        <div className="flex items-center gap-4 mb-2">
                                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
                                                {session?.user?.name?.charAt(0)?.toUpperCase() || "?"}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-foreground truncate">{session?.user?.name || "No name"}</p>
                                                <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-foreground">Full Name</label>
                                            <input
                                                type="text"
                                                value={profileName}
                                                onChange={(e) => setProfileName(e.target.value)}
                                                className={inputCls}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-foreground">Email</label>
                                            <input
                                                type="email"
                                                value={session?.user?.email || ""}
                                                disabled
                                                className={cn(inputCls, "opacity-60 cursor-not-allowed")}
                                            />
                                            <p className="text-[10px] text-muted-foreground">Email cannot be changed from here.</p>
                                        </div>
                                    </SectionCard>
                                )}

                                <button
                                    onClick={handleUpdateProfile}
                                    disabled={profileSaving || !profileName.trim()}
                                    className="flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                >
                                    {profileSaving ? <RiLoader4Line className="w-4 h-4 animate-spin" /> : <RiSaveLine className="w-4 h-4" />}
                                    Save Profile
                                </button>
                            </div>
                        )}

                        {/* ═══════════════ ORGANIZATION ═══════════════ */}
                        {activeSection === "organization" && (
                            <div className="space-y-6 animate-fade-in">
                                <div>
                                    <h3 className="text-base font-semibold text-foreground mb-1">Organization</h3>
                                    <p className="text-xs text-muted-foreground">Manage your team and organization settings</p>
                                </div>

                                {/* Create Organization */}
                                {!activeOrg && (
                                    <SectionCard>
                                        <h4 className="text-sm font-medium text-foreground">Create Organization</h4>
                                        <p className="text-xs text-muted-foreground">Create an organization to collaborate with your team. Up to 10 members per organization.</p>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-foreground">Name</label>
                                                <input
                                                    type="text"
                                                    placeholder="Acme Inc."
                                                    value={newOrgName}
                                                    onChange={(e) => setNewOrgName(e.target.value)}
                                                    className={inputCls}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-foreground">Slug (optional)</label>
                                                <input
                                                    type="text"
                                                    placeholder="acme-inc"
                                                    value={newOrgSlug}
                                                    onChange={(e) => setNewOrgSlug(e.target.value)}
                                                    className={inputCls}
                                                />
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleCreateOrg}
                                            disabled={orgCreating || !newOrgName.trim()}
                                            className="flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                        >
                                            {orgCreating ? <RiLoader4Line className="w-4 h-4 animate-spin" /> : <RiGroupLine className="w-4 h-4" />}
                                            Create Organization
                                        </button>
                                    </SectionCard>
                                )}

                                {/* Your organizations list */}
                                {orgList && orgList.length > 0 && (
                                    <SectionCard>
                                        <h4 className="text-sm font-medium text-foreground">Your Organizations</h4>
                                        <div className="space-y-2">
                                            {orgList.map((org: any) => (
                                                <div key={org.id} className={cn(
                                                    "flex items-center gap-3 p-3 rounded-lg border transition-all",
                                                    activeOrg?.id === org.id ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/20"
                                                )}>
                                                    <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                                                        {org.name?.charAt(0)?.toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-foreground truncate">{org.name}</p>
                                                        <p className="text-[10px] text-muted-foreground">{org.slug}</p>
                                                    </div>
                                                    {activeOrg?.id === org.id ? (
                                                        <span className="text-[10px] font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">Active</span>
                                                    ) : (
                                                        <button
                                                            onClick={() => authClient.organization.setActive({ organizationId: org.id })}
                                                            className="text-xs text-primary font-medium hover:underline"
                                                        >
                                                            Switch
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </SectionCard>
                                )}

                                {/* Active org management */}
                                {activeOrg && (
                                    <>
                                        {/* Members */}
                                        <SectionCard>
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-medium text-foreground">Members</h4>
                                                <span className="text-[10px] text-muted-foreground">{members.length}/10 members</span>
                                            </div>

                                            {loadingMembers ? (
                                                <div className="flex justify-center p-4"><RiLoader4Line className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                                            ) : (
                                                <div className="space-y-1">
                                                    {members.map((member: any) => {
                                                        const rl = roleLabel(member.role);
                                                        const isCurrentUser = member.userId === session?.user?.id;
                                                        const isOwner = member.role === "owner";
                                                        return (
                                                            <div key={member.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                                                                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                                                                    {member.user?.name?.charAt(0)?.toUpperCase() || member.user?.email?.charAt(0)?.toUpperCase() || "?"}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm text-foreground truncate">
                                                                        {member.user?.name || member.user?.email || "Unknown"}
                                                                        {isCurrentUser && <span className="text-[10px] text-muted-foreground ml-1">(you)</span>}
                                                                    </p>
                                                                    <p className="text-[10px] text-muted-foreground truncate">{member.user?.email}</p>
                                                                </div>
                                                                <span className={cn("text-[10px] font-medium rounded-full px-2 py-0.5", rl.color)}>{rl.text}</span>
                                                                {!isOwner && !isCurrentUser && (
                                                                    <button
                                                                        onClick={() => handleRemoveMember(member.id)}
                                                                        className="text-muted-foreground hover:text-red-500 transition-colors"
                                                                        title="Remove member"
                                                                    >
                                                                        <RiDeleteBinLine className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </SectionCard>

                                        {/* Pending invitations */}
                                        {invitations.length > 0 && (
                                            <SectionCard>
                                                <h4 className="text-sm font-medium text-foreground">Pending Invitations</h4>
                                                <div className="space-y-1">
                                                    {invitations.map((inv: any) => (
                                                        <div key={inv.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                                                            <RiTimeLine className="w-4 h-4 text-muted-foreground shrink-0" />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm text-foreground truncate">{inv.email}</p>
                                                                <p className="text-[10px] text-muted-foreground">
                                                                    Role: {inv.role} · Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                                                                </p>
                                                            </div>
                                                            <button
                                                                onClick={() => handleCancelInvitation(inv.id)}
                                                                className="text-xs text-red-500 hover:underline"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </SectionCard>
                                        )}

                                        {/* Invite member */}
                                        <SectionCard>
                                            <h4 className="text-sm font-medium text-foreground">Invite Member</h4>
                                            <div className="flex gap-3">
                                                <div className="flex-1 space-y-1.5">
                                                    <label className="text-xs font-medium text-foreground">Email</label>
                                                    <input
                                                        type="email"
                                                        placeholder="colleague@company.com"
                                                        value={inviteEmail}
                                                        onChange={(e) => setInviteEmail(e.target.value)}
                                                        className={inputCls}
                                                    />
                                                </div>
                                                <div className="w-32 space-y-1.5">
                                                    <label className="text-xs font-medium text-foreground">Role</label>
                                                    <select
                                                        value={inviteRole}
                                                        onChange={(e) => setInviteRole(e.target.value as "member" | "admin")}
                                                        className={inputCls}
                                                    >
                                                        <option value="member">Member</option>
                                                        <option value="admin">Admin</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleInviteMember}
                                                disabled={inviting || !inviteEmail.trim()}
                                                className="flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                            >
                                                {inviting ? <RiLoader4Line className="w-4 h-4 animate-spin" /> : <RiMailSendLine className="w-4 h-4" />}
                                                Send Invitation
                                            </button>
                                        </SectionCard>

                                        {/* Create another org (if below limit) */}
                                        {(orgList?.length || 0) < 5 && (
                                            <SectionCard>
                                                <h4 className="text-sm font-medium text-foreground">Create Another Organization</h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-medium text-foreground">Name</label>
                                                        <input type="text" placeholder="Org name" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} className={inputCls} />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-medium text-foreground">Slug</label>
                                                        <input type="text" placeholder="org-slug" value={newOrgSlug} onChange={(e) => setNewOrgSlug(e.target.value)} className={inputCls} />
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={handleCreateOrg}
                                                    disabled={orgCreating || !newOrgName.trim()}
                                                    className="flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                                >
                                                    {orgCreating ? <RiLoader4Line className="w-4 h-4 animate-spin" /> : <RiGroupLine className="w-4 h-4" />}
                                                    Create Organization
                                                </button>
                                            </SectionCard>
                                        )}

                                        {/* Danger Zone */}
                                        {members.find(m => m.userId === session?.user?.id)?.role === "owner" && (
                                            <div className="pt-4 mt-8 border-t border-border">
                                                <h4 className="text-sm font-semibold text-red-500 mb-1">Danger Zone</h4>
                                                <p className="text-xs text-muted-foreground mb-4">
                                                    Irreversible and destructive actions. Proceed with caution.
                                                </p>
                                                <SectionCard className="border-red-500/20 bg-red-500/5">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <h5 className="text-sm font-medium text-foreground">Delete Organization</h5>
                                                            <p className="text-xs text-muted-foreground max-w-[280px] sm:max-w-md mt-1">
                                                                Permanently delete this organization, along with all its leads, deals, invoices, and data. This action cannot be undone.
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={() => setShowDeleteOrgModal(true)}
                                                            className="flex h-9 shrink-0 items-center justify-center rounded-md bg-red-500/10 px-4 text-sm font-medium text-red-600 hover:bg-red-500/20 transition-colors"
                                                        >
                                                            Delete Organization
                                                        </button>
                                                    </div>
                                                </SectionCard>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {/* ═══════════════ SECURITY ═══════════════ */}
                        {activeSection === "security" && (
                            <div className="space-y-6 animate-fade-in">
                                <div>
                                    <h3 className="text-base font-semibold text-foreground mb-1">Security</h3>
                                    <p className="text-xs text-muted-foreground">Change your password</p>
                                </div>

                                <SectionCard>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-foreground">Current Password</label>
                                        <input
                                            type="password"
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            placeholder="Enter current password"
                                            className={inputCls}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-foreground">New Password</label>
                                            <input
                                                type="password"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                placeholder="Min. 8 characters"
                                                className={inputCls}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-foreground">Confirm Password</label>
                                            <input
                                                type="password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                placeholder="Re-enter new password"
                                                className={inputCls}
                                            />
                                        </div>
                                    </div>
                                    {newPassword && confirmPassword && newPassword !== confirmPassword && (
                                        <p className="text-[11px] text-red-500 font-medium">Passwords do not match.</p>
                                    )}
                                </SectionCard>

                                <button
                                    onClick={handleChangePassword}
                                    disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
                                    className="flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                >
                                    {passwordSaving ? <RiLoader4Line className="w-4 h-4 animate-spin" /> : <RiShieldLine className="w-4 h-4" />}
                                    Update Password
                                </button>

                                {/* Active sessions info */}
                                <SectionCard className="mt-4">
                                    <h4 className="text-sm font-medium text-foreground">Session Info</h4>
                                    <div className="text-xs text-muted-foreground space-y-1">
                                        <p>Logged in as: <span className="font-medium text-foreground">{session?.user?.email}</span></p>
                                        <p>Session expires: <span className="font-medium text-foreground">{session?.session?.expiresAt ? new Date(session.session.expiresAt).toLocaleString() : "N/A"}</span></p>
                                    </div>
                                </SectionCard>
                            </div>
                        )}

                        {/* ═══════════════ GENERAL ═══════════════ */}
                        {activeSection === "general" && (
                            <div className="space-y-6 animate-fade-in">
                                <div>
                                    <h3 className="text-base font-semibold text-foreground mb-1">General Settings</h3>
                                    <p className="text-xs text-muted-foreground">Configure your workspace preferences</p>
                                </div>

                                <SectionCard>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-foreground">Workspace Name</label>
                                        <input
                                            type="text"
                                            value={settings["WORKSPACE_NAME"] || "Pixl Sales Brain"}
                                            onChange={(e) => updateSetting("WORKSPACE_NAME", e.target.value)}
                                            className={inputCls}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-foreground">Timezone</label>
                                            <select
                                                className={inputCls}
                                                value={settings["TIMEZONE"] || "Europe/Istanbul (UTC+3)"}
                                                onChange={(e) => updateSetting("TIMEZONE", e.target.value)}
                                            >
                                                <option value="Europe/Istanbul (UTC+3)">Europe/Istanbul (UTC+3)</option>
                                                <option value="America/New_York (UTC-5)">America/New_York (UTC-5)</option>
                                                <option value="Europe/London (UTC+0)">Europe/London (UTC+0)</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-foreground">Primary Currency</label>
                                            <select
                                                className={inputCls}
                                                value={settings["PRIMARY_CURRENCY"] || "USD"}
                                                onChange={(e) => updateSetting("PRIMARY_CURRENCY", e.target.value)}
                                            >
                                                <option value="USD">USD ($)</option>
                                                <option value="EUR">EUR (€)</option>
                                                <option value="TRY">TRY (₺)</option>
                                                <option value="GBP">GBP (£)</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-foreground">Secondary Currency</label>
                                            <select
                                                className={inputCls}
                                                value={settings["SECONDARY_CURRENCY"] || "None"}
                                                onChange={(e) => updateSetting("SECONDARY_CURRENCY", e.target.value)}
                                            >
                                                <option value="None">None</option>
                                                <option value="USD">USD ($)</option>
                                                <option value="EUR">EUR (€)</option>
                                                <option value="TRY">TRY (₺)</option>
                                                <option value="GBP">GBP (£)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-foreground">Date Format</label>
                                            <select className={inputCls}>
                                                <option>MM/DD/YYYY</option>
                                                <option>DD/MM/YYYY</option>
                                                <option>YYYY-MM-DD</option>
                                            </select>
                                        </div>
                                    </div>
                                </SectionCard>

                                <button
                                    onClick={() => handleSave(["WORKSPACE_NAME", "TIMEZONE", "PRIMARY_CURRENCY", "SECONDARY_CURRENCY", "DATE_FORMAT"])}
                                    disabled={saving || loading}
                                    className="flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                >
                                    {saving ? <RiLoader4Line className="w-4 h-4 animate-spin" /> : <RiSaveLine className="w-4 h-4" />}
                                    Save Changes
                                </button>
                            </div>
                        )}

                        {/* ═══════════════ PIPELINE ═══════════════ */}
                        {activeSection === "pipeline" && (
                            <div className="space-y-6 animate-fade-in">
                                <div>
                                    <h3 className="text-base font-semibold text-foreground mb-1">Pipeline Configuration</h3>
                                    <p className="text-xs text-muted-foreground">Customize your deal stages</p>
                                </div>

                                <SectionCard className="space-y-2">
                                    {["New", "Qualified", "Proposal", "Negotiation", "Closed Won", "Closed Lost"].map(
                                        (stage, i) => (
                                            <div
                                                key={stage}
                                                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs text-muted-foreground font-mono w-4">{i + 1}</span>
                                                    <span className="text-sm font-medium text-foreground">{stage}</span>
                                                </div>
                                                <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                                                    Edit
                                                </button>
                                            </div>
                                        )
                                    )}
                                </SectionCard>
                            </div>
                        )}

                        {/* ═══════════════ INTEGRATIONS ═══════════════ */}
                        {activeSection === "integrations" && (
                            <div className="space-y-6 animate-fade-in">
                                <div>
                                    <h3 className="text-base font-semibold text-foreground mb-1">Integrations</h3>
                                    <p className="text-xs text-muted-foreground">Connect your tools</p>
                                </div>

                                <div className="space-y-3">
                                    {[
                                        { name: "N8N", desc: "Workflow automation", connected: true },
                                        { name: "Slack", desc: "Team notifications", connected: false },
                                        { name: "Google Sheets", desc: "Data sync", connected: false },
                                        { name: "Calendly", desc: "Meeting scheduling", connected: false },
                                        { name: "SendGrid", desc: "Email sending", connected: false },
                                    ].map((integration) => (
                                        <div
                                            key={integration.name}
                                            className="flex items-center justify-between py-3 px-4 rounded-xl border border-border bg-card hover:border-primary/20 transition-all"
                                        >
                                            <div>
                                                <p className="text-sm font-medium text-foreground">{integration.name}</p>
                                                <p className="text-xs text-muted-foreground">{integration.desc}</p>
                                            </div>
                                            {integration.connected ? (
                                                <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-full px-2 py-0.5">
                                                    Connected
                                                </span>
                                            ) : (
                                                <button className="text-xs text-primary font-medium hover:underline">
                                                    Connect
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ═══════════════ ENRICHMENT ═══════════════ */}
                        {activeSection === "enrichment" && (
                            <div className="space-y-6 animate-fade-in">
                                <div>
                                    <h3 className="text-base font-semibold text-foreground mb-1">Enrichment Configuration</h3>
                                    <p className="text-xs text-muted-foreground">Configure domain finding and email verification APIs</p>
                                </div>

                                {loading ? (
                                    <div className="flex justify-center p-8"><RiLoader4Line className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                                ) : (
                                    <SectionCard>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-foreground">Domain Search Provider</label>
                                            <select
                                                value={settings["DOMAIN_PROVIDER"] || "duckduckgo"}
                                                onChange={(e) => updateSetting("DOMAIN_PROVIDER", e.target.value)}
                                                className={inputCls}
                                            >
                                                <option value="duckduckgo">DuckDuckGo HTML (Free, IP blocks possible)</option>
                                                <option value="serper">Serper.dev (Fast, Reliable, Paid API)</option>
                                            </select>
                                            <p className="text-[10px] text-muted-foreground">
                                                Select how the system searches for missing company domains.
                                            </p>
                                        </div>

                                        {settings["DOMAIN_PROVIDER"] === "serper" && (
                                            <div className="space-y-1.5 animate-in slide-in-from-top-2">
                                                <label className="text-xs font-medium text-foreground">Serper.dev API Key</label>
                                                <input
                                                    type="password"
                                                    placeholder="Enter your Serper API key"
                                                    value={settings["SERPER_API_KEY"] || ""}
                                                    onChange={(e) => updateSetting("SERPER_API_KEY", e.target.value)}
                                                    className={inputCls}
                                                />
                                                <p className="text-[10px] text-muted-foreground">
                                                    Get 2,500 free searches/month at <a href="https://serper.dev" target="_blank" className="text-primary hover:underline">serper.dev</a>.
                                                </p>
                                            </div>
                                        )}

                                        <div className="pt-4 mt-4 border-t border-border">
                                            <div className="mb-4">
                                                <h4 className="text-sm font-medium text-foreground mb-1">Email Verification Integration</h4>
                                                <p className="text-[10px] text-muted-foreground">
                                                    Choose which service to use to verify if an email exists and can receive mail.
                                                    Local SMTP might be blocked by your server/ISP, so external APIs are recommended.
                                                </p>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-foreground">Verification Provider</label>
                                                    <select
                                                        value={settings["EMAIL_VERIFICATION_PROVIDER"] || "hunter"}
                                                        onChange={(e) => updateSetting("EMAIL_VERIFICATION_PROVIDER", e.target.value)}
                                                        className={inputCls}
                                                    >
                                                        <option value="local">Local Port 25 (Free, Requires Open Port)</option>
                                                        <option value="hunter">Hunter.io</option>
                                                        <option value="zerobounce">ZeroBounce</option>
                                                    </select>
                                                </div>

                                                {settings["EMAIL_VERIFICATION_PROVIDER"] === "hunter" && (
                                                    <div className="space-y-1.5 animate-in slide-in-from-top-2">
                                                        <label className="text-xs font-medium text-foreground">Hunter.io API Key</label>
                                                        <input
                                                            type="password"
                                                            placeholder="Enter Hunter API key"
                                                            value={settings["HUNTER_API_KEY"] || ""}
                                                            onChange={(e) => updateSetting("HUNTER_API_KEY", e.target.value)}
                                                            className={inputCls}
                                                        />
                                                    </div>
                                                )}

                                                {settings["EMAIL_VERIFICATION_PROVIDER"] === "zerobounce" && (
                                                    <div className="space-y-1.5 animate-in slide-in-from-top-2">
                                                        <label className="text-xs font-medium text-foreground">ZeroBounce API Key</label>
                                                        <input
                                                            type="password"
                                                            placeholder="Enter ZeroBounce API key"
                                                            value={settings["ZEROBOUNCE_API_KEY"] || ""}
                                                            onChange={(e) => updateSetting("ZEROBOUNCE_API_KEY", e.target.value)}
                                                            className={inputCls}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="pt-4 mt-4 border-t border-border">
                                            <div className="mb-4">
                                                <h4 className="text-sm font-medium text-foreground mb-1">AI Assistant Integration</h4>
                                                <p className="text-[10px] text-muted-foreground">
                                                    Configure AI to automatically help determine official domains and verify emails when normal search fails.
                                                    This acts as an opt-in fallback to vastly improve accuracy.
                                                </p>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="space-y-1.5 animate-in slide-in-from-top-2">
                                                    <label className="text-xs font-medium text-foreground">OpenAI API Key (Optional)</label>
                                                    <input
                                                        type="password"
                                                        placeholder="sk-..."
                                                        value={settings["OPENAI_API_KEY"] || ""}
                                                        onChange={(e) => updateSetting("OPENAI_API_KEY", e.target.value)}
                                                        className={inputCls}
                                                    />
                                                    <p className="text-[10px] text-muted-foreground">
                                                        API details are sent from backend -&gt; OpenAI directly. Get one at <a href="https://platform.openai.com" target="_blank" className="text-primary hover:underline">platform.openai.com</a>.
                                                    </p>
                                                </div>

                                                <div className="space-y-1.5 animate-in slide-in-from-top-2">
                                                    <label className="text-xs font-medium text-foreground">AI Model Engine</label>
                                                    <select
                                                        value={settings["AI_MODEL"] || "gpt-4o-mini"}
                                                        onChange={(e) => updateSetting("AI_MODEL", e.target.value)}
                                                        className={inputCls}
                                                    >
                                                        <option value="gpt-4o-mini">GPT-4o Mini (Fastest & Cheapest)</option>
                                                        <option value="gpt-4o">GPT-4o (Most Capable)</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </SectionCard>
                                )}

                                <button
                                    onClick={() => handleSave([
                                        "DOMAIN_PROVIDER", "SERPER_API_KEY",
                                        "OPENAI_API_KEY", "AI_MODEL",
                                        "EMAIL_VERIFICATION_PROVIDER", "HUNTER_API_KEY", "ZEROBOUNCE_API_KEY"
                                    ])}
                                    disabled={saving || loading}
                                    className="flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                >
                                    {saving ? <RiLoader4Line className="w-4 h-4 animate-spin" /> : <RiSaveLine className="w-4 h-4" />}
                                    Save Changes
                                </button>
                            </div>
                        )}

                        {/* ═══════════════ DATA ═══════════════ */}
                        {activeSection === "data" && (
                            <div className="space-y-6 animate-fade-in">
                                <div>
                                    <h3 className="text-base font-semibold text-foreground mb-1">Data Management</h3>
                                    <p className="text-xs text-muted-foreground">Import, export, and manage your data</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <button className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all">
                                        <RiDatabase2Line className="w-6 h-6 text-muted-foreground" />
                                        <span className="text-sm font-medium">Import CSV</span>
                                        <span className="text-[10px] text-muted-foreground">Upload leads from CSV</span>
                                    </button>
                                    <button className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all">
                                        <RiSaveLine className="w-6 h-6 text-muted-foreground" />
                                        <span className="text-sm font-medium">Export Data</span>
                                        <span className="text-[10px] text-muted-foreground">Download all data as CSV</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* DELETE ORG MODAL */}
            {showDeleteOrgModal && activeOrg && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl animate-in zoom-in-95">
                        <div className="mb-4 flex items-center gap-3 text-red-500">
                            <RiDeleteBinLine className="h-6 w-6" />
                            <h2 className="text-lg font-bold">Delete Organization</h2>
                        </div>
                        <p className="mb-4 text-sm text-muted-foreground">
                            You are about to permanently delete the organization <strong className="text-foreground">{activeOrg.name}</strong> and all of its associated data (leads, deals, invoices, expenses). This action cannot be reversed.
                        </p>
                        <div className="mb-6 space-y-2">
                            <label className="text-sm font-medium text-foreground">
                                Type <strong className="select-all block mt-1 p-2 bg-muted/50 rounded border">{activeOrg.name}</strong> to confirm:
                            </label>
                            <input
                                type="text"
                                value={deleteOrgConfirmText}
                                onChange={(e) => setDeleteOrgConfirmText(e.target.value)}
                                className={inputCls}
                                placeholder="Organization name"
                            />
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => { setShowDeleteOrgModal(false); setDeleteOrgConfirmText(""); }}
                                disabled={deletingOrg}
                                className="h-9 px-4 rounded-md text-sm font-medium border border-input bg-background hover:bg-muted/50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteOrg}
                                disabled={deletingOrg || deleteOrgConfirmText !== activeOrg.name}
                                className="flex items-center gap-2 h-9 px-4 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                                {deletingOrg ? <RiLoader4Line className="w-4 h-4 animate-spin" /> : "Delete Organization"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
