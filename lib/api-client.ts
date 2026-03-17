import { toast } from "sonner";

interface ApiOptions {
  showError?: boolean;
}

async function request<T>(
  url: string,
  options?: RequestInit,
  apiOptions?: ApiOptions
): Promise<T> {
  const { showError = true } = apiOptions || {};
  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = data.error || `请求失败 (${res.status})`;
      if (showError) toast.error(message);
      throw new Error(message);
    }
    return res.json();
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      if (showError) toast.error("网络连接失败，请检查网络");
    }
    throw error;
  }
}

export const api = {
  get: <T>(url: string, opts?: ApiOptions) => request<T>(url, undefined, opts),

  post: <T>(url: string, body: unknown, opts?: ApiOptions) =>
    request<T>(url, { method: "POST", body: JSON.stringify(body) }, opts),

  put: <T>(url: string, body: unknown, opts?: ApiOptions) =>
    request<T>(url, { method: "PUT", body: JSON.stringify(body) }, opts),

  delete: <T>(url: string, opts?: ApiOptions) =>
    request<T>(url, { method: "DELETE" }, opts),
};
