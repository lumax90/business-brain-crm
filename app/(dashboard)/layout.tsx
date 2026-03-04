"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { PendingInvitations } from "@/components/pending-invitations";
import { useSession } from "@/lib/auth-client";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const { data: session, isPending } = useSession();

    useEffect(() => {
        if (!isPending && !session) {
            router.replace("/login");
        }
    }, [session, isPending, router]);

    // Loading state
    if (isPending) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
            </div>
        );
    }

    // Not authenticated — will redirect
    if (!session) return null;

    return (
        <div className="flex h-screen overflow-hidden">
            <AppSidebar />
            <main className="flex-1 ml-[260px] flex flex-col overflow-hidden transition-all duration-300 ease-in-out">
                <PendingInvitations />
                {children}
            </main>
        </div>
    );
}
