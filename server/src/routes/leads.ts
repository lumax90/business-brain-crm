import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { tenantFilter, tenantData } from "../lib/auth-middleware";
import { createNotification } from "./notifications";

export const leadsRouter = Router();

// Known core fields that map directly to Lead columns
const CORE_FIELDS = [
    "name",
    "email",
    "company",
    "title",
    "phone",
    "linkedinUrl",
    "location",
    "website",
    "status",
    "source",
    "score",
    "tags",
    "notes",
];

// ─── GET /api/leads — List with pagination, search, filter, sort ───
leadsRouter.get("/", async (req: Request, res: Response) => {
    try {
        const {
            page = "1",
            limit = "50",
            search,
            status,
            source,
            listId,
            sort = "createdAt",
            order = "desc",
        } = req.query as Record<string, string>;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        const where: any = { ...tenantFilter(req) };

        if (search) {
            where.OR = [
                { name: { contains: search } },
                { email: { contains: search } },
                { company: { contains: search } },
                { title: { contains: search } },
            ];
        }

        if (status && status !== "all") {
            where.status = status;
        }

        if (source && source !== "all") {
            where.source = source;
        }

        if (listId && listId !== "all") {
            where.listId = listId;
        }

        const [leads, total] = await Promise.all([
            prisma.lead.findMany({
                where,
                skip,
                take,
                orderBy: { [sort]: order },
            }),
            prisma.lead.count({ where }),
        ]);

        // Parse JSON fields for the response
        const parsed = leads.map((lead) => ({
            ...lead,
            tags: JSON.parse(lead.tags || "[]"),
            customFields: JSON.parse(lead.customFields || "{}"),
        }));

        res.json({
            success: true,
            leads: parsed,
            pagination: {
                page: parseInt(page),
                limit: take,
                total,
                totalPages: Math.ceil(total / take),
            },
        });
    } catch (error: unknown) {
        console.error("List leads error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── GET /api/leads/columns — Returns all known columns (core + custom keys) ───
leadsRouter.get("/columns", async (req: Request, res: Response) => {
    try {
        // Get all unique custom field keys from the DB
        const allLeads = await prisma.lead.findMany({
            where: { ...tenantFilter(req) },
            select: { customFields: true },
            take: 500,
        });

        const customKeys = new Set<string>();
        for (const lead of allLeads) {
            try {
                const parsed = JSON.parse(lead.customFields || "{}");
                Object.keys(parsed).forEach((key) => customKeys.add(key));
            } catch { }
        }

        res.json({
            success: true,
            coreFields: CORE_FIELDS,
            customFields: Array.from(customKeys),
        });
    } catch (error: unknown) {
        console.error("Get columns error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── GET /api/leads/stats — Dashboard stats ───
leadsRouter.get("/stats", async (req: Request, res: Response) => {
    try {
        const tf = tenantFilter(req);
        const total = await prisma.lead.count({ where: tf });
        const byStatus = await prisma.lead.groupBy({
            by: ["status"],
            where: tf,
            _count: true,
        });
        const bySources = await prisma.lead.groupBy({
            by: ["source"],
            where: tf,
            _count: true,
        });

        // Leads created this week
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const newThisWeek = await prisma.lead.count({
            where: { ...tf, createdAt: { gte: weekAgo } },
        });

        res.json({
            success: true,
            total,
            newThisWeek,
            byStatus: Object.fromEntries(
                byStatus.map((s) => [s.status, s._count])
            ),
            bySource: Object.fromEntries(
                bySources.map((s) => [s.source, s._count])
            ),
        });
    } catch (error: unknown) {
        console.error("Stats error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── GET /api/leads/:id — Single lead ───
leadsRouter.get("/:id", async (req: Request, res: Response) => {
    try {
        const lead = await prisma.lead.findFirst({ where: { id: req.params.id as string, ...tenantFilter(req) } });
        if (!lead) {
            res.status(404).json({ error: "Lead not found" });
            return;
        }

        res.json({
            success: true,
            lead: {
                ...lead,
                tags: JSON.parse(lead.tags || "[]"),
                customFields: JSON.parse(lead.customFields || "{}"),
            },
        });
    } catch (error: unknown) {
        console.error("Get lead error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── POST /api/leads — Create single lead ───
leadsRouter.post("/", async (req: Request, res: Response) => {
    try {
        const data = buildLeadData(req.body);
        const lead = await prisma.lead.create({ data: { ...data, ...tenantData(req) } });

        createNotification(req.userId!, req.organizationId || null, {
            type: "success", title: "Lead created", message: `New lead "${data.name || data.email}" added.`,
            href: "/leads", entity: "lead", entityId: lead.id,
        }).catch(() => {});

        res.json({
            success: true,
            lead: {
                ...lead,
                tags: JSON.parse(lead.tags || "[]"),
                customFields: JSON.parse(lead.customFields || "{}"),
            },
        });
    } catch (error: unknown) {
        console.error("Create lead error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── POST /api/leads/import — Bulk import with column mapping ───
leadsRouter.post("/import", async (req: Request, res: Response) => {
    try {
        const { leads, mapping, listId } = req.body as {
            leads: Record<string, any>[];
            mapping: Record<string, string>;
            listId?: string;
        };

        if (!leads || !Array.isArray(leads) || leads.length === 0) {
            res.status(400).json({ error: "No leads provided" });
            return;
        }

        console.log(`📥 Importing ${leads.length} leads...${listId ? ` → list: ${listId}` : ' → no list'}`);

        let imported = 0;
        let skipped = 0;

        // Process in batches of 100
        const batchSize = 100;
        for (let i = 0; i < leads.length; i += batchSize) {
            const batch = leads.slice(i, i + batchSize);

            const createData = batch.map((row) => {
                const lead: any = {};
                const customFields: Record<string, any> = {};

                for (const [csvCol, targetField] of Object.entries(mapping)) {
                    const value = row[csvCol];
                    if (value === undefined || value === null || value === "") continue;

                    if (targetField === "skip") continue;

                    if (targetField.startsWith("custom:")) {
                        const customKey = targetField.replace("custom:", "");
                        customFields[customKey] = value;
                    } else if (CORE_FIELDS.includes(targetField)) {
                        if (targetField === "score") {
                            lead[targetField] = parseInt(value) || 0;
                        } else if (targetField === "tags") {
                            // Handle tags: could be comma-separated string or already an array
                            if (Array.isArray(value)) {
                                lead[targetField] = JSON.stringify(value);
                            } else {
                                lead[targetField] = JSON.stringify(
                                    String(value)
                                        .split(",")
                                        .map((t: string) => t.trim())
                                        .filter(Boolean)
                                );
                            }
                        } else {
                            lead[targetField] = String(value);
                        }
                    }
                }

                lead.customFields = JSON.stringify(customFields);
                if (!lead.tags) lead.tags = "[]";
                if (!lead.source) lead.source = "csv_import";
                if (!lead.status) lead.status = "new";
                if (listId) lead.listId = listId;

                return { ...lead, ...tenantData(req) };
            });

            await prisma.lead.createMany({ data: createData });
            imported += createData.length;
        }

        console.log(`✅ Imported ${imported} leads, skipped ${skipped}`);

        const total = await prisma.lead.count({ where: { ...tenantFilter(req) } });

        createNotification(req.userId!, req.organizationId || null, {
            type: "success", title: "Import complete", message: `${imported} leads imported successfully.`,
            href: "/leads", entity: "lead",
        }).catch(() => {});

        res.json({
            success: true,
            imported,
            skipped,
            total,
        });
    } catch (error: unknown) {
        console.error("Import error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── PUT /api/leads/:id — Update ───
leadsRouter.put("/:id", async (req: Request, res: Response) => {
    try {
        const existing = await prisma.lead.findFirst({ where: { id: req.params.id as string, ...tenantFilter(req) } });
        if (!existing) { res.status(404).json({ error: "Lead not found" }); return; }
        const data = buildLeadData(req.body);
        const lead = await prisma.lead.update({
            where: { id: existing.id },
            data,
        });

        res.json({
            success: true,
            lead: {
                ...lead,
                tags: JSON.parse(lead.tags || "[]"),
                customFields: JSON.parse(lead.customFields || "{}"),
            },
        });
    } catch (error: unknown) {
        console.error("Update lead error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── DELETE /api/leads/:id — Delete ───
leadsRouter.delete("/:id", async (req: Request, res: Response) => {
    try {
        await prisma.lead.deleteMany({ where: { id: req.params.id as string, ...tenantFilter(req) } });

        createNotification(req.userId!, req.organizationId || null, {
            type: "info", title: "Lead deleted", message: "A lead was removed.",
            href: "/leads", entity: "lead",
        }).catch(() => {});

        res.json({ success: true });
    } catch (error: unknown) {
        console.error("Delete lead error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── POST /api/leads/bulk-delete — Delete multiple by IDs ───
leadsRouter.post("/bulk-delete", async (req: Request, res: Response) => {
    try {
        const { ids } = req.body as { ids: string[] };
        if (!ids || !Array.isArray(ids)) {
            res.status(400).json({ error: "ids array required" });
            return;
        }
        const result = await prisma.lead.deleteMany({ where: { id: { in: ids }, ...tenantFilter(req) } });
        res.json({ success: true, deleted: result.count });
    } catch (error: unknown) {
        console.error("Bulk delete error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── POST /api/leads/bulk-move — Move leads to a list ───
leadsRouter.post("/bulk-move", async (req: Request, res: Response) => {
    try {
        const { ids, listId } = req.body as { ids: string[]; listId: string | null };
        if (!ids || !Array.isArray(ids)) {
            res.status(400).json({ error: "ids array required" });
            return;
        }
        const result = await prisma.lead.updateMany({
            where: { id: { in: ids }, ...tenantFilter(req) },
            data: { listId: listId || null },
        });
        res.json({ success: true, updated: result.count });
    } catch (error: unknown) {
        console.error("Bulk move error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── POST /api/leads/bulk-status — Update status for multiple leads ───
leadsRouter.post("/bulk-status", async (req: Request, res: Response) => {
    try {
        const { ids, status } = req.body as { ids: string[]; status: string };
        if (!ids || !Array.isArray(ids) || !status) {
            res.status(400).json({ error: "ids array and status required" });
            return;
        }
        const result = await prisma.lead.updateMany({
            where: { id: { in: ids }, ...tenantFilter(req) },
            data: { status },
        });
        res.json({ success: true, updated: result.count });
    } catch (error: unknown) {
        console.error("Bulk status error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── DELETE /api/leads — Delete ALL ───
leadsRouter.delete("/", async (req: Request, res: Response) => {
    try {
        const result = await prisma.lead.deleteMany({ where: { ...tenantFilter(req) } });
        res.json({ success: true, deleted: result.count });
    } catch (error: unknown) {
        console.error("Delete all error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── Helper: Build lead data from request body ───
function buildLeadData(body: Record<string, any>) {
    const data: any = {};
    const customFields: Record<string, any> = {};

    for (const [key, value] of Object.entries(body)) {
        if (key === "customFields" && typeof value === "object") {
            Object.assign(customFields, value);
        } else if (CORE_FIELDS.includes(key)) {
            if (key === "tags") {
                data[key] = JSON.stringify(
                    Array.isArray(value) ? value : [value].filter(Boolean)
                );
            } else if (key === "score") {
                data[key] = parseInt(value) || 0;
            } else {
                data[key] = value;
            }
        } else if (key !== "id" && key !== "createdAt" && key !== "updatedAt") {
            customFields[key] = value;
        }
    }

    data.customFields = JSON.stringify(customFields);

    return data;
}

// ─── POST /api/leads/move-to-list — Bulk move leads to a list ───
leadsRouter.post("/move-to-list", async (req: Request, res: Response) => {
    try {
        const { leadIds, listId } = req.body as { leadIds: string[]; listId: string };
        if (!leadIds || !Array.isArray(leadIds) || !listId) {
            res.status(400).json({ error: "leadIds array and listId are required" });
            return;
        }

        const result = await prisma.lead.updateMany({
            where: { id: { in: leadIds }, ...tenantFilter(req) },
            data: { listId },
        });

        console.log(`📦 Moved ${result.count} leads to list ${listId}`);

        res.json({ success: true, moved: result.count });
    } catch (error: unknown) {
        console.error("Move to list error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── POST /api/leads/:id/convert — Convert a Lead to CRM Contact & Company ───
leadsRouter.post("/:id/convert", async (req: Request, res: Response) => {
    try {
        const lead = await prisma.lead.findFirst({
            where: { id: req.params.id as string, ...tenantFilter(req) },
        });

        if (!lead) {
            res.status(404).json({ error: "Lead not found" });
            return;
        }

        let companyId = null;

        // 1. Create or Find Company if the lead has a company name
        if (lead.company) {
            let company = await prisma.company.findFirst({
                where: { name: lead.company, ...tenantFilter(req) },
            });

            if (!company) {
                company = await prisma.company.create({
                    data: {
                        name: lead.company,
                        website: lead.website || null,
                        ...tenantData(req),
                    },
                });
            }
            companyId = company.id;
        }

        // 2. Create the Contact
        const contact = await prisma.contact.create({
            data: {
                name: lead.name || "Unknown Contact",
                email: lead.email || null,
                phone: lead.phone || null,
                role: lead.title || null,
                companyId,
                notes: lead.notes ? `Converted from Lead:\n${lead.notes}` : "Converted from Lead",
                source: "lead_conversion",
                leadId: lead.id,
                ...tenantData(req),
            },
        });

        // 3. Mark lead as converted
        await prisma.lead.update({
            where: { id: lead.id },
            data: { status: "converted" },
        });

        res.json({ success: true, contact, message: "Lead successfully converted to Contact." });
    } catch (error: unknown) {
        console.error("Convert lead error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});
