import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { tenantFilter, tenantData } from "../lib/auth-middleware";

export const listsRouter = Router();

// ─── GET /api/lists — All lists with lead count ───
listsRouter.get("/", async (req: Request, res: Response) => {
    try {
        const lists = await prisma.leadList.findMany({
            where: { ...tenantFilter(req) },
            orderBy: { createdAt: "desc" },
            include: { _count: { select: { leads: true } } },
        });

        res.json({
            success: true,
            lists: lists.map((l) => ({
                id: l.id,
                name: l.name,
                description: l.description,
                color: l.color,
                leadCount: l._count.leads,
                createdAt: l.createdAt,
                updatedAt: l.updatedAt,
            })),
        });
    } catch (error: unknown) {
        console.error("List lists error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── POST /api/lists — Create list ───
listsRouter.post("/", async (req: Request, res: Response) => {
    try {
        const { name, description, color } = req.body;
        if (!name) {
            res.status(400).json({ error: "name is required" });
            return;
        }

        const list = await prisma.leadList.create({
            data: { name, description: description || null, color: color || "#6366f1", ...tenantData(req) },
        });

        res.json({ success: true, list });
    } catch (error: unknown) {
        console.error("Create list error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── PUT /api/lists/:id — Update list ───
listsRouter.put("/:id", async (req: Request, res: Response) => {
    try {
        const { name, description, color } = req.body;
        const data: any = {};
        if (name !== undefined) data.name = name;
        if (description !== undefined) data.description = description;
        if (color !== undefined) data.color = color;

        const existing = await prisma.leadList.findFirst({ where: { id: req.params.id as string, ...tenantFilter(req) } });
        if (!existing) { res.status(404).json({ error: "List not found" }); return; }

        const list = await prisma.leadList.update({
            where: { id: existing.id },
            data,
        });

        res.json({ success: true, list });
    } catch (error: unknown) {
        console.error("Update list error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── DELETE /api/lists/:id — Delete list (keeps leads, unlinks them) ───
listsRouter.delete("/:id", async (req: Request, res: Response) => {
    try {
        await prisma.leadList.deleteMany({ where: { id: req.params.id as string, ...tenantFilter(req) } });
        res.json({ success: true });
    } catch (error: unknown) {
        console.error("Delete list error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});
