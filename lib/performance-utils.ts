// ==================== Performance Utilities ====================

/**
 * Simple in-memory cache for API responses
 */
class APICache {
  private cache: Map<string, { data: any; timestamp: number; ttl: number }>;
  private defaultTTL: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.cache = new Map();
    // Clean expired entries every minute
    setInterval(() => this.cleanExpired(), 60 * 1000);
  }

  set(key: string, data: any, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  cleanExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// Global cache instance
export const apiCache = new APICache();

/**
 * Cached fetch wrapper
 */
export async function cachedFetch(
  url: string,
  options?: RequestInit,
  ttl?: number
): Promise<Response> {
  const cacheKey = `${options?.method || "GET"}:${url}`;

  // Check cache for GET requests
  if ((!options || options.method === "GET") && apiCache.has(cacheKey)) {
    const cachedData = apiCache.get(cacheKey);
    return new Response(JSON.stringify(cachedData), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fetch and cache
  const response = await fetch(url, options);

  if (response.ok && (!options || options.method === "GET")) {
    const clonedResponse = response.clone();
    const data = await clonedResponse.json();
    apiCache.set(cacheKey, data, ttl);
  }

  return response;
}

/**
 * Debounce function for limiting API calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function for limiting API calls
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Batch API requests
 */
export async function batchFetch<T>(
  urls: string[],
  batchSize: number = 5
): Promise<T[]> {
  const results: T[] = [];

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((url) => fetch(url).then((res) => res.json()))
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Lazy load images
 */
export function lazyLoadImage(
  imgElement: HTMLImageElement,
  src: string
): void {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        imgElement.src = src;
        observer.unobserve(imgElement);
      }
    });
  });

  observer.observe(imgElement);
}

/**
 * Performance monitoring
 */
export class PerformanceMonitor {
  private marks: Map<string, number>;

  constructor() {
    this.marks = new Map();
  }

  start(name: string): void {
    this.marks.set(name, performance.now());
  }

  end(name: string): number {
    const startTime = this.marks.get(name);
    if (!startTime) return 0;

    const endTime = performance.now();
    const duration = endTime - startTime;
    this.marks.delete(name);

    console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
    return duration;
  }

  measure<T>(name: string, fn: () => T): T {
    this.start(name);
    const result = fn();
    this.end(name);
    return result;
  }
}

export const perfMonitor = new PerformanceMonitor();

/**
 * Optimize list rendering with virtualization hints
 */
export function getVisibleRange(
  scrollTop: number,
  viewportHeight: number,
  itemHeight: number,
  totalItems: number
): { start: number; end: number } {
  const start = Math.floor(scrollTop / itemHeight);
  const visibleCount = Math.ceil(viewportHeight / itemHeight);
  const end = Math.min(start + visibleCount + 1, totalItems);

  return { start: Math.max(0, start - 5), end: end + 5 };
}
