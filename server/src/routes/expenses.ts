import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { tenantFilter, tenantData } from "../lib/auth-middleware";
import { createNotification } from "./notifications";

export const expensesRouter = Router();

// ─── GET /api/expenses — All expenses ───
expensesRouter.get("/", async (req: Request, res: Response) => {
    try {
        const expenses = await prisma.expense.findMany({ where: { ...tenantFilter(req) }, orderBy: { date: "desc" } });
        res.json({ success: true, expenses });
    } catch (error: unknown) {
        console.error("List expenses error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── GET /api/expenses/summary — Monthly summary ───
expensesRouter.get("/summary", async (req: Request, res: Response) => {
    try {
        const expenses = await prisma.expense.findMany({ where: { ...tenantFilter(req) } });

        // Group by category
        const byCategory: Record<string, number> = {};
        let totalExpenses = 0;
        let recurringTotal = 0;

        for (const exp of expenses) {
            byCategory[exp.category] = (byCategory[exp.category] || 0) + exp.amount;
            totalExpenses += exp.amount;
            if (exp.recurring) recurringTotal += exp.amount;
        }

        res.json({
            success: true,
            totalExpenses,
            recurringTotal,
            byCategory,
            count: expenses.length,
        });
    } catch (error: unknown) {
        console.error("Expense summary error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── POST /api/expenses — Create expense ───
expensesRouter.post("/", async (req: Request, res: Response) => {
    try {
        const { description, category, amount, currency, date, vendor, recurring, recurPeriod, notes } = req.body;

        if (!description || !amount || !date) {
            res.status(400).json({ error: "description, amount, and date are required" });
            return;
        }

        const expense = await prisma.expense.create({
            data: {
                description,
                category: category || "other",
                amount: parseFloat(amount) || 0,
                currency: currency || "USD",
                date,
                vendor: vendor || null,
                recurring: recurring || false,
                recurPeriod: recurPeriod || null,
                notes: notes || null,
                ...tenantData(req),
            },
        });

        res.json({ success: true, expense });

        createNotification(req.userId!, req.organizationId || null, {
          type: "success",
          title: "Expense created",
          message: `Expense "${expense.description}" created.`,
          href: "/expenses",
          entity: "expense",
          entityId: expense.id,
        }).catch(() => {});
    } catch (error: unknown) {
        console.error("Create expense error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── PUT /api/expenses/:id — Update expense ───
expensesRouter.put("/:id", async (req: Request, res: Response) => {
    try {
        const data: any = {};
        const fields = ["description", "category", "amount", "currency", "date", "vendor", "recurring", "recurPeriod", "notes"];

        for (const field of fields) {
            if (req.body[field] !== undefined) data[field] = req.body[field];
        }

        const existing = await prisma.expense.findFirst({ where: { id: req.params.id as string, ...tenantFilter(req) } });
        if (!existing) { res.status(404).json({ error: "Expense not found" }); return; }

        const expense = await prisma.expense.update({
            where: { id: existing.id },
            data,
        });

        res.json({ success: true, expense });
    } catch (error: unknown) {
        console.error("Update expense error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── DELETE /api/expenses/:id — Delete expense ───
expensesRouter.delete("/:id", async (req: Request, res: Response) => {
    try {
        await prisma.expense.deleteMany({ where: { id: req.params.id as string, ...tenantFilter(req) } });
        res.json({ success: true });

        createNotification(req.userId!, req.organizationId || null, {
          type: "info",
          title: "Expense deleted",
          message: `Expense has been deleted.`,
          href: "/expenses",
          entity: "expense",
        }).catch(() => {});
    } catch (error: unknown) {
        console.error("Delete expense error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});
