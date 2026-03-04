import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { prisma } from "../lib/prisma";
import { tenantFilter, tenantData } from "../lib/auth-middleware";

const router = Router();

// ── Storage config ──
const UPLOAD_DIR = path.resolve(__dirname, "../../storage/uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = path.extname(file.originalname);
        cb(null, `${uniqueSuffix}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// ── Helper: resolve entity name for display ──
async function resolveEntityName(entityType: string, entityId: string): Promise<string | null> {
    try {
        switch (entityType) {
            case "lead": {
                const lead = await prisma.lead.findUnique({ where: { id: entityId }, select: { name: true, email: true } });
                return lead?.name || lead?.email || null;
            }
            case "contact": {
                const contact = await prisma.contact.findUnique({ where: { id: entityId }, select: { name: true } });
                return contact?.name || null;
            }
            case "company": {
                const company = await prisma.company.findUnique({ where: { id: entityId }, select: { name: true } });
                return company?.name || null;
            }
            case "project": {
                const project = await prisma.project.findUnique({ where: { id: entityId }, select: { name: true } });
                return project?.name || null;
            }
            case "proposal": {
                const proposal = await prisma.proposal.findUnique({ where: { id: entityId }, select: { title: true, proposalNumber: true } });
                return proposal?.title || proposal?.proposalNumber || null;
            }
            case "invoice": {
                const invoice = await prisma.invoice.findUnique({ where: { id: entityId }, select: { invoiceNumber: true, clientName: true } });
                return invoice?.invoiceNumber || invoice?.clientName || null;
            }
            case "deal": {
                const deal = await prisma.deal.findUnique({ where: { id: entityId }, select: { title: true } });
                return deal?.title || null;
            }
            case "expense": {
                const expense = await prisma.expense.findUnique({ where: { id: entityId }, select: { description: true } });
                return expense?.description || null;
            }
            case "campaign": {
                const campaign = await prisma.campaign.findUnique({ where: { id: entityId }, select: { name: true } });
                return campaign?.name || null;
            }
            default:
                return null;
        }
    } catch {
        return null;
    }
}

// ── GET /api/files — list files with filtering ──
router.get("/", async (req: Request, res: Response) => {
    try {
        const search = req.query.search as string | undefined;
        const entityType = req.query.entityType as string | undefined;
        const folder = req.query.folder as string | undefined;
        const sort = req.query.sort as string | undefined;
        const order = req.query.order as string | undefined;

        const where: any = { ...tenantFilter(req) };
        if (entityType && entityType !== "all") where.entityType = entityType;
        if (folder && folder !== "all") where.folder = folder;
        if (search) {
            where.OR = [
                { name: { contains: String(search) } },
                { description: { contains: String(search) } },
                { entityName: { contains: String(search) } },
                { tags: { contains: String(search) } },
            ];
        }

        const orderBy: any = {};
        const sortField = String(sort || "createdAt");
        const sortOrder = String(order || "desc");
        orderBy[sortField] = sortOrder;

        const files = await prisma.file.findMany({ where, orderBy });

        // Summary stats
        const allFiles = await prisma.file.findMany({ where: { ...tenantFilter(req) }, select: { size: true, folder: true, entityType: true } });
        const totalSize = allFiles.reduce((s, f) => s + f.size, 0);
        const folderCounts: Record<string, number> = {};
        const entityCounts: Record<string, number> = {};
        allFiles.forEach((f) => {
            folderCounts[f.folder] = (folderCounts[f.folder] || 0) + 1;
            if (f.entityType) entityCounts[f.entityType] = (entityCounts[f.entityType] || 0) + 1;
        });

        res.json({
            files,
            summary: {
                totalFiles: allFiles.length,
                totalSize,
                folderCounts,
                entityCounts,
            },
        });
    } catch (err) {
        console.error("Error listing files:", err);
        res.status(500).json({ error: "Failed to list files" });
    }
});

// ── GET /api/files/download/:id — serve file for download ──
router.get("/download/:id", async (req: Request, res: Response) => {
    try {
        const file = await prisma.file.findFirst({ where: { id: String(req.params.id), ...tenantFilter(req) } });
        if (!file) return res.status(404).json({ error: "File not found" });

        const filePath = path.join(UPLOAD_DIR, file.path);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "File not found on disk" });
        }

        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.originalName)}"`);
        res.setHeader("Content-Type", file.mimeType);
        fs.createReadStream(filePath).pipe(res);
    } catch (err) {
        res.status(500).json({ error: "Failed to download file" });
    }
});

// ── GET /api/files/preview/:id — serve file for preview (inline) ──
router.get("/preview/:id", async (req: Request, res: Response) => {
    try {
        const file = await prisma.file.findFirst({ where: { id: String(req.params.id), ...tenantFilter(req) } });
        if (!file) return res.status(404).json({ error: "File not found" });

        const filePath = path.join(UPLOAD_DIR, file.path);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "File not found on disk" });
        }

        res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.originalName)}"`);
        res.setHeader("Content-Type", file.mimeType);
        fs.createReadStream(filePath).pipe(res);
    } catch (err) {
        res.status(500).json({ error: "Failed to preview file" });
    }
});

// ── GET /api/files/entity/:entityType/:entityId — files for a specific entity ──
router.get("/entity/:entityType/:entityId", async (req: Request, res: Response) => {
    try {
        const files = await prisma.file.findMany({
            where: {
                entityType: String(req.params.entityType),
                entityId: String(req.params.entityId),
                ...tenantFilter(req),
            },
            orderBy: { createdAt: "desc" },
        });
        res.json({ files });
    } catch (err) {
        res.status(500).json({ error: "Failed to get entity files" });
    }
});

// ── GET /api/files/:id — single file metadata ──
router.get("/:id", async (req: Request, res: Response) => {
    try {
        const file = await prisma.file.findFirst({ where: { id: String(req.params.id), ...tenantFilter(req) } });
        if (!file) return res.status(404).json({ error: "File not found" });
        res.json({ file });
    } catch (err) {
        res.status(500).json({ error: "Failed to get file" });
    }
});

// ── POST /api/files — upload file(s) ──
router.post("/", upload.array("files", 20), async (req: Request, res: Response) => {
    try {
        const uploadedFiles = req.files as Express.Multer.File[];
        if (!uploadedFiles || uploadedFiles.length === 0) {
            return res.status(400).json({ error: "No files uploaded" });
        }

        const { entityType, entityId, folder, description, tags } = req.body;

        let entityName: string | null = null;
        if (entityType && entityId) {
            entityName = await resolveEntityName(entityType, entityId);
        }

        const created = [];
        for (const f of uploadedFiles) {
            const file = await prisma.file.create({
                data: {
                    name: path.parse(f.originalname).name,
                    originalName: f.originalname,
                    mimeType: f.mimetype,
                    size: f.size,
                    path: f.filename, // relative to UPLOAD_DIR
                    description: description || null,
                    tags: tags || "[]",
                    entityType: entityType || null,
                    entityId: entityId || null,
                    entityName: entityName,
                    folder: folder || "general",
                    ...tenantData(req),
                },
            });
            created.push(file);
        }

        res.json({ files: created });
    } catch (err) {
        console.error("Error uploading files:", err);
        res.status(500).json({ error: "Failed to upload files" });
    }
});

// ── PUT /api/files/:id — update file metadata ──
router.put("/:id", async (req: Request, res: Response) => {
    try {
        const { name, description, tags, folder, entityType, entityId } = req.body;
        const data: any = {};
        if (name !== undefined) data.name = name;
        if (description !== undefined) data.description = description;
        if (tags !== undefined) data.tags = typeof tags === "string" ? tags : JSON.stringify(tags);
        if (folder !== undefined) data.folder = folder;
        if (entityType !== undefined) data.entityType = entityType || null;
        if (entityId !== undefined) data.entityId = entityId || null;

        // Re-resolve entity name when link changes
        if (entityType && entityId) {
            data.entityName = await resolveEntityName(entityType, entityId);
        } else if (entityType === "" || entityType === null) {
            data.entityName = null;
            data.entityId = null;
            data.entityType = null;
        }

        const existingFile = await prisma.file.findFirst({ where: { id: String(req.params.id), ...tenantFilter(req) } });
        if (!existingFile) return res.status(404).json({ error: "File not found" });

        const file = await prisma.file.update({ where: { id: existingFile.id }, data });
        res.json({ file });
    } catch (err) {
        console.error("Error updating file:", err);
        res.status(500).json({ error: "Failed to update file" });
    }
});

// ── DELETE /api/files/:id — delete file ──
router.delete("/:id", async (req: Request, res: Response) => {
    try {
        const file = await prisma.file.findFirst({ where: { id: String(req.params.id), ...tenantFilter(req) } });
        if (!file) return res.status(404).json({ error: "File not found" });

        // Delete from disk
        const filePath = path.join(UPLOAD_DIR, file.path);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await prisma.file.delete({ where: { id: file.id } });
        res.json({ success: true });
    } catch (err) {
        console.error("Error deleting file:", err);
        res.status(500).json({ error: "Failed to delete file" });
    }
});

// ── POST /api/files/bulk-delete — delete multiple files ──
router.post("/bulk-delete", async (req: Request, res: Response) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: "ids array required" });

        const files = await prisma.file.findMany({ where: { id: { in: ids }, ...tenantFilter(req) } });

        // Delete from disk
        for (const file of files) {
            const filePath = path.join(UPLOAD_DIR, file.path);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await prisma.file.deleteMany({ where: { id: { in: files.map(f => f.id) } } });
        res.json({ success: true, deleted: files.length });
    } catch (err) {
        console.error("Error bulk deleting files:", err);
        res.status(500).json({ error: "Failed to delete files" });
    }
});

// ── POST /api/files/:id/link — link file to an entity ──
router.post("/:id/link", async (req: Request, res: Response) => {
    try {
        const { entityType, entityId } = req.body;
        if (!entityType || !entityId) {
            return res.status(400).json({ error: "entityType and entityId required" });
        }

        const entityName = await resolveEntityName(entityType, entityId);

        const existingFile = await prisma.file.findFirst({ where: { id: String(req.params.id), ...tenantFilter(req) } });
        if (!existingFile) return res.status(404).json({ error: "File not found" });

        const file = await prisma.file.update({
            where: { id: existingFile.id },
            data: { entityType, entityId, entityName },
        });
        res.json({ file });
    } catch (err) {
        res.status(500).json({ error: "Failed to link file" });
    }
});

// ── POST /api/files/:id/unlink — unlink file from entity ──
router.post("/:id/unlink", async (req: Request, res: Response) => {
    try {
        const existingFile = await prisma.file.findFirst({ where: { id: String(req.params.id), ...tenantFilter(req) } });
        if (!existingFile) return res.status(404).json({ error: "File not found" });

        const file = await prisma.file.update({
            where: { id: existingFile.id },
            data: { entityType: null, entityId: null, entityName: null },
        });
        res.json({ file });
    } catch (err) {
        res.status(500).json({ error: "Failed to unlink file" });
    }
});

export const filesRouter = router;
