export function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function strings(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

// Only messages constructed by this plugin may pass through to notices.
export class PublicError extends Error {}

export function errorMessage(error: unknown): string {
	if (error instanceof PublicError) return error.message;
	if (error instanceof SyntaxError) return "Invalid JSON response";
	const status = isRecord(error) && typeof error.status === "number" ? error.status : undefined;
	if (status !== undefined && Number.isInteger(status) && status >= 100 && status <= 599) return `HTTP ${status}`;
	return "Request failed; check network access and provider availability.";
}

// requestUrl cannot cancel a request; the timeout bounds how long the command waits.
export async function withTimeout<T>(request: Promise<T>, provider: string, ms = 15000): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			request,
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => reject(new PublicError(`${provider} timed out`)), ms);
			}),
		]);
	} finally {
		if (timer !== undefined) clearTimeout(timer);
	}
}
