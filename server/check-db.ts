import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
    const allLeads = await prisma.lead.count();
    const byOrg = await prisma.lead.groupBy({
        by: ['organizationId'],
        _count: true,
    });
    const byUser = await prisma.lead.groupBy({
        by: ['userId'],
        _count: true,
    });

    console.log("Total leads globally:", allLeads);
    console.log("By orgId:", byOrg);
    console.log("By userId:", byUser);
}

check().catch(console.error).finally(() => prisma.$disconnect());
