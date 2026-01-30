/**
 * HTTP API Client for Tiny ERP API
 *
 * Handles OAuth 2.0 Bearer token authentication with automatic token refresh.
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from "axios";
import { API_BASE_URL } from "../constants.js";
import {
  getValidAccessToken,
  getOAuthConfigFromEnv,
  loadTokens,
  OAuthConfig,
} from "./oauth.js";

let apiClient: AxiosInstance | null = null;
let oauthConfig: OAuthConfig | null = null;

/**
 * Initialize the API client with OAuth configuration
 */
export function initializeApiClient(): void {
  try {
    oauthConfig = getOAuthConfigFromEnv();
  } catch {
    // If OAuth config is not available, we'll fail when making requests
    oauthConfig = null;
  }

  apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  // Add request interceptor to set Authorization header
  apiClient.interceptors.request.use(
    async (config) => {
      if (!oauthConfig) {
        throw new Error(
          "Configuração OAuth não encontrada. " +
            "Defina TINY_CLIENT_ID e TINY_CLIENT_SECRET."
        );
      }

      try {
        const accessToken = await getValidAccessToken(oauthConfig);
        config.headers.Authorization = `Bearer ${accessToken}`;
      } catch (error) {
        // Re-throw authentication errors
        throw error;
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  // Add response interceptor for error handling
  apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      // Handle 401 Unauthorized - token might be invalid
      if (error.response?.status === 401) {
        // Force token refresh on next request
        const originalRequest = error.config as AxiosRequestConfig & {
          _retry?: boolean;
        };

        if (!originalRequest._retry && oauthConfig) {
          originalRequest._retry = true;

          try {
            // Token might have been refreshed by another request
            const accessToken = await getValidAccessToken(oauthConfig);
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            }
            return apiClient!.request(originalRequest);
          } catch {
            // Refresh failed, user needs to re-authenticate
            throw new Error(
              "Sessão expirada. Execute 'tiny-mcp-auth' para fazer login novamente."
            );
          }
        }
      }

      return Promise.reject(error);
    }
  );
}

/**
 * Get the initialized API client
 */
export function getApiClient(): AxiosInstance {
  if (!apiClient) {
    initializeApiClient();
  }
  return apiClient!;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  const tokens = loadTokens();
  return tokens !== null;
}

/**
 * Make a GET request
 */
export async function apiGet<T>(
  endpoint: string,
  params?: Record<string, unknown>
): Promise<T> {
  const client = getApiClient();
  const response = await client.get<T>(endpoint, { params });
  return response.data;
}

/**
 * Make a POST request
 */
export async function apiPost<T>(
  endpoint: string,
  data?: unknown
): Promise<T> {
  const client = getApiClient();
  const response = await client.post<T>(endpoint, data);
  return response.data;
}

/**
 * Make a PUT request
 */
export async function apiPut<T>(
  endpoint: string,
  data?: unknown
): Promise<T> {
  const client = getApiClient();
  const response = await client.put<T>(endpoint, data);
  return response.data;
}

/**
 * Make a DELETE request
 */
export async function apiDelete<T>(endpoint: string): Promise<T> {
  const client = getApiClient();
  const response = await client.delete<T>(endpoint);
  return response.data;
}

/**
 * Handle API errors and return a user-friendly message
 */
export function handleApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{
      message?: string;
      error?: string;
      errors?: Array<{ message: string }>;
    }>;

    // Authentication errors
    if (axiosError.message?.includes("Sessão expirada") ||
        axiosError.message?.includes("Não autenticado")) {
      return `❌ ${axiosError.message}`;
    }

    if (axiosError.response) {
      const { status, data } = axiosError.response;

      // Extract error message from response
      let errorMsg = "Erro desconhecido";
      if (data?.message) {
        errorMsg = data.message;
      } else if (data?.error) {
        errorMsg = data.error;
      } else if (data?.errors && data.errors.length > 0) {
        errorMsg = data.errors.map((e) => e.message).join("; ");
      } else if (data) {
        // Log full response for debugging
        errorMsg = JSON.stringify(data);
      }

      switch (status) {
        case 400:
          return `❌ Requisição inválida: ${errorMsg}`;
        case 401:
          return `❌ Não autorizado. Execute 'tiny-mcp-auth' para autenticar.`;
        case 403:
          return `❌ Acesso negado: ${errorMsg}`;
        case 404:
          return `❌ Recurso não encontrado`;
        case 429:
          return `❌ Limite de requisições excedido. Aguarde antes de tentar novamente.`;
        case 500:
          return `❌ Erro interno do servidor Tiny`;
        case 503:
          return `❌ Serviço temporariamente indisponível`;
        default:
          return `❌ Erro ${status}: ${errorMsg}`;
      }
    }

    if (axiosError.code === "ECONNABORTED") {
      return "❌ Timeout: a requisição demorou muito para responder";
    }

    if (axiosError.code === "ENOTFOUND" || axiosError.code === "ECONNREFUSED") {
      return "❌ Não foi possível conectar ao servidor Tiny";
    }

    return `❌ Erro de conexão: ${axiosError.message}`;
  }

  if (error instanceof Error) {
    return `❌ ${error.message}`;
  }

  return "❌ Erro desconhecido";
}
