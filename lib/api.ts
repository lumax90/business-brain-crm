export const API = process.env.NEXT_PUBLIC_SCRAPER_URL || "http://localhost:3001";

/**
 * Wrapper around fetch that always sends credentials (cookies) for cross-origin
 * requests to the backend API. This is required for Better Auth session cookies.
 */
export function apiFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    const url = typeof input === "string" && !input.startsWith("http") ? `${API}${input}` : input;
    return fetch(url, {
        ...init,
        credentials: "include",
    });
}
