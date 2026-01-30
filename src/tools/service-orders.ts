/**
 * Service Order Tools for Tiny ERP MCP Server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ResponseFormat } from "../constants.js";
import { apiGet, apiPost, apiPut, apiDelete, handleApiError } from "../services/api-client.js";
import { formatListResponse, formatItemResponse, formatCurrency, formatDate, formatSuccess, toStructuredContent } from "../services/formatters.js";
import { ResponseFormatSchema, PaginationSchema, OrderBySchema, AddressSchema } from "../schemas/common.js";
import type { ServiceOrder } from "../types.js";

// ============================================================================
// Schemas
// ============================================================================

const ServiceOrderItemSchema = z.object({
  idServico: z.number().int().positive().optional().describe("ID do serviço"),
  descricao: z.string().min(1).max(500).describe("Descrição"),
  quantidade: z.number().positive().describe("Quantidade"),
  valorUnitario: z.number().min(0).describe("Valor unitário")
}).strict();

const ListServiceOrdersInputSchema = z.object({
  numero: z.string().max(50).optional().describe("Filtrar por número"),
  nomeCliente: z.string().max(200).optional().describe("Filtrar por cliente"),
  situacao: z.enum(["aberto", "em_andamento", "concluido", "cancelado"]).optional().describe("Situação"),
  dataInicialEmissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data inicial"),
  dataFinalEmissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data final"),
  orderBy: OrderBySchema,
  ...PaginationSchema.shape,
  response_format: ResponseFormatSchema
}).strict();

const GetServiceOrderInputSchema = z.object({
  idOrdemServico: z.number().int().positive().describe("ID da ordem de serviço"),
  response_format: ResponseFormatSchema
}).strict();

const CreateServiceOrderInputSchema = z.object({
  cliente: z.object({
    id: z.number().int().positive().optional(),
    nome: z.string().min(1).max(200),
    cpfCnpj: z.string().max(18).optional(),
    email: z.string().email().max(100).optional(),
    endereco: AddressSchema.optional()
  }).describe("Dados do cliente"),
  itens: z.array(ServiceOrderItemSchema).min(1).describe("Itens da ordem"),
  dataEmissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  observacao: z.string().max(2000).optional()
}).strict();

const UpdateServiceOrderInputSchema = z.object({
  idOrdemServico: z.number().int().positive().describe("ID da ordem de serviço"),
  observacao: z.string().max(2000).optional()
}).strict();

const UpdateServiceOrderStatusInputSchema = z.object({
  idOrdemServico: z.number().int().positive().describe("ID da ordem de serviço"),
  situacao: z.enum(["aberto", "em_andamento", "concluido", "cancelado"]).describe("Nova situação")
}).strict();

// ============================================================================
// Formatters
// ============================================================================

function serviceOrderToMarkdown(so: ServiceOrder): string {
  return [
    `## Ordem de Serviço #${so.numero || so.id}`,
    "",
    `- **ID:** ${so.id}`,
    `- **Cliente:** ${so.cliente?.nome || "-"}`,
    `- **Data Emissão:** ${formatDate(so.dataEmissao)}`,
    `- **Situação:** ${so.situacao}`,
    `- **Valor Total:** ${formatCurrency(so.valorTotal)}`,
    ""
  ].join("\n");
}

// ============================================================================
// Tool Registration
// ============================================================================

export function registerServiceOrderTools(server: McpServer): void {
  server.registerTool(
    "tiny_list_service_orders",
    {
      title: "Listar Ordens de Serviço",
      description: `Lista ordens de serviço.`,
      inputSchema: ListServiceOrdersInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof ListServiceOrdersInputSchema>) => {
      try {
        const queryParams: Record<string, unknown> = { limit: params.limit, offset: params.offset, orderBy: params.orderBy };
        if (params.numero) queryParams.numero = params.numero;
        if (params.nomeCliente) queryParams.nomeCliente = params.nomeCliente;
        if (params.situacao) queryParams.situacao = params.situacao;
        if (params.dataInicialEmissao) queryParams.dataInicialEmissao = params.dataInicialEmissao;
        if (params.dataFinalEmissao) queryParams.dataFinalEmissao = params.dataFinalEmissao;

        const response = await apiGet<{ itens: ServiceOrder[]; paginacao: { total: number } }>("/ordens-servico", queryParams);
        const items = response.itens || [];
        const total = response.paginacao?.total || items.length;

        const { text, structured } = formatListResponse("Ordens de Serviço", items, total, params.offset, params.response_format, serviceOrderToMarkdown);
        return { content: [{ type: "text", text }], structuredContent: structured };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_get_service_order",
    {
      title: "Obter Ordem de Serviço",
      description: `Obtém detalhes de uma ordem de serviço.`,
      inputSchema: GetServiceOrderInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof GetServiceOrderInputSchema>) => {
      try {
        const so = await apiGet<ServiceOrder>(`/ordens-servico/${params.idOrdemServico}`);
        const { text, structured } = formatItemResponse(`Ordem de Serviço #${so.numero || so.id}`, so, params.response_format, serviceOrderToMarkdown);
        return { content: [{ type: "text", text }], structuredContent: structured };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_create_service_order",
    {
      title: "Criar Ordem de Serviço",
      description: `Cria uma nova ordem de serviço.`,
      inputSchema: CreateServiceOrderInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (params: z.infer<typeof CreateServiceOrderInputSchema>) => {
      try {
        const result = await apiPost<{ id: number }>("/ordens-servico", params);
        return { content: [{ type: "text", text: formatSuccess(`Ordem de serviço criada com ID: ${result.id}`) }], structuredContent: toStructuredContent({ id: result.id, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_update_service_order",
    {
      title: "Atualizar Ordem de Serviço",
      description: `Atualiza uma ordem de serviço.`,
      inputSchema: UpdateServiceOrderInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof UpdateServiceOrderInputSchema>) => {
      try {
        const { idOrdemServico, ...data } = params;
        await apiPut(`/ordens-servico/${idOrdemServico}`, data);
        return { content: [{ type: "text", text: formatSuccess(`Ordem de serviço ${idOrdemServico} atualizada`) }], structuredContent: toStructuredContent({ id: idOrdemServico, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_update_service_order_status",
    {
      title: "Atualizar Situação da Ordem de Serviço",
      description: `Altera a situação de uma ordem de serviço.`,
      inputSchema: UpdateServiceOrderStatusInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof UpdateServiceOrderStatusInputSchema>) => {
      try {
        await apiPut(`/ordens-servico/${params.idOrdemServico}/situacao`, { situacao: params.situacao });
        return { content: [{ type: "text", text: formatSuccess(`Situação alterada para: ${params.situacao}`) }], structuredContent: toStructuredContent({ id: params.idOrdemServico, situacao: params.situacao, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_generate_service_order_invoice",
    {
      title: "Gerar NF da Ordem de Serviço",
      description: `Gera uma nota fiscal a partir de uma ordem de serviço.`,
      inputSchema: z.object({ idOrdemServico: z.number().int().positive() }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (params: { idOrdemServico: number }) => {
      try {
        const result = await apiPost<{ idNotaFiscal: number }>(`/ordens-servico/${params.idOrdemServico}/gerar-nota-fiscal`);
        return { content: [{ type: "text", text: formatSuccess(`NF gerada com ID: ${result.idNotaFiscal}`) }], structuredContent: toStructuredContent({ idOrdemServico: params.idOrdemServico, idNotaFiscal: result.idNotaFiscal, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_post_service_order_accounts",
    {
      title: "Lançar Contas da Ordem de Serviço",
      inputSchema: z.object({ idOrdemServico: z.number().int().positive() }).strict(),
      description: `Lança as contas a receber da ordem de serviço.`,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (params: { idOrdemServico: number }) => {
      try {
        await apiPost(`/ordens-servico/${params.idOrdemServico}/lancar-contas`);
        return { content: [{ type: "text", text: formatSuccess(`Contas lançadas`) }], structuredContent: toStructuredContent({ id: params.idOrdemServico, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_post_service_order_stock",
    {
      title: "Lançar Estoque da Ordem de Serviço",
      inputSchema: z.object({ idOrdemServico: z.number().int().positive() }).strict(),
      description: `Lança movimentos de estoque da ordem de serviço.`,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (params: { idOrdemServico: number }) => {
      try {
        await apiPost(`/ordens-servico/${params.idOrdemServico}/lancar-estoque`);
        return { content: [{ type: "text", text: formatSuccess(`Estoque lançado`) }], structuredContent: toStructuredContent({ id: params.idOrdemServico, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Service Order Markers
  server.registerTool(
    "tiny_get_service_order_markers",
    {
      title: "Obter Marcadores da OS",
      inputSchema: z.object({ idOrdemServico: z.number().int().positive(), response_format: ResponseFormatSchema }).strict(),
      description: `Obtém os marcadores de uma ordem de serviço.`,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { idOrdemServico: number; response_format: ResponseFormat }) => {
      try {
        const markers = await apiGet<Array<{ id: number; nome: string }>>(`/ordens-servico/${params.idOrdemServico}/marcadores`);
        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify(markers, null, 2) }], structuredContent: toStructuredContent({ items: markers }) };
        }
        const lines = [`# Marcadores da OS ${params.idOrdemServico}`, "", markers.length > 0 ? markers.map(m => `- ${m.nome} (ID: ${m.id})`).join("\n") : "Nenhum"];
        return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: toStructuredContent({ items: markers }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_update_service_order_markers",
    {
      title: "Atualizar Marcadores da OS",
      inputSchema: z.object({ idOrdemServico: z.number().int().positive(), marcadores: z.array(z.object({ id: z.number().int().positive() })) }).strict(),
      description: `Atualiza os marcadores de uma ordem de serviço.`,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { idOrdemServico: number; marcadores: Array<{ id: number }> }) => {
      try {
        await apiPut(`/ordens-servico/${params.idOrdemServico}/marcadores`, params.marcadores);
        return { content: [{ type: "text", text: formatSuccess(`Marcadores atualizados`) }], structuredContent: toStructuredContent({ id: params.idOrdemServico, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_create_service_order_markers",
    {
      title: "Criar Marcadores da OS",
      inputSchema: z.object({ idOrdemServico: z.number().int().positive(), marcadores: z.array(z.object({ nome: z.string().min(1).max(100) })).min(1) }).strict(),
      description: `Adiciona marcadores a uma ordem de serviço.`,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (params: { idOrdemServico: number; marcadores: Array<{ nome: string }> }) => {
      try {
        await apiPost(`/ordens-servico/${params.idOrdemServico}/marcadores`, params.marcadores);
        return { content: [{ type: "text", text: formatSuccess(`Marcadores adicionados`) }], structuredContent: toStructuredContent({ id: params.idOrdemServico, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_delete_service_order_markers",
    {
      title: "Excluir Marcadores da OS",
      inputSchema: z.object({ idOrdemServico: z.number().int().positive() }).strict(),
      description: `Remove todos os marcadores de uma ordem de serviço.`,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true }
    },
    async (params: { idOrdemServico: number }) => {
      try {
        await apiDelete(`/ordens-servico/${params.idOrdemServico}/marcadores`);
        return { content: [{ type: "text", text: formatSuccess(`Marcadores removidos`) }], structuredContent: toStructuredContent({ id: params.idOrdemServico, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
