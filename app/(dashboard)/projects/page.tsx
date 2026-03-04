"use client";

import * as React from "react";
import { AppHeader } from "@/components/app-header";
import { cn } from "@/lib/utils";
import {
    RiAddLine,
    RiLoader4Line,
    RiCloseLine,
    RiDeleteBinLine,
    RiCheckboxCircleLine,
    RiCheckboxBlankCircleLine,
    RiTimeLine,
    RiArrowRightLine,
    RiBuilding2Line,
    RiUser3Line,
    RiFlag2Line,
    RiCalendarLine,
} from "@remixicon/react";

interface Task {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    dueDate: string | null;
}

interface Project {
    id: string;
    name: string;
    description: string | null;
    status: string;
    priority: string;
    startDate: string | null;
    endDate: string | null;
    budget: number;
    notes: string | null;
    company: { id: string; name: string } | null;
    contact: { id: string; name: string } | null;
    _count: { tasks: number };
    tasks?: Task[];
    createdAt: string;
}

interface CrmCompany { id: string; name: string }
interface CrmContact { id: string; name: string; company: { id: string; name: string } | null }

const statusColors: Record<string, string> = {
    active: "text-emerald-600 bg-emerald-500/10",
    on_hold: "text-amber-600 bg-amber-500/10",
    completed: "text-blue-600 bg-blue-500/10",
    cancelled: "text-stone-500 bg-stone-500/10",
};

const priorityColors: Record<string, string> = {
    low: "text-stone-500",
    medium: "text-blue-500",
    high: "text-amber-500",
    urgent: "text-rose-500",
};

const taskStatusIcons: Record<string, React.ReactNode> = {
    todo: <RiCheckboxBlankCircleLine className="w-4 h-4 text-muted-foreground" />,
    in_progress: <RiTimeLine className="w-4 h-4 text-amber-500" />,
    done: <RiCheckboxCircleLine className="w-4 h-4 text-emerald-500" />,
};

import { API, apiFetch } from "@/lib/api";
import { toast } from "sonner";

function formatCurrency(val: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}

export default function ProjectsPage() {
    const [projects, setProjects] = React.useState<Project[]>([]);
    const [companies, setCompanies] = React.useState<CrmCompany[]>([]);
    const [contacts, setContacts] = React.useState<CrmContact[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [showModal, setShowModal] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [expandedProject, setExpandedProject] = React.useState<string | null>(null);
    const [projectTasks, setProjectTasks] = React.useState<Record<string, Task[]>>({});

    // Form
    const [name, setName] = React.useState("");
    const [description, setDescription] = React.useState("");
    const [priority, setPriority] = React.useState("medium");
    const [startDate, setStartDate] = React.useState(new Date().toISOString().slice(0, 10));
    const [endDate, setEndDate] = React.useState("");
    const [budget, setBudget] = React.useState("");
    const [companyId, setCompanyId] = React.useState("");
    const [contactId, setContactId] = React.useState("");

    // Task form
    const [newTaskTitle, setNewTaskTitle] = React.useState("");
    const [newTaskPriority, setNewTaskPriority] = React.useState("medium");

    const fetchData = async () => {
        try {
            const [pRes, coRes, cRes] = await Promise.all([
                apiFetch(`${API}/api/projects`).then((r) => r.json()),
                apiFetch(`${API}/api/companies`).then((r) => r.json()),
                apiFetch(`${API}/api/contacts`).then((r) => r.json()),
            ]);
            if (pRes.success) setProjects(pRes.projects);
            if (coRes.success) setCompanies(coRes.companies);
            if (cRes.success) setContacts(cRes.contacts);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    React.useEffect(() => { fetchData(); }, []);

    const toggleExpand = async (projectId: string) => {
        if (expandedProject === projectId) { setExpandedProject(null); return; }
        setExpandedProject(projectId);
        if (!projectTasks[projectId]) {
            try {
                const res = await apiFetch(`${API}/api/projects/${projectId}`);
                const data = await res.json();
                if (data.success) setProjectTasks((prev) => ({ ...prev, [projectId]: data.project.tasks }));
            } catch (err) { console.error(err); }
        }
    };

    const handleCreate = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            const res = await apiFetch(`${API}/api/projects`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(), description: description.trim() || null,
                    priority, startDate: startDate || null, endDate: endDate || null,
                    budget: parseFloat(budget) || 0,
                    companyId: companyId || null, contactId: contactId || null,
                }),
            });
            const data = await res.json();
            if (data.success) { setProjects((prev) => [data.project, ...prev]); setShowModal(false); resetForm(); toast.success("Project created."); }
        } catch (err) { console.error(err); toast.error("Failed to create project."); }
        finally { setSaving(false); }
    };

    const handleStatusChange = async (id: string, status: string) => {
        setProjects((prev) => prev.map((p) => p.id === id ? { ...p, status } : p));
        try { await apiFetch(`${API}/api/projects/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); toast.success("Status updated."); }
        catch { fetchData(); toast.error("Failed to update status."); }
    };

    const handleDelete = async (id: string) => {
        setProjects((prev) => prev.filter((p) => p.id !== id));
        try { await apiFetch(`${API}/api/projects/${id}`, { method: "DELETE" }); toast.success("Project deleted."); }
        catch { fetchData(); toast.error("Failed to delete project."); }
    };

    const handleAddTask = async (projectId: string) => {
        if (!newTaskTitle.trim()) return;
        try {
            const res = await apiFetch(`${API}/api/projects/${projectId}/tasks`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: newTaskTitle.trim(), priority: newTaskPriority }),
            });
            const data = await res.json();
            if (data.success) {
                setProjectTasks((prev) => ({ ...prev, [projectId]: [data.task, ...(prev[projectId] || [])] }));
                setProjects((prev) => prev.map((p) => p.id === projectId ? { ...p, _count: { tasks: p._count.tasks + 1 } } : p));
                setNewTaskTitle(""); setNewTaskPriority("medium");
                toast.success("Task added.");
            }
        } catch (err) { console.error(err); toast.error("Failed to add task."); }
    };

    const handleTaskStatusChange = async (projectId: string, taskId: string, status: string) => {
        setProjectTasks((prev) => ({
            ...prev,
            [projectId]: (prev[projectId] || []).map((t) => t.id === taskId ? { ...t, status } : t),
        }));
        try { await apiFetch(`${API}/api/projects/${projectId}/tasks/${taskId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); toast.success("Task updated."); }
        catch { toast.error("Failed to update task."); }
    };

    const handleDeleteTask = async (projectId: string, taskId: string) => {
        setProjectTasks((prev) => ({ ...prev, [projectId]: (prev[projectId] || []).filter((t) => t.id !== taskId) }));
        setProjects((prev) => prev.map((p) => p.id === projectId ? { ...p, _count: { tasks: Math.max(0, p._count.tasks - 1) } } : p));
        try { await apiFetch(`${API}/api/projects/${projectId}/tasks/${taskId}`, { method: "DELETE" }); toast.success("Task deleted."); }
        catch { toast.error("Failed to delete task."); }
    };

    const resetForm = () => {
        setName(""); setDescription(""); setPriority("medium");
        setStartDate(new Date().toISOString().slice(0, 10)); setEndDate("");
        setBudget(""); setCompanyId(""); setContactId("");
    };

    if (loading) {
        return (
            <>
                <AppHeader title="Projects" subtitle="Manage your projects" />
                <div className="flex items-center justify-center h-[60vh]">
                    <RiLoader4Line className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            </>
        );
    }

    return (
        <>
            <AppHeader title="Projects" subtitle={`${projects.length} projects`} />
            <div className="p-6 space-y-6">
                {/* Toolbar */}
                <div className="flex items-center justify-end">
                    <button onClick={() => { resetForm(); setShowModal(true); }}
                        className="flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                        <RiAddLine className="w-4 h-4" /> New Project
                    </button>
                </div>

                {/* Projects List */}
                <div className="space-y-3">
                    {projects.length === 0 && (
                        <div className="rounded-xl border border-border bg-card py-16 text-center text-muted-foreground/60 text-sm">No projects yet</div>
                    )}
                    {projects.map((project, i) => {
                        const isExpanded = expandedProject === project.id;
                        const tasks = projectTasks[project.id] || [];
                        const doneTasks = tasks.filter((t) => t.status === "done").length;
                        return (
                            <div key={project.id}
                                className="rounded-xl border border-border bg-card overflow-hidden animate-fade-in"
                                style={{ animationDelay: `${i * 0.04}s` }}>
                                {/* Project Header */}
                                <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                                    onClick={() => toggleExpand(project.id)}>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <RiArrowRightLine className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0", isExpanded && "rotate-90")} />
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-sm font-semibold text-foreground truncate">{project.name}</h3>
                                                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium capitalize", statusColors[project.status] || statusColors.active)}>
                                                    {project.status.replace("_", " ")}
                                                </span>
                                                <span className={cn("text-[10px] font-medium", priorityColors[project.priority])}>
                                                    <RiFlag2Line className="w-3 h-3 inline" /> {project.priority}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                                                {project.company && (
                                                    <span className="flex items-center gap-1"><RiBuilding2Line className="w-3 h-3" />{project.company.name}</span>
                                                )}
                                                {project.contact && (
                                                    <span className="flex items-center gap-1"><RiUser3Line className="w-3 h-3" />{project.contact.name}</span>
                                                )}
                                                {project.budget > 0 && <span>{formatCurrency(project.budget)}</span>}
                                                <span>{project._count.tasks} tasks</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                        {project.status === "active" && (
                                            <button onClick={() => handleStatusChange(project.id, "completed")} className="p-1.5 rounded-md text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors" title="Complete">
                                                <RiCheckboxCircleLine className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <button onClick={() => handleDelete(project.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors" title="Delete">
                                            <RiDeleteBinLine className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded: Tasks */}
                                {isExpanded && (
                                    <div className="border-t border-border bg-muted/10 p-4 space-y-2">
                                        {tasks.length > 0 && (
                                            <div className="text-[10px] text-muted-foreground mb-2">{doneTasks}/{tasks.length} completed</div>
                                        )}
                                        {tasks.map((task) => (
                                            <div key={task.id} className="flex items-center gap-2 group">
                                                <button onClick={() => handleTaskStatusChange(project.id, task.id, task.status === "done" ? "todo" : task.status === "todo" ? "in_progress" : "done")}>
                                                    {taskStatusIcons[task.status] || taskStatusIcons.todo}
                                                </button>
                                                <span className={cn("text-sm flex-1", task.status === "done" && "line-through text-muted-foreground")}>{task.title}</span>
                                                <span className={cn("text-[10px] font-medium", priorityColors[task.priority])}>{task.priority}</span>
                                                <button onClick={() => handleDeleteTask(project.id, task.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-rose-500 transition-all">
                                                    <RiCloseLine className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                        {/* Add Task Inline */}
                                        <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                                            <input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)}
                                                onKeyDown={(e) => e.key === "Enter" && handleAddTask(project.id)}
                                                placeholder="Add a task..." className="h-8 flex-1 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring/30" />
                                            <select value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value)}
                                                className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                                                <option value="low">Low</option>
                                                <option value="medium">Medium</option>
                                                <option value="high">High</option>
                                                <option value="urgent">Urgent</option>
                                            </select>
                                            <button onClick={() => handleAddTask(project.id)}
                                                className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                                                Add
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ─── New Project Modal ─── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
                    <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h3 className="text-sm font-semibold text-foreground">New Project</h3>
                            <button onClick={() => setShowModal(false)} className="p-1 rounded-md hover:bg-muted"><RiCloseLine className="w-4 h-4 text-muted-foreground" /></button>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground">Project Name *</label>
                                <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus
                                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="Website Redesign" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground">Description</label>
                                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="Project details..." />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Priority</label>
                                    <select value={priority} onChange={(e) => setPriority(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30">
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Budget ($)</label>
                                    <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" placeholder="0" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">Start Date</label>
                                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground">End Date</label>
                                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" />
                                </div>
                            </div>
                            {/* CRM Links */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground flex items-center gap-1">
                                        <RiBuilding2Line className="w-3 h-3 text-primary" /> Company
                                    </label>
                                    <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}
                                        className="h-9 w-full rounded-md border border-primary/30 bg-primary/[0.03] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                                        <option value="">None</option>
                                        {companies.map((co) => <option key={co.id} value={co.id}>{co.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground flex items-center gap-1">
                                        <RiUser3Line className="w-3 h-3 text-primary" /> Contact
                                    </label>
                                    <select value={contactId} onChange={(e) => setContactId(e.target.value)}
                                        className="h-9 w-full rounded-md border border-primary/30 bg-primary/[0.03] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                                        <option value="">None</option>
                                        {contacts.map((c) => (
                                            <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company.name})` : ""}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
                            <button onClick={() => setShowModal(false)} className="h-9 px-4 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancel</button>
                            <button onClick={handleCreate} disabled={!name.trim() || saving}
                                className="flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                                {saving && <RiLoader4Line className="w-4 h-4 animate-spin" />}
                                Create Project
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
