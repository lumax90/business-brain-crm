import dns from "dns";
import net from "net";

export type VerificationResult =
    | "valid"
    | "invalid"
    | "catch_all"
    | "unknown"
    | "error";

export interface EmailVerification {
    email: string;
    result: VerificationResult;
    mxHost?: string;
    message?: string;
}

function getMxRecords(domain: string): Promise<dns.MxRecord[]> {
    return new Promise((resolve, reject) => {
        dns.resolveMx(domain, (err, records) => {
            if (err) return reject(err);
            records.sort((a, b) => a.priority - b.priority);
            resolve(records);
        });
    });
}

function smtpCheck(
    email: string,
    mxHost: string,
    timeout = 8000
): Promise<{ exists: boolean; catchAll: boolean; message: string; isError?: boolean }> {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let step = 0;
        let resolved = false;

        const finish = (result: {
            exists: boolean;
            catchAll: boolean;
            message: string;
            isError?: boolean;
        }) => {
            if (resolved) return;
            resolved = true;
            try { socket.destroy(); } catch { }
            resolve(result);
        };

        socket.setTimeout(timeout);
        socket.on("timeout", () =>
            finish({ exists: false, catchAll: false, message: "Timeout", isError: true })
        );
        socket.on("error", (err) =>
            finish({ exists: false, catchAll: false, message: err.message, isError: true })
        );

        socket.on("data", (data) => {
            const response = data.toString();
            const code = parseInt(response.substring(0, 3), 10);

            switch (step) {
                case 0: // Greeting
                    if (code === 220) {
                        step++;
                        socket.write("EHLO mail.pixl.dev\r\n");
                    } else {
                        finish({ exists: false, catchAll: false, message: `Greeting: ${code}` });
                    }
                    break;
                case 1: // EHLO
                    if (code === 250) {
                        step++;
                        socket.write("MAIL FROM:<verify@pixl.dev>\r\n");
                    } else {
                        finish({ exists: false, catchAll: false, message: `EHLO: ${code}` });
                    }
                    break;
                case 2: // MAIL FROM
                    if (code === 250) {
                        step++;
                        // Catch-all check with fake address
                        const domain = email.split("@")[1];
                        socket.write(`RCPT TO:<nonexist_${Date.now()}@${domain}>\r\n`);
                    } else {
                        finish({ exists: false, catchAll: false, message: `MAIL FROM: ${code}` });
                    }
                    break;
                case 3: // Catch-all probe
                    if (code === 250) {
                        // Accepts anything = catch-all
                        finish({ exists: true, catchAll: true, message: "Catch-all domain" });
                    } else {
                        // Not catch-all, reset and test real email
                        step = 5;
                        socket.write("RSET\r\n");
                    }
                    break;
                case 5: // RSET
                    if (code === 250) {
                        step++;
                        socket.write("MAIL FROM:<verify@pixl.dev>\r\n");
                    } else {
                        finish({ exists: false, catchAll: false, message: `RSET: ${code}` });
                    }
                    break;
                case 6: // Second MAIL FROM
                    if (code === 250) {
                        step++;
                        socket.write(`RCPT TO:<${email}>\r\n`);
                    } else {
                        finish({ exists: false, catchAll: false, message: `MAIL FROM: ${code}` });
                    }
                    break;
                case 7: // Real RCPT TO
                    if (code === 250) {
                        finish({ exists: true, catchAll: false, message: "Mailbox exists" });
                    } else if ([550, 551, 553, 554].includes(code)) {
                        finish({ exists: false, catchAll: false, message: "Mailbox not found" });
                    } else {
                        finish({ exists: false, catchAll: false, message: `RCPT TO: ${code}` });
                    }
                    socket.write("QUIT\r\n");
                    break;
            }
        });

        socket.connect(25, mxHost);
    });
}

// ─── Remote SMTP Verifier (calls the Hostinger microservice) ───
async function verifyViaRemote(
    email: string,
    url: string,
    apiKey: string
): Promise<EmailVerification> {
    try {
        const res = await fetch(`${url}/verify`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-KEY": apiKey,
            },
            body: JSON.stringify({ email }),
            signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
            return { email, result: "error", message: `Remote verifier: ${res.status}` };
        }

        const data = await res.json() as { result: VerificationResult; mxHost?: string; message?: string };
        return {
            email,
            result: data.result,
            mxHost: data.mxHost,
            message: data.message,
        };
    } catch (err: any) {
        console.error(`Remote SMTP verifier error for ${email}:`, err.message);
        return { email, result: "error", message: `Remote: ${err.message}` };
    }
}

// ─── Remote batch verify ───
async function verifyBatchViaRemote(
    emails: string[],
    url: string,
    apiKey: string
): Promise<EmailVerification[]> {
    try {
        const res = await fetch(`${url}/verify-batch`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-KEY": apiKey,
            },
            body: JSON.stringify({ emails }),
            signal: AbortSignal.timeout(60000),
        });

        if (!res.ok) {
            return emails.map(e => ({ email: e, result: "error" as VerificationResult, message: `Remote: ${res.status}` }));
        }

        const data = await res.json() as { results: EmailVerification[] };
        return data.results;
    } catch (err: any) {
        console.error("Remote batch verify error:", err.message);
        return emails.map(e => ({ email: e, result: "error" as VerificationResult, message: `Remote: ${err.message}` }));
    }
}

export async function verifyEmail(
    email: string,
    provider: string = "local",
    apiKey?: string,
    remoteUrl?: string,
    remoteApiKey?: string
): Promise<EmailVerification> {
    const domain = email.split("@")[1];
    if (!domain) return { email, result: "error", message: "Invalid email" };

    // ─── Priority 1: Remote SMTP Verifier (Hostinger microservice) ───
    if (remoteUrl && remoteApiKey) {
        return verifyViaRemote(email, remoteUrl, remoteApiKey);
    }

    // ─── Priority 2: Hunter API ───
    if (provider === "hunter" && apiKey) {
        try {
            const res = await fetch(`https://api.hunter.io/v2/email-verifier?email=${email}&api_key=${apiKey}`);
            if (!res.ok) return { email, result: "error", message: `Hunter API error: ${res.status}` };

            const data = await res.json() as any;
            const status = data?.data?.status;

            if (status === "valid") return { email, result: "valid", message: "Hunter: Valid" };
            if (status === "accept_all") return { email, result: "catch_all", message: "Hunter: Accept All" };
            if (status === "invalid") return { email, result: "invalid", message: "Hunter: Invalid" };

            return { email, result: "unknown", message: `Hunter: ${status}` };
        } catch (err: any) {
            return { email, result: "error", message: err.message };
        }
    }

    // ─── Priority 3: ZeroBounce API ───
    if (provider === "zerobounce" && apiKey) {
        try {
            const res = await fetch(`https://api.zerobounce.net/v2/validate?api_key=${apiKey}&email=${email}`);
            if (!res.ok) return { email, result: "error", message: `ZeroBounce API error: ${res.status}` };

            const data = await res.json() as any;
            const status = data?.status;

            if (status === "valid") return { email, result: "valid", message: "ZeroBounce: Valid" };
            if (status === "catch-all") return { email, result: "catch_all", message: "ZeroBounce: Catch-all" };
            if (status === "invalid") return { email, result: "invalid", message: "ZeroBounce: Invalid" };

            return { email, result: "unknown", message: `ZeroBounce: ${status}` };
        } catch (err: any) {
            return { email, result: "error", message: err.message };
        }
    }

    // ─── Priority 4: Local SMTP check (requires port 25 to be open) ───
    try {
        const mxRecords = await getMxRecords(domain);
        if (!mxRecords.length) {
            return { email, result: "invalid", message: "No MX records" };
        }

        const mxHost = mxRecords[0].exchange;
        const result = await smtpCheck(email, mxHost);

        if (result.isError) return { email, result: "error", mxHost, message: result.message };
        if (result.catchAll) return { email, result: "catch_all", mxHost, message: result.message };
        if (result.exists) return { email, result: "valid", mxHost, message: result.message };
        return { email, result: "invalid", mxHost, message: result.message };
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return { email, result: "unknown", message: msg };
    }
}

export async function verifyEmailCandidates(
    emails: string[],
    provider: string = "local",
    apiKey?: string,
    remoteUrl?: string,
    remoteApiKey?: string
): Promise<EmailVerification[]> {
    // ─── Use remote batch endpoint if available (most efficient) ───
    if (remoteUrl && remoteApiKey) {
        return verifyBatchViaRemote(emails, remoteUrl, remoteApiKey);
    }

    // ─── Otherwise verify one by one ───
    const results: EmailVerification[] = [];

    for (const email of emails) {
        const result = await verifyEmail(email, provider, apiKey);
        results.push(result);
        if (result.result === "valid") break;
        await new Promise((r) => setTimeout(r, 500));
    }

    return results;
}
