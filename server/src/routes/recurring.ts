import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { tenantFilter, tenantData } from "../lib/auth-middleware";
import { createNotification } from "./notifications";

export const recurringRouter = Router();

// ─── GET /api/recurring — All recurring items with company ───
recurringRouter.get("/", async (req: Request, res: Response) => {
    try {
        const items = await prisma.recurringItem.findMany({
            where: { ...tenantFilter(req) },
            orderBy: { createdAt: "desc" },
            include: { company: { select: { id: true, name: true } } },
        });
        // Summary stats
        const activeRevenue = items.filter((i: any) => i.type === "revenue" && i.isActive).reduce((s: number, i: any) => s + i.amount, 0);
        const activeExpense = items.filter((i: any) => i.type === "expense" && i.isActive).reduce((s: number, i: any) => s + i.amount, 0);
        res.json({ success: true, items, summary: { activeRevenue, activeExpense, net: activeRevenue - activeExpense } });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── POST /api/recurring — Create recurring item ───
recurringRouter.post("/", async (req: Request, res: Response) => {
    try {
        const { name, type, amount, frequency, category, nextDueDate, startDate, endDate, notes, companyId, currency } = req.body;
        if (!name || !type) { res.status(400).json({ error: "name and type are required" }); return; }

        const item = await prisma.recurringItem.create({
            data: {
                name, type,
                amount: parseFloat(amount) || 0,
                frequency: frequency || "monthly",
                category: category || "general",
                nextDueDate: nextDueDate || null,
                startDate: startDate || null,
                endDate: endDate || null,
                notes: notes || null,
                companyId: companyId || null,
                currency: currency || "USD",
                ...tenantData(req),
            },
            include: { company: { select: { id: true, name: true } } },
        });
        res.json({ success: true, item });

        createNotification(req.userId!, req.organizationId || null, {
          type: "success",
          title: "Recurring item created",
          message: `Recurring item "${item.name}" created.`,
          href: "/recurring",
          entity: "recurring",
          entityId: item.id,
        }).catch(() => {});
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── PUT /api/recurring/:id — Update recurring item ───
recurringRouter.put("/:id", async (req: Request, res: Response) => {
    try {
        const data: any = {};
        const strFields = ["name", "type", "frequency", "category", "nextDueDate", "startDate", "endDate", "notes", "companyId", "currency"];
        for (const f of strFields) { if (req.body[f] !== undefined) data[f] = req.body[f]; }
        if (req.body.amount !== undefined) data.amount = parseFloat(req.body.amount) || 0;
        if (req.body.isActive !== undefined) data.isActive = req.body.isActive;

        const existing = await prisma.recurringItem.findFirst({ where: { id: req.params.id as string, ...tenantFilter(req) } });
        if (!existing) { res.status(404).json({ error: "Item not found" }); return; }

        const item = await prisma.recurringItem.update({
            where: { id: existing.id },
            data,
            include: { company: { select: { id: true, name: true } } },
        });
        res.json({ success: true, item });

        if (data.isActive !== undefined) {
          createNotification(req.userId!, req.organizationId || null, {
            type: "info",
            title: "Recurring item toggled",
            message: `Recurring item "${item.name}" ${item.isActive ? "activated" : "deactivated"}.`,
            href: "/recurring",
            entity: "recurring",
            entityId: item.id,
          }).catch(() => {});
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── DELETE /api/recurring/:id ───
recurringRouter.delete("/:id", async (req: Request, res: Response) => {
    try {
        await prisma.recurringItem.deleteMany({ where: { id: req.params.id as string, ...tenantFilter(req) } });
        res.json({ success: true });

        createNotification(req.userId!, req.organizationId || null, {
          type: "info",
          title: "Recurring item deleted",
          message: `Recurring item has been deleted.`,
          href: "/recurring",
          entity: "recurring",
        }).catch(() => {});
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});
