/**
 * Get the backend API URL from environment variables
 * Throws an error if NEXT_PUBLIC_API_URL is not set
 */
export function getApiUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not configured. Please set it in your .env.local file."
    );
  }

  return apiUrl;
}

/**
 * Get the backend API URL with fallback to localhost (development only)
 * Use this only for development, prefer getApiUrl() in production
 */
export function getApiUrlWithFallback(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
}
