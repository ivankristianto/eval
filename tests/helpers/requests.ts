/**
 * Creates a Request object with JSON content type.
 * @param url - The URL to request
 * @param body - The body of the request
 * @param method - The HTTP method to use
 * @returns A Request object configured with JSON content type and serialized body
 */
export const createJsonRequest = (url: string, body: unknown, method = 'POST') =>
  new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

/**
 * Reads and parses JSON from a Response object.
 * @param response - The response to read
 * @returns A promise that resolves to the JSON-parsed response body
 */
export const readJson = async (response: Response) => response.json();
