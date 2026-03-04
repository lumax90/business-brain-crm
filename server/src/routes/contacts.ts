import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { tenantFilter, tenantData } from "../lib/auth-middleware";
import { createNotification } from "./notifications";

export const contactsRouter = Router();

// ─── GET /api/contacts — All contacts with company ───
contactsRouter.get("/", async (req: Request, res: Response) => {
    try {
        const contacts = await prisma.contact.findMany({
            where: { ...tenantFilter(req) },
            orderBy: { createdAt: "desc" },
            include: { company: { select: { id: true, name: true } } },
        });
        res.json({ success: true, contacts });
    } catch (error: unknown) {
        console.error("List contacts error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── POST /api/contacts — Create contact ───
contactsRouter.post("/", async (req: Request, res: Response) => {
    try {
        const { name, email, phone, role, tags, notes, source, companyId, leadId } = req.body;
        if (!name) { res.status(400).json({ error: "name is required" }); return; }

        const contact = await prisma.contact.create({
            data: {
                name, email: email || null, phone: phone || null,
                role: role || null, tags: tags ? JSON.stringify(tags) : "[]",
                notes: notes || null, source: source || "manual",
                companyId: companyId || null, leadId: leadId || null,
                ...tenantData(req),
            },
            include: { company: { select: { id: true, name: true } } },
        });
        createNotification(req.userId!, req.organizationId || null, { type: "success", title: "Contact created", message: `Contact "${contact.name}" added.`, href: "/contacts", entity: "contact", entityId: contact.id }).catch(() => {});
        res.json({ success: true, contact });
    } catch (error: unknown) {
        console.error("Create contact error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── POST /api/contacts/from-lead/:leadId — Convert lead to contact ───
contactsRouter.post("/from-lead/:leadId", async (req: Request, res: Response) => {
    try {
        const lead = await prisma.lead.findFirst({ where: { id: req.params.leadId as string, ...tenantFilter(req) } });
        if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }

        // Check if contact with this email already exists
        if (lead.email) {
            const existing = await prisma.contact.findFirst({ where: { email: lead.email, ...tenantFilter(req) } });
            if (existing) { res.status(409).json({ error: "Contact with this email already exists", contact: existing }); return; }
        }

        const contact = await prisma.contact.create({
            data: {
                name: lead.name || "Unknown",
                email: lead.email || null,
                phone: lead.phone || null,
                role: lead.title || null,
                tags: lead.tags || "[]",
                notes: lead.notes || null,
                source: "lead_conversion",
                leadId: lead.id,
                ...tenantData(req),
            },
            include: { company: { select: { id: true, name: true } } },
        });

        // Update lead status
        await prisma.lead.update({ where: { id: lead.id }, data: { status: "qualified" } });

        res.json({ success: true, contact });
    } catch (error: unknown) {
        console.error("Convert lead error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── PUT /api/contacts/:id — Update contact ───
contactsRouter.put("/:id", async (req: Request, res: Response) => {
    try {
        const data: any = {};
        const fields = ["name", "email", "phone", "role", "notes", "companyId", "lastContactedAt"];
        for (const f of fields) { if (req.body[f] !== undefined) data[f] = req.body[f]; }
        if (req.body.tags !== undefined) data.tags = JSON.stringify(req.body.tags);

        const existing = await prisma.contact.findFirst({ where: { id: req.params.id as string, ...tenantFilter(req) } });
        if (!existing) { res.status(404).json({ error: "Contact not found" }); return; }

        const contact = await prisma.contact.update({
            where: { id: existing.id },
            data,
            include: { company: { select: { id: true, name: true } } },
        });
        res.json({ success: true, contact });
    } catch (error: unknown) {
        console.error("Update contact error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── DELETE /api/contacts/:id ───
contactsRouter.delete("/:id", async (req: Request, res: Response) => {
    try {
        await prisma.contact.deleteMany({ where: { id: req.params.id as string, ...tenantFilter(req) } });
        createNotification(req.userId!, req.organizationId || null, { type: "info", title: "Contact deleted", message: "A contact was removed.", href: "/contacts", entity: "contact" }).catch(() => {});
        res.json({ success: true });
    } catch (error: unknown) {
        console.error("Delete contact error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});
