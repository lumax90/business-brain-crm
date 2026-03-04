import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { tenantFilter, tenantData } from "../lib/auth-middleware";
import { createNotification } from "./notifications";

export const proposalsRouter = Router();

// Auto-generate proposal number
async function generateProposalNumber(filter: any): Promise<string> {
    const count = await prisma.proposal.count({ where: filter });
    const num = (count + 1).toString().padStart(4, "0");
    return `PRP-${num}`;
}

// ─── GET /api/proposals — All proposals ───
proposalsRouter.get("/", async (req: Request, res: Response) => {
    try {
        const proposals = await prisma.proposal.findMany({
            where: { ...tenantFilter(req) },
            orderBy: { createdAt: "desc" },
            include: {
                company: { select: { id: true, name: true } },
                contact: { select: { id: true, name: true } },
            },
        });
        res.json({ success: true, proposals });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── POST /api/proposals — Create proposal ───
proposalsRouter.post("/", async (req: Request, res: Response) => {
    try {
        const { title, clientName, clientEmail, clientCompany, validUntil, items, taxRate, notes, terms, companyId, contactId } = req.body;
        if (!clientName || !title) { res.status(400).json({ error: "title and clientName are required" }); return; }

        const parsedItems = Array.isArray(items) ? items : [];
        const subtotal = parsedItems.reduce((sum: number, i: any) => sum + (i.qty || 0) * (i.unitPrice || 0), 0);
        const rate = parseFloat(taxRate) || 0;
        const taxAmount = subtotal * (rate / 100);
        const total = subtotal + taxAmount;

        const proposalNumber = await generateProposalNumber(tenantFilter(req));

        const proposal = await prisma.proposal.create({
            data: {
                proposalNumber, title,
                clientName, clientEmail: clientEmail || null,
                clientCompany: clientCompany || null,
                validUntil: validUntil || null,
                items: JSON.stringify(parsedItems),
                subtotal, taxRate: rate, taxAmount, total,
                notes: notes || null, terms: terms || null,
                companyId: companyId || null, contactId: contactId || null,
                ...tenantData(req),
            },
            include: {
                company: { select: { id: true, name: true } },
                contact: { select: { id: true, name: true } },
            },
        });
        res.json({ success: true, proposal });

        createNotification(req.userId!, req.organizationId || null, {
          type: "success",
          title: "Proposal created",
          message: `Proposal "${proposal.title}" (${proposal.proposalNumber}) created.`,
          href: "/proposals",
          entity: "proposal",
          entityId: proposal.id,
        }).catch(() => {});
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── PUT /api/proposals/:id — Update proposal ───
proposalsRouter.put("/:id", async (req: Request, res: Response) => {
    try {
        const data: any = {};
        const fields = ["title", "clientName", "clientEmail", "clientCompany", "status", "validUntil", "notes", "terms", "companyId", "contactId"];
        for (const f of fields) { if (req.body[f] !== undefined) data[f] = req.body[f]; }

        if (req.body.items !== undefined) {
            const parsedItems = Array.isArray(req.body.items) ? req.body.items : [];
            data.items = JSON.stringify(parsedItems);
            data.subtotal = parsedItems.reduce((sum: number, i: any) => sum + (i.qty || 0) * (i.unitPrice || 0), 0);
            data.taxRate = parseFloat(req.body.taxRate) || 0;
            data.taxAmount = data.subtotal * (data.taxRate / 100);
            data.total = data.subtotal + data.taxAmount;
        }

        const existing = await prisma.proposal.findFirst({ where: { id: req.params.id as string, ...tenantFilter(req) } });
        if (!existing) { res.status(404).json({ error: "Proposal not found" }); return; }

        const proposal = await prisma.proposal.update({
            where: { id: existing.id },
            data,
            include: {
                company: { select: { id: true, name: true } },
                contact: { select: { id: true, name: true } },
            },
        });
        res.json({ success: true, proposal });

        if (data.status) {
          createNotification(req.userId!, req.organizationId || null, {
            type: "info",
            title: "Proposal status updated",
            message: `Proposal "${proposal.title}" status changed to ${proposal.status}.`,
            href: "/proposals",
            entity: "proposal",
            entityId: proposal.id,
          }).catch(() => {});
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── POST /api/proposals/:id/convert — Convert accepted proposal to invoice ───
proposalsRouter.post("/:id/convert", async (req: Request, res: Response) => {
    try {
        const proposal = await prisma.proposal.findFirst({ where: { id: req.params.id as string, ...tenantFilter(req) } });
        if (!proposal) { res.status(404).json({ error: "Proposal not found" }); return; }
        if (proposal.convertedToInvoiceId) { res.status(400).json({ error: "Already converted to invoice" }); return; }

        // Generate invoice number
        const invCount = await prisma.invoice.count({ where: { ...tenantFilter(req) } });
        const invoiceNumber = `INV-${(invCount + 1).toString().padStart(4, "0")}`;

        // Create invoice from proposal data
        const today = new Date().toISOString().slice(0, 10);
        const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

        const invoice = await prisma.invoice.create({
            data: {
                invoiceNumber,
                clientName: proposal.clientName,
                clientEmail: proposal.clientEmail,
                clientCompany: proposal.clientCompany,
                status: "draft",
                issueDate: today,
                dueDate,
                items: proposal.items,
                subtotal: proposal.subtotal,
                taxRate: proposal.taxRate,
                taxAmount: proposal.taxAmount,
                total: proposal.total,
                currency: proposal.currency,
                notes: `Converted from proposal ${proposal.proposalNumber}`,
                ...tenantData(req),
            },
        });

        // Mark proposal as converted
        await prisma.proposal.update({
            where: { id: proposal.id },
            data: { status: "accepted", convertedToInvoiceId: invoice.id },
        });

        res.json({ success: true, invoice, message: `Created invoice ${invoiceNumber} from proposal ${proposal.proposalNumber}` });

        createNotification(req.userId!, req.organizationId || null, {
          type: "info",
          title: "Proposal converted to invoice",
          message: `Proposal ${proposal.proposalNumber} converted to invoice ${invoiceNumber}.`,
          href: "/proposals",
          entity: "proposal",
          entityId: proposal.id,
        }).catch(() => {});
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── DELETE /api/proposals/:id ───
proposalsRouter.delete("/:id", async (req: Request, res: Response) => {
    try {
        await prisma.proposal.deleteMany({ where: { id: req.params.id as string, ...tenantFilter(req) } });
        res.json({ success: true });

        createNotification(req.userId!, req.organizationId || null, {
          type: "info",
          title: "Proposal deleted",
          message: `Proposal has been deleted.`,
          href: "/proposals",
          entity: "proposal",
        }).catch(() => {});
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});
