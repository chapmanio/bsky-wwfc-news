/**
 * HTTP client utilities for making API requests
 */

import { withRetry } from '../lib';

export interface HttpClientOptions {
  baseUrl?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

/**
 * Build URL with query parameters
 */
function buildUrl(baseUrl: string, path: string, params?: RequestOptions['params']): string {
  const url = new URL(path, baseUrl);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
}

/**
 * Create an HTTP client with default options
 */
export function createHttpClient(options: HttpClientOptions = {}) {
  const { baseUrl = '', headers: defaultHeaders = {} } = options;

  return {
    /**
     * Make a GET request with automatic retry on 5xx / network errors
     */
    async get<T>(path: string, requestOptions: RequestOptions = {}): Promise<T> {
      const { params, headers, ...fetchOptions } = requestOptions;
      const url = buildUrl(baseUrl, path, params);

      console.log(`[HTTP GET] ${url}`);

      return withRetry(
        async () => {
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              ...defaultHeaders,
              ...headers,
            },
            ...fetchOptions,
          });

          if (!response.ok) {
            const body = await response.text();
            throw new HttpError(response.status, response.statusText, body);
          }

          return response.json() as Promise<T>;
        },
        {
          maxAttempts: 3,
          isRetryable: isRetryableError,
        }
      );
    },

    /**
     * Make a POST request
     */
    async post<T>(path: string, body?: unknown, requestOptions: RequestOptions = {}): Promise<T> {
      const { params, headers, ...fetchOptions } = requestOptions;
      const url = buildUrl(baseUrl, path, params);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...defaultHeaders,
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        ...fetchOptions,
      });

      if (!response.ok) {
        throw new HttpError(response.status, response.statusText, await response.text());
      }

      return response.json() as Promise<T>;
    },

    /**
     * Fetch binary data (e.g., images)
     */
    async fetchBlob(url: string): Promise<Blob> {
      const response = await fetch(url, {
        headers: defaultHeaders,
      });

      if (!response.ok) {
        throw new HttpError(response.status, response.statusText, await response.text());
      }

      return response.blob();
    },
  };
}

/**
 * Determine if an error is worth retrying.
 * Retries 5xx server errors and network-level failures (e.g. DNS, connection refused).
 * Does not retry 4xx client errors — those won't self-heal.
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof HttpError) {
    return error.isRetryable();
  }

  // Network failures (TypeError from fetch, etc.) are retryable
  return true;
}

/**
 * HTTP error with status code and response body
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string
  ) {
    super(`HTTP ${status} ${statusText}: ${body}`);
    this.name = 'HttpError';
  }

  /**
   * Check if error is a client error (4xx)
   */
  isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  /**
   * Check if error is a server error (5xx)
   */
  isServerError(): boolean {
    return this.status >= 500;
  }

  /**
   * Check if error is retryable (5xx or network errors)
   */
  isRetryable(): boolean {
    return this.isServerError();
  }
}
