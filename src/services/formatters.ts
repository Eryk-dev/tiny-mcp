/**
 * Response formatters for Markdown and JSON output
 */

import { ResponseFormat, CHARACTER_LIMIT } from "../constants.js";
import type { ApiListResponse } from "../types.js";

/**
 * Format a date string to Brazilian format
 */
export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a datetime string to Brazilian format
 */
export function formatDateTime(dateStr: string | undefined): string {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format currency value to Brazilian Real
 */
export function formatCurrency(value: number | undefined): string {
  if (value === undefined || value === null) return "R$ 0,00";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

/**
 * Format a number with thousand separators
 */
export function formatNumber(value: number | undefined, decimals = 2): string {
  if (value === undefined || value === null) return "0";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Build a paginated list response
 */
export function buildListResponse<T>(
  items: T[],
  total: number,
  offset: number
): ApiListResponse<T> {
  return {
    total,
    count: items.length,
    offset,
    items,
    has_more: total > offset + items.length,
    next_offset: total > offset + items.length ? offset + items.length : undefined
  };
}

/**
 * Format pagination info for Markdown
 */
export function formatPaginationMd(total: number, count: number, offset: number): string {
  const hasMore = total > offset + count;
  const lines = [
    `**Total:** ${total} registros`,
    `**Exibindo:** ${count} (offset: ${offset})`
  ];
  if (hasMore) {
    lines.push(`**Próxima página:** offset=${offset + count}`);
  }
  return lines.join("\n");
}

/**
 * Truncate response if it exceeds character limit
 */
export function truncateResponse<T>(
  items: T[],
  total: number,
  offset: number,
  formatFn: (item: T) => string
): { text: string; truncated: boolean; items: T[] } {
  let text = "";
  let truncated = false;
  const includedItems: T[] = [];

  for (const item of items) {
    const itemText = formatFn(item);
    if (text.length + itemText.length > CHARACTER_LIMIT) {
      truncated = true;
      break;
    }
    text += itemText;
    includedItems.push(item);
  }

  if (truncated) {
    text += `\n\n---\n**Resposta truncada.** Exibindo ${includedItems.length} de ${items.length} itens retornados. Use o parâmetro 'offset' para ver mais resultados.`;
  }

  return { text, truncated, items: includedItems };
}

/**
 * Format list response based on format type
 */
export function formatListResponse<T>(
  title: string,
  items: T[],
  total: number,
  offset: number,
  format: ResponseFormat,
  itemToMarkdown: (item: T) => string
): { text: string; structured: Record<string, unknown> } {
  const response = buildListResponse(items, total, offset);
  const structuredResponse = JSON.parse(JSON.stringify(response)) as Record<string, unknown>;

  if (format === ResponseFormat.JSON) {
    return {
      text: JSON.stringify(response, null, 2),
      structured: structuredResponse
    };
  }

  // Markdown format
  const { text: itemsText, items: includedItems } = truncateResponse(
    items,
    total,
    offset,
    itemToMarkdown
  );

  const lines = [
    `# ${title}`,
    "",
    formatPaginationMd(total, includedItems.length, offset),
    "",
    "---",
    "",
    itemsText
  ];

  const mdResponse = buildListResponse(includedItems, total, offset);

  return {
    text: lines.join("\n"),
    structured: JSON.parse(JSON.stringify(mdResponse)) as Record<string, unknown>
  };
}

/**
 * Format single item response based on format type
 */
export function formatItemResponse<T>(
  title: string,
  item: T,
  format: ResponseFormat,
  itemToMarkdown: (item: T) => string
): { text: string; structured: Record<string, unknown> } {
  const structured = JSON.parse(JSON.stringify(item)) as Record<string, unknown>;

  if (format === ResponseFormat.JSON) {
    return {
      text: JSON.stringify(item, null, 2),
      structured
    };
  }

  const lines = [
    `# ${title}`,
    "",
    itemToMarkdown(item)
  ];

  return {
    text: lines.join("\n"),
    structured
  };
}

/**
 * Format success message
 */
export function formatSuccess(message: string): string {
  return `✓ ${message}`;
}

/**
 * Convert any value to a structured content object compatible with MCP SDK
 * The MCP SDK expects structuredContent to be { [x: string]: unknown }
 */
export function toStructuredContent<T>(value: T): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

/**
 * Format address to string
 */
export function formatAddress(addr: {
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
} | undefined): string {
  if (!addr) return "-";
  const parts = [
    addr.logradouro,
    addr.numero,
    addr.complemento,
    addr.bairro,
    addr.cidade,
    addr.uf,
    addr.cep
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "-";
}
