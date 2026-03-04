import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { tenantFilter, tenantData } from "../lib/auth-middleware";
import { createNotification } from "./notifications";

export const companiesRouter = Router();

// ─── GET /api/companies — All companies with contact count ───
companiesRouter.get("/", async (req: Request, res: Response) => {
    try {
        const companies = await prisma.company.findMany({
            where: { ...tenantFilter(req) },
            orderBy: { createdAt: "desc" },
            include: { _count: { select: { contacts: true } } },
        });
        res.json({ success: true, companies });
    } catch (error: unknown) {
        console.error("List companies error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── POST /api/companies — Create company ───
companiesRouter.post("/", async (req: Request, res: Response) => {
    try {
        const { name, domain, industry, size, website, phone, address, notes } = req.body;
        if (!name) { res.status(400).json({ error: "name is required" }); return; }

        const company = await prisma.company.create({
            data: {
                name, domain: domain || null, industry: industry || null,
                size: size || null, website: website || null, phone: phone || null,
                address: address || null, notes: notes || null,
                ...tenantData(req),
            },
        });
        createNotification(req.userId!, req.organizationId || null, { type: "success", title: "Company created", message: `Company "${company.name}" added.`, href: "/companies", entity: "company", entityId: company.id }).catch(() => {});
        res.json({ success: true, company });
    } catch (error: unknown) {
        console.error("Create company error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── PUT /api/companies/:id — Update company ───
companiesRouter.put("/:id", async (req: Request, res: Response) => {
    try {
        const data: any = {};
        const fields = ["name", "domain", "industry", "size", "website", "phone", "address", "notes"];
        for (const f of fields) { if (req.body[f] !== undefined) data[f] = req.body[f]; }

        const existing = await prisma.company.findFirst({ where: { id: req.params.id as string, ...tenantFilter(req) } });
        if (!existing) { res.status(404).json({ error: "Company not found" }); return; }

        const company = await prisma.company.update({ where: { id: existing.id }, data });
        res.json({ success: true, company });
    } catch (error: unknown) {
        console.error("Update company error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── DELETE /api/companies/:id ───
companiesRouter.delete("/:id", async (req: Request, res: Response) => {
    try {
        await prisma.company.deleteMany({ where: { id: req.params.id as string, ...tenantFilter(req) } });
        createNotification(req.userId!, req.organizationId || null, { type: "info", title: "Company deleted", message: "A company was removed.", href: "/companies", entity: "company" }).catch(() => {});
        res.json({ success: true });
    } catch (error: unknown) {
        console.error("Delete company error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});
