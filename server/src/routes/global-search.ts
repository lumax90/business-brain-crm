import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { tenantFilter } from "../lib/auth-middleware";

export const globalSearchRouter = Router();

interface SearchResult {
    id: string;
    type: string;
    title: string;
    subtitle?: string;
    href: string;
    extra?: string;
}

// ── GET /api/global-search?q=xxx&limit=20 ──
globalSearchRouter.get("/", async (req: Request, res: Response) => {
    try {
        const q = String(req.query.q || "").trim();
        const limit = Math.min(Number(req.query.limit) || 20, 50);

        if (!q || q.length < 2) {
            return res.json({ results: [], query: q });
        }

        const results: SearchResult[] = [];

        // Run all searches in parallel
        const [leads, contacts, companies, deals, invoices, proposals, projects, campaigns, expenses, files] =
            await Promise.all([
                // Leads
                prisma.lead.findMany({
                    where: {
                        ...tenantFilter(req),
                        OR: [
                            { name: { contains: q } },
                            { email: { contains: q } },
                            { company: { contains: q } },
                            { title: { contains: q } },
                        ],
                    },
                    select: { id: true, name: true, email: true, company: true, status: true },
                    take: 5,
                }),
                // Contacts
                prisma.contact.findMany({
                    where: {
                        ...tenantFilter(req),
                        OR: [
                            { name: { contains: q } },
                            { email: { contains: q } },
                            { phone: { contains: q } },
                            { role: { contains: q } },
                        ],
                    },
                    select: { id: true, name: true, email: true, role: true },
                    take: 5,
                }),
                // Companies
                prisma.company.findMany({
                    where: {
                        ...tenantFilter(req),
                        OR: [
                            { name: { contains: q } },
                            { domain: { contains: q } },
                            { industry: { contains: q } },
                        ],
                    },
                    select: { id: true, name: true, domain: true, industry: true },
                    take: 5,
                }),
                // Deals
                prisma.deal.findMany({
                    where: {
                        ...tenantFilter(req),
                        OR: [
                            { title: { contains: q } },
                            { company: { contains: q } },
                            { contactName: { contains: q } },
                        ],
                    },
                    select: { id: true, title: true, company: true, stage: true, value: true, currency: true },
                    take: 5,
                }),
                // Invoices
                prisma.invoice.findMany({
                    where: {
                        ...tenantFilter(req),
                        OR: [
                            { invoiceNumber: { contains: q } },
                            { clientName: { contains: q } },
                            { clientCompany: { contains: q } },
                        ],
                    },
                    select: { id: true, invoiceNumber: true, clientName: true, status: true, total: true, currency: true },
                    take: 5,
                }),
                // Proposals
                prisma.proposal.findMany({
                    where: {
                        ...tenantFilter(req),
                        OR: [
                            { title: { contains: q } },
                            { proposalNumber: { contains: q } },
                            { clientName: { contains: q } },
                        ],
                    },
                    select: { id: true, title: true, proposalNumber: true, clientName: true, status: true },
                    take: 5,
                }),
                // Projects
                prisma.project.findMany({
                    where: {
                        ...tenantFilter(req),
                        OR: [
                            { name: { contains: q } },
                            { description: { contains: q } },
                        ],
                    },
                    select: { id: true, name: true, status: true, priority: true },
                    take: 5,
                }),
                // Campaigns
                prisma.campaign.findMany({
                    where: {
                        ...tenantFilter(req),
                        OR: [
                            { name: { contains: q } },
                            { description: { contains: q } },
                        ],
                    },
                    select: { id: true, name: true, status: true, type: true },
                    take: 5,
                }),
                // Expenses
                prisma.expense.findMany({
                    where: {
                        ...tenantFilter(req),
                        OR: [
                            { description: { contains: q } },
                            { vendor: { contains: q } },
                            { category: { contains: q } },
                        ],
                    },
                    select: { id: true, description: true, vendor: true, amount: true, currency: true, category: true },
                    take: 5,
                }),
                // Files
                prisma.file.findMany({
                    where: {
                        ...tenantFilter(req),
                        OR: [
                            { name: { contains: q } },
                            { originalName: { contains: q } },
                            { description: { contains: q } },
                            { entityName: { contains: q } },
                        ],
                    },
                    select: { id: true, name: true, originalName: true, mimeType: true, folder: true },
                    take: 5,
                }),
            ]);

        // Map results
        for (const l of leads) {
            results.push({
                id: l.id,
                type: "lead",
                title: l.name || l.email || "Unnamed Lead",
                subtitle: [l.company, l.email].filter(Boolean).join(" · "),
                href: "/leads",
                extra: l.status,
            });
        }
        for (const c of contacts) {
            results.push({
                id: c.id,
                type: "contact",
                title: c.name,
                subtitle: [c.role, c.email].filter(Boolean).join(" · "),
                href: "/contacts",
            });
        }
        for (const c of companies) {
            results.push({
                id: c.id,
                type: "company",
                title: c.name,
                subtitle: [c.industry, c.domain].filter(Boolean).join(" · "),
                href: "/companies",
            });
        }
        for (const d of deals) {
            results.push({
                id: d.id,
                type: "deal",
                title: d.title,
                subtitle: d.company || undefined,
                href: "/pipeline",
                extra: `${d.currency} ${d.value.toLocaleString()}`,
            });
        }
        for (const i of invoices) {
            results.push({
                id: i.id,
                type: "invoice",
                title: `${i.invoiceNumber} — ${i.clientName}`,
                subtitle: i.status,
                href: "/invoices",
                extra: `${i.currency} ${i.total.toLocaleString()}`,
            });
        }
        for (const p of proposals) {
            results.push({
                id: p.id,
                type: "proposal",
                title: p.title || p.proposalNumber,
                subtitle: p.clientName,
                href: "/proposals",
                extra: p.status,
            });
        }
        for (const p of projects) {
            results.push({
                id: p.id,
                type: "project",
                title: p.name,
                subtitle: p.priority,
                href: "/projects",
                extra: p.status,
            });
        }
        for (const c of campaigns) {
            results.push({
                id: c.id,
                type: "campaign",
                title: c.name,
                subtitle: c.type,
                href: "/campaigns",
                extra: c.status,
            });
        }
        for (const e of expenses) {
            results.push({
                id: e.id,
                type: "expense",
                title: e.description,
                subtitle: [e.vendor, e.category].filter(Boolean).join(" · "),
                href: "/expenses",
                extra: `${e.currency} ${e.amount.toLocaleString()}`,
            });
        }
        for (const f of files) {
            results.push({
                id: f.id,
                type: "file",
                title: f.name || f.originalName,
                subtitle: [f.folder, f.mimeType].filter(Boolean).join(" · "),
                href: "/files",
            });
        }

        // Trim to limit
        res.json({
            results: results.slice(0, limit),
            total: results.length,
            query: q,
        });
    } catch (err) {
        console.error("Global search error:", err);
        res.status(500).json({ error: "Search failed" });
    }
});
