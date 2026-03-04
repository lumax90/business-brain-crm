import { PrismaClient } from "@prisma/client";

async function serperSearch(query: string, apiKey: string) {
    const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, num: 10 }),
    });
    const data = await response.json();
    console.log("Serper RAW results for", query);
    if (data.organic) {
        data.organic.forEach((o: any) => console.log(`- ${o.title}\n  ${o.link}`));
    }
}

async function main() {
    const prisma = new PrismaClient();
    const settingsList = await prisma.appSetting.findMany({ where: { key: "SERPER_API_KEY" } });
    const key = settingsList[0]?.value;
    
    if (key) {
        await serperSearch("\"arı savunma ve sanayi.\" official website", key);
        await serperSearch("arı savunma ve sanayi.", key); // Without quotes
        await serperSearch("arı savunma", key); // Simplified
    }
}

main().catch(console.error);
