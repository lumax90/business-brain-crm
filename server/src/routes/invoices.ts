import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { tenantFilter, tenantData } from "../lib/auth-middleware";
import { createNotification } from "./notifications";

export const invoicesRouter = Router();

interface LineItem {
    description: string;
    qty: number;
    unitPrice: number;
    total: number;
}

// ─── GET /api/invoices — All invoices ───
invoicesRouter.get("/", async (req: Request, res: Response) => {
    try {
        const invoices = await prisma.invoice.findMany({ where: { ...tenantFilter(req) }, orderBy: { createdAt: "desc" } });
        res.json({ success: true, invoices });
    } catch (error: unknown) {
        console.error("List invoices error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── POST /api/invoices — Create invoice ───
invoicesRouter.post("/", async (req: Request, res: Response) => {
    try {
        const { clientName, clientEmail, clientCompany, issueDate, dueDate, items, taxRate, notes, currency } = req.body;

        if (!clientName || !issueDate || !dueDate) {
            res.status(400).json({ error: "clientName, issueDate, and dueDate are required" });
            return;
        }

        const parsedItems: LineItem[] = Array.isArray(items) ? items : [];
        const subtotal = parsedItems.reduce((sum: number, i: LineItem) => sum + (i.qty * i.unitPrice), 0);
        const tax = taxRate ? subtotal * (taxRate / 100) : 0;
        const total = subtotal + tax;

        // Generate invoice number: INV-YYYYMMDD-XXX
        const count = await prisma.invoice.count({ where: { ...tenantFilter(req) } });
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const invoiceNumber = `INV-${today}-${String(count + 1).padStart(3, "0")}`;

        const invoice = await prisma.invoice.create({
            data: {
                invoiceNumber,
                clientName,
                clientEmail: clientEmail || null,
                clientCompany: clientCompany || null,
                issueDate,
                dueDate,
                items: JSON.stringify(parsedItems),
                subtotal,
                taxRate: taxRate || 0,
                taxAmount: tax,
                total,
                currency: currency || "USD",
                notes: notes || null,
                ...tenantData(req),
            },
        });

        createNotification(req.userId!, req.organizationId || null, { type: "success", title: "Invoice created", message: `Invoice #${invoice.invoiceNumber} created for ${invoice.clientName}.`, href: "/invoices", entity: "invoice", entityId: invoice.id }).catch(() => {});

        res.json({ success: true, invoice });
    } catch (error: unknown) {
        console.error("Create invoice error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── PUT /api/invoices/:id — Update invoice ───
invoicesRouter.put("/:id", async (req: Request, res: Response) => {
    try {
        const data: any = {};
        const fields = ["clientName", "clientEmail", "clientCompany", "status", "issueDate", "dueDate", "notes", "currency", "taxRate"];

        for (const field of fields) {
            if (req.body[field] !== undefined) data[field] = req.body[field];
        }

        // Recalculate totals if items changed
        if (req.body.items !== undefined) {
            const parsedItems: LineItem[] = Array.isArray(req.body.items) ? req.body.items : [];
            data.items = JSON.stringify(parsedItems);
            data.subtotal = parsedItems.reduce((sum: number, i: LineItem) => sum + (i.qty * i.unitPrice), 0);
            const taxRate = req.body.taxRate ?? (await prisma.invoice.findUnique({ where: { id: req.params.id as string } }))?.taxRate ?? 0;
            data.taxAmount = data.subtotal * (taxRate / 100);
            data.total = data.subtotal + data.taxAmount;
        }

        // Mark paid
        if (req.body.status === "paid" && !req.body.paidAt) {
            data.paidAt = new Date();
        }

        const existing = await prisma.invoice.findFirst({ where: { id: req.params.id as string, ...tenantFilter(req) } });
        if (!existing) { res.status(404).json({ error: "Invoice not found" }); return; }

        const invoice = await prisma.invoice.update({
            where: { id: existing.id },
            data,
        });

        if (data.status) {
            createNotification(req.userId!, req.organizationId || null, { type: "info", title: "Invoice updated", message: `Invoice status changed to ${data.status}.`, href: "/invoices", entity: "invoice", entityId: invoice.id }).catch(() => {});
        }

        res.json({ success: true, invoice });
    } catch (error: unknown) {
        console.error("Update invoice error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── DELETE /api/invoices/:id — Delete invoice ───
invoicesRouter.delete("/:id", async (req: Request, res: Response) => {
    try {
        await prisma.invoice.deleteMany({ where: { id: req.params.id as string, ...tenantFilter(req) } });

        createNotification(req.userId!, req.organizationId || null, { type: "info", title: "Invoice deleted", message: "An invoice was removed.", href: "/invoices", entity: "invoice" }).catch(() => {});

        res.json({ success: true });
    } catch (error: unknown) {
        console.error("Delete invoice error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});
