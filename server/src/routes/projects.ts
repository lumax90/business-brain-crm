import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { tenantFilter, tenantData } from "../lib/auth-middleware";
import { createNotification } from "./notifications";

export const projectsRouter = Router();

// ─── GET /api/projects — All projects with company, contact, task count ───
projectsRouter.get("/", async (req: Request, res: Response) => {
    try {
        const projects = await prisma.project.findMany({
            where: { ...tenantFilter(req) },
            orderBy: { createdAt: "desc" },
            include: {
                company: { select: { id: true, name: true } },
                contact: { select: { id: true, name: true } },
                _count: { select: { tasks: true } },
            },
        });
        res.json({ success: true, projects });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── GET /api/projects/:id — Single project with tasks ───
projectsRouter.get("/:id", async (req: Request, res: Response) => {
    try {
        const project = await prisma.project.findFirst({
            where: { id: req.params.id as string, ...tenantFilter(req) },
            include: {
                company: { select: { id: true, name: true } },
                contact: { select: { id: true, name: true } },
                tasks: { orderBy: { createdAt: "desc" } },
            },
        });
        if (!project) { res.status(404).json({ error: "Project not found" }); return; }
        res.json({ success: true, project });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── POST /api/projects — Create project ───
projectsRouter.post("/", async (req: Request, res: Response) => {
    try {
        const { name, description, status, priority, startDate, endDate, budget, notes, companyId, contactId } = req.body;
        if (!name) { res.status(400).json({ error: "name is required" }); return; }

        const project = await prisma.project.create({
            data: {
                name, description: description || null,
                status: status || "active", priority: priority || "medium",
                startDate: startDate || null, endDate: endDate || null,
                budget: parseFloat(budget) || 0, notes: notes || null,
                companyId: companyId || null, contactId: contactId || null,
                ...tenantData(req),
            },
            include: {
                company: { select: { id: true, name: true } },
                contact: { select: { id: true, name: true } },
                _count: { select: { tasks: true } },
            },
        });
        res.json({ success: true, project });

        createNotification(req.userId!, req.organizationId || null, {
          type: "success",
          title: "Project created",
          message: `Project "${project.name}" created.`,
          href: "/projects",
          entity: "project",
          entityId: project.id,
        }).catch(() => {});
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── PUT /api/projects/:id — Update project ───
projectsRouter.put("/:id", async (req: Request, res: Response) => {
    try {
        const data: any = {};
        const fields = ["name", "description", "status", "priority", "startDate", "endDate", "notes", "companyId", "contactId"];
        for (const f of fields) { if (req.body[f] !== undefined) data[f] = req.body[f]; }
        if (req.body.budget !== undefined) data.budget = parseFloat(req.body.budget) || 0;

        const existing = await prisma.project.findFirst({ where: { id: req.params.id as string, ...tenantFilter(req) } });
        if (!existing) { res.status(404).json({ error: "Project not found" }); return; }

        const project = await prisma.project.update({
            where: { id: existing.id },
            data,
            include: {
                company: { select: { id: true, name: true } },
                contact: { select: { id: true, name: true } },
                _count: { select: { tasks: true } },
            },
        });
        res.json({ success: true, project });

        if (data.status) {
          createNotification(req.userId!, req.organizationId || null, {
            type: "info",
            title: "Project status updated",
            message: `Project "${project.name}" status changed to ${project.status}.`,
            href: "/projects",
            entity: "project",
            entityId: project.id,
          }).catch(() => {});
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── DELETE /api/projects/:id ───
projectsRouter.delete("/:id", async (req: Request, res: Response) => {
    try {
        await prisma.project.deleteMany({ where: { id: req.params.id as string, ...tenantFilter(req) } });
        res.json({ success: true });

        createNotification(req.userId!, req.organizationId || null, {
          type: "info",
          title: "Project deleted",
          message: `Project has been deleted.`,
          href: "/projects",
          entity: "project",
        }).catch(() => {});
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── POST /api/projects/:id/tasks — Add task to project ───
projectsRouter.post("/:id/tasks", async (req: Request, res: Response) => {
    try {
        const { title, description, priority, dueDate } = req.body;
        if (!title) { res.status(400).json({ error: "title is required" }); return; }

        // Verify project belongs to tenant
        const project = await prisma.project.findFirst({ where: { id: req.params.id as string, ...tenantFilter(req) } });
        if (!project) { res.status(404).json({ error: "Project not found" }); return; }

        const task = await prisma.task.create({
            data: {
                title, description: description || null,
                priority: priority || "medium",
                dueDate: dueDate || null,
                projectId: project.id,
                ...tenantData(req),
            },
        });
        res.json({ success: true, task });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── PUT /api/projects/:projectId/tasks/:taskId — Update task ───
projectsRouter.put("/:projectId/tasks/:taskId", async (req: Request, res: Response) => {
    try {
        const data: any = {};
        const fields = ["title", "description", "status", "priority", "dueDate"];
        for (const f of fields) { if (req.body[f] !== undefined) data[f] = req.body[f]; }

        const existingTask = await prisma.task.findFirst({ where: { id: req.params.taskId as string, ...tenantFilter(req) } });
        if (!existingTask) { res.status(404).json({ error: "Task not found" }); return; }

        const task = await prisma.task.update({
            where: { id: existingTask.id },
            data,
        });
        res.json({ success: true, task });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── DELETE /api/projects/:projectId/tasks/:taskId ───
projectsRouter.delete("/:projectId/tasks/:taskId", async (req: Request, res: Response) => {
    try {
        await prisma.task.deleteMany({ where: { id: req.params.taskId as string, ...tenantFilter(req) } });
        res.json({ success: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});
