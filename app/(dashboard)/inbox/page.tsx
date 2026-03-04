import { AppHeader } from "@/components/app-header";

export default function PlaceholderPage() {
    return (
        <>
            <AppHeader title="Coming Soon" subtitle="This module is under construction" />
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <h2 className="text-2xl font-bold text-foreground">Module Under Construction</h2>
                    <p className="text-muted-foreground w-full max-w-sm mx-auto">
                        This section of the CRM & ERP suite is currently being built. Check back soon.
                    </p>
                </div>
            </div>
        </>
    );
}
