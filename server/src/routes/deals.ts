import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { tenantFilter, tenantData } from "../lib/auth-middleware";
import { createNotification } from "./notifications";

export const dealsRouter = Router();

// ─── GET /api/deals — All deals ───
dealsRouter.get("/", async (req: Request, res: Response) => {
    try {
        const deals = await prisma.deal.findMany({
            where: { ...tenantFilter(req) },
            orderBy: { createdAt: "desc" },
            include: { lead: { select: { id: true, name: true, email: true } } },
        });
        res.json({ success: true, deals });
    } catch (error: unknown) {
        console.error("List deals error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── POST /api/deals — Create deal ───
dealsRouter.post("/", async (req: Request, res: Response) => {
    try {
        const { title, value, currency, stage, probability, contactName, company, notes, expectedCloseDate, leadId } = req.body;

        if (!title) {
            res.status(400).json({ error: "title is required" });
            return;
        }

        const deal = await prisma.deal.create({
            data: {
                title,
                value: value || 0,
                currency: currency || "USD",
                stage: stage || "new",
                probability: probability || 0,
                contactName: contactName || null,
                company: company || null,
                notes: notes || null,
                expectedCloseDate: expectedCloseDate || null,
                leadId: leadId || null,
                ...tenantData(req),
            },
        });

        createNotification(req.userId!, req.organizationId || null, { type: "success", title: "Deal created", message: `Deal "${title}" (${value || 0}) added to pipeline.`, href: "/pipeline", entity: "deal", entityId: deal.id }).catch(() => {});

        res.json({ success: true, deal });
    } catch (error: unknown) {
        console.error("Create deal error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── PUT /api/deals/:id — Update deal (including stage changes) ───
dealsRouter.put("/:id", async (req: Request, res: Response) => {
    try {
        const data: any = {};
        const fields = ["title", "value", "currency", "stage", "probability", "contactName", "company", "notes", "expectedCloseDate", "leadId"];

        for (const field of fields) {
            if (req.body[field] !== undefined) {
                data[field] = req.body[field];
            }
        }

        const existing = await prisma.deal.findFirst({ where: { id: req.params.id as string, ...tenantFilter(req) } });
        if (!existing) { res.status(404).json({ error: "Deal not found" }); return; }

        const deal = await prisma.deal.update({
            where: { id: existing.id },
            data,
        });

        createNotification(req.userId!, req.organizationId || null, { type: "info", title: "Deal updated", message: `Deal stage changed to ${req.body.stage || "updated"}.`, href: "/pipeline", entity: "deal", entityId: req.params.id as string }).catch(() => {});

        res.json({ success: true, deal });
    } catch (error: unknown) {
        console.error("Update deal error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── DELETE /api/deals/:id — Delete deal ───
dealsRouter.delete("/:id", async (req: Request, res: Response) => {
    try {
        await prisma.deal.deleteMany({ where: { id: req.params.id as string, ...tenantFilter(req) } });

        createNotification(req.userId!, req.organizationId || null, { type: "info", title: "Deal deleted", message: "A deal was removed from pipeline.", href: "/pipeline", entity: "deal" }).catch(() => {});

        res.json({ success: true });
    } catch (error: unknown) {
        console.error("Delete deal error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── GET /api/deals/stats — Pipeline stats ───
dealsRouter.get("/stats", async (req: Request, res: Response) => {
    try {
        const deals = await prisma.deal.findMany({ where: { ...tenantFilter(req) } });

        const stages = ["new", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"];
        const stats = stages.map((stage) => {
            const stageDeals = deals.filter((d) => d.stage === stage);
            return {
                stage,
                count: stageDeals.length,
                totalValue: stageDeals.reduce((sum, d) => sum + d.value, 0),
            };
        });

        const totalPipeline = deals
            .filter((d) => !["closed_won", "closed_lost"].includes(d.stage))
            .reduce((sum, d) => sum + d.value, 0);

        const closedWonValue = deals
            .filter((d) => d.stage === "closed_won")
            .reduce((sum, d) => sum + d.value, 0);

        res.json({
            success: true,
            stats,
            totalPipeline,
            closedWonValue,
            totalDeals: deals.length,
        });
    } catch (error: unknown) {
        console.error("Deal stats error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});
