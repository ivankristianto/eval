export const createJsonRequest = (url: string, body: unknown, method = "POST") =>
  new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const readJson = async (response: Response) => response.json();
