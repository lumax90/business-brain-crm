"use client";

import React from "react";
import { authClient } from "@/lib/auth-client";
import { RiMailLine, RiCheckLine, RiCloseLine } from "@remixicon/react";
import { toast } from "sonner";

export function PendingInvitations() {
    const [invitations, setInvitations] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);

    const fetchInvitations = React.useCallback(async () => {
        try {
            const res = await authClient.organization.listInvitations();
            if (res?.data) {
                const pending = (res.data as any[]).filter((inv: any) => inv.status === "pending");
                setInvitations(pending);
            }
        } catch {
            // silently fail
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchInvitations();
    }, [fetchInvitations]);

    const handleAccept = async (invitationId: string) => {
        try {
            await authClient.organization.acceptInvitation({ invitationId });
            toast.success("Invitation accepted! Switching to organization...");
            setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
            // Reload to switch context
            setTimeout(() => window.location.reload(), 1000);
        } catch {
            toast.error("Failed to accept invitation.");
        }
    };

    const handleReject = async (invitationId: string) => {
        try {
            await authClient.organization.rejectInvitation({ invitationId });
            toast.success("Invitation rejected.");
            setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
        } catch {
            toast.error("Failed to reject invitation.");
        }
    };

    if (loading || invitations.length === 0) return null;

    return (
        <div className="border-b border-border bg-primary/5">
            {invitations.map((inv) => (
                <div
                    key={inv.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <RiMailLine className="w-4 h-4 text-primary shrink-0" />
                        <span className="truncate">
                            You&apos;re invited to join <strong>{inv.organizationName || inv.organization?.name || "an organization"}</strong>
                            {inv.role && <span className="text-muted-foreground"> as {inv.role}</span>}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            onClick={() => handleAccept(inv.id)}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                            <RiCheckLine className="w-3.5 h-3.5" />
                            Accept
                        </button>
                        <button
                            onClick={() => handleReject(inv.id)}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                        >
                            <RiCloseLine className="w-3.5 h-3.5" />
                            Decline
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
