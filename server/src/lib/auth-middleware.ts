import { Request, Response, NextFunction } from "express";
import { auth } from "./auth";
import { fromNodeHeaders } from "better-auth/node";

/**
 * Extend Express Request with tenant context.
 * After `requireAuth` middleware runs, req.userId and req.organizationId are available.
 */
declare global {
    namespace Express {
        interface Request {
            userId?: string;
            organizationId?: string | null;
        }
    }
}

/**
 * Middleware: Requires authentication.
 * Extracts userId and activeOrganizationId from the Better Auth session cookie.
 * Returns 401 if no valid session.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });

        if (!session?.user?.id) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        req.userId = session.user.id;
        req.organizationId = session.session.activeOrganizationId || null;
        next();
    } catch (error) {
        console.error("Auth middleware error:", error);
        res.status(401).json({ error: "Unauthorized" });
    }
}

/**
 * Build a Prisma `where` filter for multi-tenancy.
 * If user has an active organization → filter by organizationId.
 * Otherwise → filter by userId (personal workspace).
 */
export function tenantFilter(req: Request): { userId: string; organizationId?: string | null } {
    if (req.organizationId) {
        return { userId: req.userId!, organizationId: req.organizationId };
    }
    return { userId: req.userId!, organizationId: null };
}

/**
 * Build tenant data to attach when creating new records.
 */
export function tenantData(req: Request): { userId: string; organizationId: string | null } {
    return {
        userId: req.userId!,
        organizationId: req.organizationId || null,
    };
}
