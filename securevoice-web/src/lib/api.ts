/**
 * api.ts — thin fetch wrapper
 * Attaches JWT from localStorage and throws on non-2xx responses.
*/

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export class APIError extends Error {
    constructor(_status: number, message: string) {
        super(message);
        this.name = "ApiError"
    }
}

export async function apiFetch <T = unknown> (
    path: string,
    options: RequestInit = {},
): Promise <T> {
    const token = localStorage.getItem("sv_token");

    const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}`} : {} ),
            ...(options.headers ?? {})
        },
    });

    const body = await response.json().catch(() => ({ error: response.statusText }));
    if(!response.ok) {
        throw new APIError(response.status, body.error ?? "Request Failed");
    }
    return body as T
}