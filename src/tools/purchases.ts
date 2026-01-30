/**
 * Purchase Order Tools for Tiny ERP MCP Server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ResponseFormat } from "../constants.js";
import { apiGet, apiPost, apiPut, apiDelete, handleApiError } from "../services/api-client.js";
import { formatListResponse, formatItemResponse, formatCurrency, formatDate, formatSuccess, toStructuredContent } from "../services/formatters.js";
import { ResponseFormatSchema, PaginationSchema, OrderBySchema, AddressSchema, OrderItemSchema } from "../schemas/common.js";
import type { PurchaseOrder } from "../types.js";

// ============================================================================
// Schemas
// ============================================================================

const ListPurchaseOrdersInputSchema = z.object({
  numero: z.string().max(50).optional().describe("Filtrar por número"),
  nomeFornecedor: z.string().max(200).optional().describe("Filtrar por fornecedor"),
  situacao: z.enum(["aberto", "aprovado", "recebido", "cancelado"]).optional().describe("Situação"),
  dataInicialEmissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data inicial de emissão"),
  dataFinalEmissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data final de emissão"),
  orderBy: OrderBySchema,
  ...PaginationSchema.shape,
  response_format: ResponseFormatSchema
}).strict();

const GetPurchaseOrderInputSchema = z.object({
  idOrdemCompra: z.number().int().positive().describe("ID da ordem de compra"),
  response_format: ResponseFormatSchema
}).strict();

const CreatePurchaseOrderInputSchema = z.object({
  fornecedor: z.object({
    id: z.number().int().positive().optional().describe("ID do fornecedor existente"),
    nome: z.string().min(1).max(200).describe("Nome do fornecedor"),
    cpfCnpj: z.string().max(18).optional().describe("CPF/CNPJ"),
    email: z.string().email().max(100).optional().describe("E-mail"),
    endereco: AddressSchema.optional().describe("Endereço")
  }).describe("Dados do fornecedor"),
  itens: z.array(OrderItemSchema).min(1).describe("Itens da ordem"),
  dataEmissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data de emissão"),
  dataPrevista: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data prevista de entrega"),
  observacao: z.string().max(2000).optional().describe("Observações")
}).strict();

const UpdatePurchaseOrderInputSchema = z.object({
  idOrdemCompra: z.number().int().positive().describe("ID da ordem de compra"),
  dataPrevista: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Nova data prevista"),
  observacao: z.string().max(2000).optional().describe("Novas observações")
}).strict();

const UpdatePurchaseOrderStatusInputSchema = z.object({
  idOrdemCompra: z.number().int().positive().describe("ID da ordem de compra"),
  situacao: z.enum(["aberto", "aprovado", "recebido", "cancelado"]).describe("Nova situação")
}).strict();

const PurchaseOrderMarkersInputSchema = z.object({
  idOrdemCompra: z.number().int().positive().describe("ID da ordem de compra"),
  response_format: ResponseFormatSchema
}).strict();

// ============================================================================
// Formatters
// ============================================================================

function purchaseOrderToMarkdown(po: PurchaseOrder): string {
  return [
    `## Ordem de Compra #${po.numero || po.id}`,
    "",
    `- **ID:** ${po.id}`,
    `- **Fornecedor:** ${po.fornecedor?.nome || "-"}`,
    `- **Data Emissão:** ${formatDate(po.dataEmissao)}`,
    `- **Data Prevista:** ${formatDate(po.dataPrevista)}`,
    `- **Situação:** ${po.situacao}`,
    `- **Valor Total:** ${formatCurrency(po.valorTotal)}`,
    ""
  ].join("\n");
}

// ============================================================================
// Tool Registration
// ============================================================================

export function registerPurchaseTools(server: McpServer): void {
  server.registerTool(
    "tiny_list_purchase_orders",
    {
      title: "Listar Ordens de Compra",
      description: `Lista ordens de compra.`,
      inputSchema: ListPurchaseOrdersInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof ListPurchaseOrdersInputSchema>) => {
      try {
        const queryParams: Record<string, unknown> = { limit: params.limit, offset: params.offset, orderBy: params.orderBy };
        if (params.numero) queryParams.numero = params.numero;
        if (params.nomeFornecedor) queryParams.nomeFornecedor = params.nomeFornecedor;
        if (params.situacao) queryParams.situacao = params.situacao;
        if (params.dataInicialEmissao) queryParams.dataInicialEmissao = params.dataInicialEmissao;
        if (params.dataFinalEmissao) queryParams.dataFinalEmissao = params.dataFinalEmissao;

        const response = await apiGet<{ itens: PurchaseOrder[]; paginacao: { total: number } }>("/ordens-compra", queryParams);
        const items = response.itens || [];
        const total = response.paginacao?.total || items.length;

        const { text, structured } = formatListResponse("Ordens de Compra", items, total, params.offset, params.response_format, purchaseOrderToMarkdown);
        return { content: [{ type: "text", text }], structuredContent: structured };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_get_purchase_order",
    {
      title: "Obter Ordem de Compra",
      description: `Obtém detalhes de uma ordem de compra.`,
      inputSchema: GetPurchaseOrderInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof GetPurchaseOrderInputSchema>) => {
      try {
        const po = await apiGet<PurchaseOrder>(`/ordens-compra/${params.idOrdemCompra}`);
        const { text, structured } = formatItemResponse(`Ordem de Compra #${po.numero || po.id}`, po, params.response_format, purchaseOrderToMarkdown);
        return { content: [{ type: "text", text }], structuredContent: structured };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_create_purchase_order",
    {
      title: "Criar Ordem de Compra",
      description: `Cria uma nova ordem de compra.`,
      inputSchema: CreatePurchaseOrderInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (params: z.infer<typeof CreatePurchaseOrderInputSchema>) => {
      try {
        const result = await apiPost<{ id: number }>("/ordens-compra", params);
        return { content: [{ type: "text", text: formatSuccess(`Ordem de compra criada com ID: ${result.id}`) }], structuredContent: toStructuredContent({ id: result.id, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_update_purchase_order",
    {
      title: "Atualizar Ordem de Compra",
      description: `Atualiza uma ordem de compra.`,
      inputSchema: UpdatePurchaseOrderInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof UpdatePurchaseOrderInputSchema>) => {
      try {
        const { idOrdemCompra, ...data } = params;
        await apiPut(`/ordens-compra/${idOrdemCompra}`, data);
        return { content: [{ type: "text", text: formatSuccess(`Ordem de compra ${idOrdemCompra} atualizada`) }], structuredContent: toStructuredContent({ id: idOrdemCompra, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_update_purchase_order_status",
    {
      title: "Atualizar Situação da Ordem de Compra",
      description: `Altera a situação de uma ordem de compra.`,
      inputSchema: UpdatePurchaseOrderStatusInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof UpdatePurchaseOrderStatusInputSchema>) => {
      try {
        await apiPut(`/ordens-compra/${params.idOrdemCompra}/situacao`, { situacao: params.situacao });
        return { content: [{ type: "text", text: formatSuccess(`Situação alterada para: ${params.situacao}`) }], structuredContent: toStructuredContent({ id: params.idOrdemCompra, situacao: params.situacao, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_post_purchase_order_accounts",
    {
      title: "Lançar Contas da Ordem de Compra",
      description: `Lança as contas a pagar da ordem de compra.`,
      inputSchema: z.object({ idOrdemCompra: z.number().int().positive() }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (params: { idOrdemCompra: number }) => {
      try {
        await apiPost(`/ordens-compra/${params.idOrdemCompra}/lancar-contas`);
        return { content: [{ type: "text", text: formatSuccess(`Contas lançadas`) }], structuredContent: toStructuredContent({ id: params.idOrdemCompra, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_post_purchase_order_stock",
    {
      title: "Lançar Estoque da Ordem de Compra",
      description: `Lança a entrada de estoque da ordem de compra.`,
      inputSchema: z.object({ idOrdemCompra: z.number().int().positive() }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (params: { idOrdemCompra: number }) => {
      try {
        await apiPost(`/ordens-compra/${params.idOrdemCompra}/lancar-estoque`);
        return { content: [{ type: "text", text: formatSuccess(`Estoque lançado`) }], structuredContent: toStructuredContent({ id: params.idOrdemCompra, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Purchase Order Markers
  server.registerTool(
    "tiny_get_purchase_order_markers",
    {
      title: "Obter Marcadores da Ordem de Compra",
      inputSchema: PurchaseOrderMarkersInputSchema,
      description: `Obtém os marcadores de uma ordem de compra.`,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof PurchaseOrderMarkersInputSchema>) => {
      try {
        const markers = await apiGet<Array<{ id: number; nome: string }>>(`/ordens-compra/${params.idOrdemCompra}/marcadores`);
        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify(markers, null, 2) }], structuredContent: toStructuredContent({ items: markers }) };
        }
        const lines = [`# Marcadores da Ordem de Compra ${params.idOrdemCompra}`, "", markers.length > 0 ? markers.map(m => `- ${m.nome} (ID: ${m.id})`).join("\n") : "Nenhum"];
        return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: toStructuredContent({ items: markers }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_update_purchase_order_markers",
    {
      title: "Atualizar Marcadores da Ordem de Compra",
      inputSchema: z.object({ idOrdemCompra: z.number().int().positive(), marcadores: z.array(z.object({ id: z.number().int().positive() })) }).strict(),
      description: `Atualiza os marcadores de uma ordem de compra.`,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { idOrdemCompra: number; marcadores: Array<{ id: number }> }) => {
      try {
        await apiPut(`/ordens-compra/${params.idOrdemCompra}/marcadores`, params.marcadores);
        return { content: [{ type: "text", text: formatSuccess(`Marcadores atualizados`) }], structuredContent: toStructuredContent({ id: params.idOrdemCompra, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_create_purchase_order_markers",
    {
      title: "Criar Marcadores da Ordem de Compra",
      inputSchema: z.object({ idOrdemCompra: z.number().int().positive(), marcadores: z.array(z.object({ nome: z.string().min(1).max(100) })).min(1) }).strict(),
      description: `Adiciona marcadores a uma ordem de compra.`,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (params: { idOrdemCompra: number; marcadores: Array<{ nome: string }> }) => {
      try {
        await apiPost(`/ordens-compra/${params.idOrdemCompra}/marcadores`, params.marcadores);
        return { content: [{ type: "text", text: formatSuccess(`Marcadores adicionados`) }], structuredContent: toStructuredContent({ id: params.idOrdemCompra, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_delete_purchase_order_markers",
    {
      title: "Excluir Marcadores da Ordem de Compra",
      inputSchema: z.object({ idOrdemCompra: z.number().int().positive() }).strict(),
      description: `Remove todos os marcadores de uma ordem de compra.`,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true }
    },
    async (params: { idOrdemCompra: number }) => {
      try {
        await apiDelete(`/ordens-compra/${params.idOrdemCompra}/marcadores`);
        return { content: [{ type: "text", text: formatSuccess(`Marcadores removidos`) }], structuredContent: toStructuredContent({ id: params.idOrdemCompra, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
