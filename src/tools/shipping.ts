/**
 * Shipping and Separation Tools for Tiny ERP MCP Server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ResponseFormat } from "../constants.js";
import { apiGet, apiPost, apiPut, handleApiError } from "../services/api-client.js";
import { formatListResponse, formatItemResponse, formatDate, formatDateTime, formatSuccess, toStructuredContent } from "../services/formatters.js";
import { ResponseFormatSchema, PaginationSchema, OrderBySchema } from "../schemas/common.js";
import type { ShipmentGroup, Separation } from "../types.js";

// ============================================================================
// Schemas
// ============================================================================

const ListShipmentGroupsInputSchema = z.object({
  situacao: z.enum(["pendente", "em_andamento", "concluido"]).optional().describe("Situação"),
  dataInicialCriacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data inicial"),
  dataFinalCriacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data final"),
  orderBy: OrderBySchema,
  ...PaginationSchema.shape,
  response_format: ResponseFormatSchema
}).strict();

const GetShipmentGroupInputSchema = z.object({
  idAgrupamento: z.number().int().positive().describe("ID do agrupamento"),
  response_format: ResponseFormatSchema
}).strict();

const CreateShipmentGroupInputSchema = z.object({
  nome: z.string().max(100).optional().describe("Nome do agrupamento"),
  origens: z.array(z.object({
    idPedido: z.number().int().positive().optional().describe("ID do pedido"),
    idNotaFiscal: z.number().int().positive().optional().describe("ID da NF")
  })).min(1).describe("Origens (pedidos ou NFs)")
}).strict();

const AddShipmentOriginsInputSchema = z.object({
  idAgrupamento: z.number().int().positive().describe("ID do agrupamento"),
  origens: z.array(z.object({
    idPedido: z.number().int().positive().optional(),
    idNotaFiscal: z.number().int().positive().optional()
  })).min(1).describe("Origens a adicionar")
}).strict();

const UpdateShipmentInputSchema = z.object({
  idAgrupamento: z.number().int().positive().describe("ID do agrupamento"),
  idExpedicao: z.number().int().positive().describe("ID da expedição"),
  codigoRastreamento: z.string().max(100).optional().describe("Código de rastreamento"),
  urlRastreamento: z.string().url().max(500).optional().describe("URL de rastreamento")
}).strict();

const ListSeparationsInputSchema = z.object({
  situacao: z.enum(["pendente", "em_andamento", "concluido"]).optional().describe("Situação"),
  dataInicialCriacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data inicial"),
  dataFinalCriacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data final"),
  ...PaginationSchema.shape,
  response_format: ResponseFormatSchema
}).strict();

const GetSeparationInputSchema = z.object({
  idSeparacao: z.number().int().positive().describe("ID da separação"),
  response_format: ResponseFormatSchema
}).strict();

const UpdateSeparationStatusInputSchema = z.object({
  idSeparacao: z.number().int().positive().describe("ID da separação"),
  situacao: z.enum(["pendente", "em_andamento", "concluido"]).describe("Nova situação")
}).strict();

// ============================================================================
// Formatters
// ============================================================================

function shipmentGroupToMarkdown(sg: ShipmentGroup): string {
  return [
    `## Agrupamento #${sg.id}`,
    "",
    `- **Nome:** ${sg.nome || "-"}`,
    `- **Data Criação:** ${formatDateTime(sg.dataCriacao)}`,
    `- **Situação:** ${sg.situacao}`,
    ""
  ].join("\n");
}

function separationToMarkdown(s: Separation): string {
  return [
    `## Separação #${s.id}`,
    "",
    `- **Data Criação:** ${formatDateTime(s.dataCriacao)}`,
    `- **Situação:** ${s.situacao}`,
    ""
  ].join("\n");
}

// ============================================================================
// Tool Registration
// ============================================================================

export function registerShippingTools(server: McpServer): void {
  // Shipment Groups
  server.registerTool(
    "tiny_list_shipment_groups",
    {
      title: "Listar Agrupamentos de Expedição",
      description: `Lista agrupamentos de expedição.`,
      inputSchema: ListShipmentGroupsInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof ListShipmentGroupsInputSchema>) => {
      try {
        const queryParams: Record<string, unknown> = { limit: params.limit, offset: params.offset, orderBy: params.orderBy };
        if (params.situacao) queryParams.situacao = params.situacao;
        if (params.dataInicialCriacao) queryParams.dataInicialCriacao = params.dataInicialCriacao;
        if (params.dataFinalCriacao) queryParams.dataFinalCriacao = params.dataFinalCriacao;

        const response = await apiGet<{ itens: ShipmentGroup[]; paginacao: { total: number } }>("/expedicoes/agrupamentos", queryParams);
        const items = response.itens || [];
        const total = response.paginacao?.total || items.length;

        const { text, structured } = formatListResponse("Agrupamentos de Expedição", items, total, params.offset, params.response_format, shipmentGroupToMarkdown);
        return { content: [{ type: "text", text }], structuredContent: structured };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_get_shipment_group",
    {
      title: "Obter Agrupamento de Expedição",
      description: `Obtém detalhes de um agrupamento de expedição.`,
      inputSchema: GetShipmentGroupInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof GetShipmentGroupInputSchema>) => {
      try {
        const sg = await apiGet<ShipmentGroup>(`/expedicoes/agrupamentos/${params.idAgrupamento}`);
        const { text, structured } = formatItemResponse(`Agrupamento #${sg.id}`, sg, params.response_format, shipmentGroupToMarkdown);
        return { content: [{ type: "text", text }], structuredContent: structured };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_create_shipment_group",
    {
      title: "Criar Agrupamento de Expedição",
      description: `Cria um novo agrupamento de expedição a partir de pedidos ou NFs.`,
      inputSchema: CreateShipmentGroupInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (params: z.infer<typeof CreateShipmentGroupInputSchema>) => {
      try {
        const result = await apiPost<{ id: number }>("/expedicoes/agrupamentos", params);
        return { content: [{ type: "text", text: formatSuccess(`Agrupamento criado com ID: ${result.id}`) }], structuredContent: toStructuredContent({ id: result.id, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_add_shipment_origins",
    {
      title: "Adicionar Origens ao Agrupamento",
      description: `Adiciona pedidos ou NFs a um agrupamento de expedição existente.`,
      inputSchema: AddShipmentOriginsInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (params: z.infer<typeof AddShipmentOriginsInputSchema>) => {
      try {
        await apiPost(`/expedicoes/agrupamentos/${params.idAgrupamento}/origens`, { origens: params.origens });
        return { content: [{ type: "text", text: formatSuccess(`Origens adicionadas ao agrupamento ${params.idAgrupamento}`) }], structuredContent: toStructuredContent({ id: params.idAgrupamento, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_update_shipment",
    {
      title: "Atualizar Expedição",
      description: `Atualiza informações de rastreamento de uma expedição dentro de um agrupamento.`,
      inputSchema: UpdateShipmentInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof UpdateShipmentInputSchema>) => {
      try {
        const { idAgrupamento, idExpedicao, ...data } = params;
        await apiPut(`/expedicoes/agrupamentos/${idAgrupamento}/expedicoes/${idExpedicao}`, data);
        return { content: [{ type: "text", text: formatSuccess(`Expedição ${idExpedicao} atualizada`) }], structuredContent: toStructuredContent({ idAgrupamento, idExpedicao, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_complete_shipment_group",
    {
      title: "Concluir Agrupamento de Expedição",
      description: `Marca um agrupamento de expedição como concluído.`,
      inputSchema: z.object({ idAgrupamento: z.number().int().positive() }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { idAgrupamento: number }) => {
      try {
        await apiPost(`/expedicoes/agrupamentos/${params.idAgrupamento}/concluir`);
        return { content: [{ type: "text", text: formatSuccess(`Agrupamento ${params.idAgrupamento} concluído`) }], structuredContent: toStructuredContent({ id: params.idAgrupamento, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_get_shipment_labels",
    {
      title: "Obter Etiquetas do Agrupamento",
      description: `Obtém as etiquetas de envio de um agrupamento de expedição.`,
      inputSchema: z.object({ idAgrupamento: z.number().int().positive() }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { idAgrupamento: number }) => {
      try {
        const result = await apiGet<{ url?: string; etiquetas?: Array<{ url: string }> }>(`/expedicoes/agrupamentos/${params.idAgrupamento}/etiquetas`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: toStructuredContent(result) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_get_shipment_item_labels",
    {
      title: "Obter Etiquetas de uma Expedição",
      description: `Obtém as etiquetas de uma expedição específica dentro de um agrupamento.`,
      inputSchema: z.object({ idAgrupamento: z.number().int().positive(), idExpedicao: z.number().int().positive() }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { idAgrupamento: number; idExpedicao: number }) => {
      try {
        const result = await apiGet<{ url?: string }>(`/expedicoes/agrupamentos/${params.idAgrupamento}/expedicoes/${params.idExpedicao}/etiquetas`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: toStructuredContent(result) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Separations
  server.registerTool(
    "tiny_list_separations",
    {
      title: "Listar Separações",
      description: `Lista separações de estoque.`,
      inputSchema: ListSeparationsInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof ListSeparationsInputSchema>) => {
      try {
        const queryParams: Record<string, unknown> = { limit: params.limit, offset: params.offset };
        if (params.situacao) queryParams.situacao = params.situacao;
        if (params.dataInicialCriacao) queryParams.dataInicialCriacao = params.dataInicialCriacao;
        if (params.dataFinalCriacao) queryParams.dataFinalCriacao = params.dataFinalCriacao;

        const response = await apiGet<{ itens: Separation[]; paginacao: { total: number } }>("/separacoes", queryParams);
        const items = response.itens || [];
        const total = response.paginacao?.total || items.length;

        const { text, structured } = formatListResponse("Separações", items, total, params.offset, params.response_format, separationToMarkdown);
        return { content: [{ type: "text", text }], structuredContent: structured };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_get_separation",
    {
      title: "Obter Separação",
      description: `Obtém detalhes de uma separação.`,
      inputSchema: GetSeparationInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof GetSeparationInputSchema>) => {
      try {
        const sep = await apiGet<Separation>(`/separacoes/${params.idSeparacao}`);
        const { text, structured } = formatItemResponse(`Separação #${sep.id}`, sep, params.response_format, separationToMarkdown);
        return { content: [{ type: "text", text }], structuredContent: structured };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_update_separation_status",
    {
      title: "Atualizar Situação da Separação",
      description: `Altera a situação de uma separação.`,
      inputSchema: UpdateSeparationStatusInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof UpdateSeparationStatusInputSchema>) => {
      try {
        await apiPut(`/separacoes/${params.idSeparacao}/situacao`, { situacao: params.situacao });
        return { content: [{ type: "text", text: formatSuccess(`Situação da separação alterada para: ${params.situacao}`) }], structuredContent: toStructuredContent({ id: params.idSeparacao, situacao: params.situacao, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
