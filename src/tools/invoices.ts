/**
 * Invoice (Nota Fiscal) Tools for Tiny ERP MCP Server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ResponseFormat } from "../constants.js";
import { apiGet, apiPost, apiPut, apiDelete, handleApiError } from "../services/api-client.js";
import {
  formatListResponse,
  formatItemResponse,
  formatCurrency,
  formatDate,
  formatSuccess,
  toStructuredContent
} from "../services/formatters.js";
import { ResponseFormatSchema, PaginationSchema, OrderBySchema } from "../schemas/common.js";
import type { Invoice } from "../types.js";

// ============================================================================
// Schemas
// ============================================================================

const ListInvoicesInputSchema = z.object({
  numero: z.string().max(20).optional().describe("Filtrar por número da NF"),
  serie: z.string().max(5).optional().describe("Filtrar por série"),
  situacao: z.enum(["pendente", "emitida", "cancelada", "denegada", "erro"]).optional().describe("Filtrar por situação"),
  tipo: z.enum(["entrada", "saida"]).optional().describe("Filtrar por tipo: entrada ou saida"),
  dataInicialEmissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data inicial de emissão"),
  dataFinalEmissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data final de emissão"),
  nomeCliente: z.string().max(200).optional().describe("Filtrar por nome do cliente"),
  orderBy: OrderBySchema,
  ...PaginationSchema.shape,
  response_format: ResponseFormatSchema
}).strict();

const GetInvoiceInputSchema = z.object({
  idNotaFiscal: z.number().int().positive().describe("ID da nota fiscal"),
  response_format: ResponseFormatSchema
}).strict();

const GetInvoiceItemInputSchema = z.object({
  idNotaFiscal: z.number().int().positive().describe("ID da nota fiscal"),
  idItem: z.number().int().positive().describe("ID do item"),
  response_format: ResponseFormatSchema
}).strict();

const GetInvoiceLinkInputSchema = z.object({
  idNotaFiscal: z.number().int().positive().describe("ID da nota fiscal")
}).strict();

const GetInvoiceXmlInputSchema = z.object({
  idNotaFiscal: z.number().int().positive().describe("ID da nota fiscal")
}).strict();

const AuthorizeInvoiceInputSchema = z.object({
  idNotaFiscal: z.number().int().positive().describe("ID da nota fiscal")
}).strict();

const CancelInvoiceInputSchema = z.object({
  idNotaFiscal: z.number().int().positive().describe("ID da nota fiscal"),
  motivo: z.string().min(15).max(255).describe("Motivo do cancelamento (mínimo 15 caracteres)")
}).strict();

const IncludeInvoiceXmlInputSchema = z.object({
  xml: z.string().min(1).describe("Conteúdo do XML da nota fiscal")
}).strict();

const InvoiceAccountsInputSchema = z.object({
  idNotaFiscal: z.number().int().positive().describe("ID da nota fiscal")
}).strict();

const UpdateInvoiceTrackingInputSchema = z.object({
  idNotaFiscal: z.number().int().positive().describe("ID da nota fiscal"),
  codigoRastreamento: z.string().max(100).optional().describe("Código de rastreamento"),
  urlRastreamento: z.string().url().max(500).optional().describe("URL de rastreamento")
}).strict();

const InvoiceMarkersInputSchema = z.object({
  idNotaFiscal: z.number().int().positive().describe("ID da nota fiscal"),
  response_format: ResponseFormatSchema
}).strict();

const UpdateInvoiceMarkersInputSchema = z.object({
  idNotaFiscal: z.number().int().positive().describe("ID da nota fiscal"),
  marcadores: z.array(z.object({
    id: z.number().int().positive(),
    nome: z.string().optional()
  })).describe("Lista de marcadores")
}).strict();

const CreateInvoiceMarkersInputSchema = z.object({
  idNotaFiscal: z.number().int().positive().describe("ID da nota fiscal"),
  marcadores: z.array(z.object({
    nome: z.string().min(1).max(100)
  })).min(1).describe("Lista de marcadores a criar")
}).strict();

// ============================================================================
// Formatters
// ============================================================================

function invoiceToMarkdown(nf: Invoice): string {
  const lines = [
    `## NF ${nf.numero || "-"} (ID: ${nf.id})`,
    "",
    `- **Série:** ${nf.serie || "-"}`,
    `- **Chave de Acesso:** ${nf.chaveAcesso || "-"}`,
    `- **Data Emissão:** ${formatDate(nf.dataEmissao)}`,
    `- **Situação:** ${nf.situacao}`,
    `- **Tipo:** ${nf.tipo || "-"}`,
    `- **Natureza:** ${nf.naturezaOperacao || "-"}`,
    `- **Cliente:** ${nf.cliente?.nome || "-"}`,
    `- **Valor Total:** ${formatCurrency(nf.valorTotal)}`,
    ""
  ];
  return lines.join("\n");
}

function invoiceToJson(nf: Invoice): Record<string, unknown> {
  return {
    id: nf.id,
    numero: nf.numero,
    serie: nf.serie,
    chaveAcesso: nf.chaveAcesso,
    dataEmissao: nf.dataEmissao,
    situacao: nf.situacao,
    tipo: nf.tipo,
    naturezaOperacao: nf.naturezaOperacao,
    cliente: nf.cliente,
    valorTotal: nf.valorTotal,
    valorProdutos: nf.valorProdutos,
    valorFrete: nf.valorFrete
  };
}

// ============================================================================
// Tool Registration
// ============================================================================

export function registerInvoiceTools(server: McpServer): void {
  // List Invoices
  server.registerTool(
    "tiny_list_invoices",
    {
      title: "Listar Notas Fiscais",
      description: `Lista notas fiscais do Tiny ERP.

Filtros: numero, serie, situacao (pendente/emitida/cancelada/denegada/erro),
tipo (entrada/saida), período de emissão, nome do cliente.`,
      inputSchema: ListInvoicesInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof ListInvoicesInputSchema>) => {
      try {
        const queryParams: Record<string, unknown> = {
          limit: params.limit,
          offset: params.offset,
          orderBy: params.orderBy
        };

        if (params.numero) queryParams.numero = params.numero;
        if (params.serie) queryParams.serie = params.serie;
        if (params.situacao) queryParams.situacao = params.situacao;
        if (params.tipo) queryParams.tipo = params.tipo;
        if (params.dataInicialEmissao) queryParams.dataInicialEmissao = params.dataInicialEmissao;
        if (params.dataFinalEmissao) queryParams.dataFinalEmissao = params.dataFinalEmissao;
        if (params.nomeCliente) queryParams.nomeCliente = params.nomeCliente;

        const response = await apiGet<{ itens: Invoice[]; paginacao: { total: number } }>("/notas-fiscais", queryParams);
        const items = response.itens || [];
        const total = response.paginacao?.total || items.length;

        const { text, structured } = formatListResponse(
          "Notas Fiscais",
          items,
          total,
          params.offset,
          params.response_format,
          invoiceToMarkdown
        );

        return {
          content: [{ type: "text", text }],
          structuredContent: structured
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Get Invoice
  server.registerTool(
    "tiny_get_invoice",
    {
      title: "Obter Nota Fiscal",
      description: `Obtém detalhes completos de uma nota fiscal.`,
      inputSchema: GetInvoiceInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof GetInvoiceInputSchema>) => {
      try {
        const invoice = await apiGet<Invoice>(`/notas-fiscais/${params.idNotaFiscal}`);

        const { text, structured } = formatItemResponse(
          `Nota Fiscal ${invoice.numero || invoice.id}`,
          invoice,
          params.response_format,
          invoiceToMarkdown
        );

        return {
          content: [{ type: "text", text }],
          structuredContent: structured
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Get Invoice Item
  server.registerTool(
    "tiny_get_invoice_item",
    {
      title: "Obter Item da Nota Fiscal",
      description: `Obtém detalhes de um item específico da nota fiscal.`,
      inputSchema: GetInvoiceItemInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof GetInvoiceItemInputSchema>) => {
      try {
        const item = await apiGet(`/notas-fiscais/${params.idNotaFiscal}/itens/${params.idItem}`);

        if (params.response_format === ResponseFormat.JSON) {
          return {
            content: [{ type: "text", text: JSON.stringify(item, null, 2) }],
            structuredContent: toStructuredContent(item)
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(item, null, 2) }],
          structuredContent: toStructuredContent(item)
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Get Invoice Link
  server.registerTool(
    "tiny_get_invoice_link",
    {
      title: "Obter Link da Nota Fiscal",
      description: `Obtém o link para visualização da nota fiscal (DANFE).`,
      inputSchema: GetInvoiceLinkInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof GetInvoiceLinkInputSchema>) => {
      try {
        const result = await apiGet<{ link: string }>(`/notas-fiscais/${params.idNotaFiscal}/link`);
        return {
          content: [{ type: "text", text: `Link da NF: ${result.link}` }],
          structuredContent: toStructuredContent(result)
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Get Invoice XML
  server.registerTool(
    "tiny_get_invoice_xml",
    {
      title: "Obter XML da Nota Fiscal",
      description: `Obtém o XML da nota fiscal eletrônica.`,
      inputSchema: GetInvoiceXmlInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof GetInvoiceXmlInputSchema>) => {
      try {
        const result = await apiGet<{ xml: string }>(`/notas-fiscais/${params.idNotaFiscal}/xml`);
        return {
          content: [{ type: "text", text: result.xml }],
          structuredContent: toStructuredContent({ xml: result.xml })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Authorize Invoice
  server.registerTool(
    "tiny_authorize_invoice",
    {
      title: "Autorizar Nota Fiscal",
      description: `Envia a nota fiscal para autorização na SEFAZ.

A NF precisa estar com situação "pendente" para ser autorizada.`,
      inputSchema: AuthorizeInvoiceInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof AuthorizeInvoiceInputSchema>) => {
      try {
        const result = await apiPost<{ situacao: string; protocolo?: string }>(`/notas-fiscais/${params.idNotaFiscal}/autorizar`);
        return {
          content: [{ type: "text", text: formatSuccess(`NF ${params.idNotaFiscal} autorizada. Protocolo: ${result.protocolo || "-"}`) }],
          structuredContent: toStructuredContent({ id: params.idNotaFiscal, ...result, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Cancel Invoice
  server.registerTool(
    "tiny_cancel_invoice",
    {
      title: "Cancelar Nota Fiscal",
      description: `Cancela uma nota fiscal junto à SEFAZ.

Requer motivo com no mínimo 15 caracteres.`,
      inputSchema: CancelInvoiceInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof CancelInvoiceInputSchema>) => {
      try {
        await apiPost(`/notas-fiscais/${params.idNotaFiscal}/cancelar`, { motivo: params.motivo });
        return {
          content: [{ type: "text", text: formatSuccess(`NF ${params.idNotaFiscal} cancelada`) }],
          structuredContent: toStructuredContent({ id: params.idNotaFiscal, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Include Invoice from XML
  server.registerTool(
    "tiny_include_invoice_xml",
    {
      title: "Incluir Nota Fiscal por XML",
      description: `Importa uma nota fiscal a partir do XML.

Usado para incluir notas de entrada (compras).`,
      inputSchema: IncludeInvoiceXmlInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof IncludeInvoiceXmlInputSchema>) => {
      try {
        const result = await apiPost<{ id: number }>("/notas-fiscais/incluir-xml", { xml: params.xml });
        return {
          content: [{ type: "text", text: formatSuccess(`NF importada com ID: ${result.id}`) }],
          structuredContent: toStructuredContent({ id: result.id, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Include Consumer Invoice from XML
  server.registerTool(
    "tiny_include_consumer_invoice_xml",
    {
      title: "Incluir NFC-e por XML",
      description: `Importa uma nota fiscal de consumidor (NFC-e) a partir do XML.`,
      inputSchema: IncludeInvoiceXmlInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof IncludeInvoiceXmlInputSchema>) => {
      try {
        const result = await apiPost<{ id: number }>("/notas-fiscais/incluir-xml-consumidor", { xml: params.xml });
        return {
          content: [{ type: "text", text: formatSuccess(`NFC-e importada com ID: ${result.id}`) }],
          structuredContent: toStructuredContent({ id: result.id, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Post Invoice Accounts
  server.registerTool(
    "tiny_post_invoice_accounts",
    {
      title: "Lançar Contas da Nota Fiscal",
      description: `Lança as contas a pagar/receber da nota fiscal no financeiro.`,
      inputSchema: InvoiceAccountsInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof InvoiceAccountsInputSchema>) => {
      try {
        await apiPost(`/notas-fiscais/${params.idNotaFiscal}/lancar-contas`);
        return {
          content: [{ type: "text", text: formatSuccess(`Contas da NF ${params.idNotaFiscal} lançadas`) }],
          structuredContent: toStructuredContent({ id: params.idNotaFiscal, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Post Invoice Stock
  server.registerTool(
    "tiny_post_invoice_stock",
    {
      title: "Lançar Estoque da Nota Fiscal",
      description: `Lança os movimentos de estoque da nota fiscal.`,
      inputSchema: InvoiceAccountsInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof InvoiceAccountsInputSchema>) => {
      try {
        await apiPost(`/notas-fiscais/${params.idNotaFiscal}/lancar-estoque`);
        return {
          content: [{ type: "text", text: formatSuccess(`Estoque da NF ${params.idNotaFiscal} lançado`) }],
          structuredContent: toStructuredContent({ id: params.idNotaFiscal, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Update Invoice Tracking
  server.registerTool(
    "tiny_update_invoice_tracking",
    {
      title: "Atualizar Rastreamento da NF",
      description: `Atualiza informações de rastreamento da nota fiscal.`,
      inputSchema: UpdateInvoiceTrackingInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof UpdateInvoiceTrackingInputSchema>) => {
      try {
        const { idNotaFiscal, ...data } = params;
        await apiPut(`/notas-fiscais/${idNotaFiscal}/rastreamento`, data);
        return {
          content: [{ type: "text", text: formatSuccess(`Rastreamento da NF ${idNotaFiscal} atualizado`) }],
          structuredContent: toStructuredContent({ id: idNotaFiscal, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Get Invoice Markers
  server.registerTool(
    "tiny_get_invoice_markers",
    {
      title: "Obter Marcadores da NF",
      description: `Obtém os marcadores associados a uma nota fiscal.`,
      inputSchema: InvoiceMarkersInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof InvoiceMarkersInputSchema>) => {
      try {
        const markers = await apiGet<Array<{ id: number; nome: string }>>(`/notas-fiscais/${params.idNotaFiscal}/marcadores`);

        if (params.response_format === ResponseFormat.JSON) {
          return {
            content: [{ type: "text", text: JSON.stringify(markers, null, 2) }],
            structuredContent: toStructuredContent({ items: markers })
          };
        }

        const lines = [
          `# Marcadores da NF (ID: ${params.idNotaFiscal})`,
          "",
          markers.length > 0
            ? markers.map(m => `- ${m.nome} (ID: ${m.id})`).join("\n")
            : "Nenhum marcador"
        ];

        return {
          content: [{ type: "text", text: lines.join("\n") }],
          structuredContent: toStructuredContent({ items: markers })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Update Invoice Markers
  server.registerTool(
    "tiny_update_invoice_markers",
    {
      title: "Atualizar Marcadores da NF",
      description: `Atualiza os marcadores de uma nota fiscal.`,
      inputSchema: UpdateInvoiceMarkersInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof UpdateInvoiceMarkersInputSchema>) => {
      try {
        await apiPut(`/notas-fiscais/${params.idNotaFiscal}/marcadores`, params.marcadores);
        return {
          content: [{ type: "text", text: formatSuccess(`Marcadores da NF ${params.idNotaFiscal} atualizados`) }],
          structuredContent: toStructuredContent({ id: params.idNotaFiscal, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Create Invoice Markers
  server.registerTool(
    "tiny_create_invoice_markers",
    {
      title: "Criar Marcadores da NF",
      description: `Adiciona novos marcadores a uma nota fiscal.`,
      inputSchema: CreateInvoiceMarkersInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof CreateInvoiceMarkersInputSchema>) => {
      try {
        await apiPost(`/notas-fiscais/${params.idNotaFiscal}/marcadores`, params.marcadores);
        return {
          content: [{ type: "text", text: formatSuccess(`Marcadores adicionados à NF ${params.idNotaFiscal}`) }],
          structuredContent: toStructuredContent({ id: params.idNotaFiscal, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Delete Invoice Markers
  server.registerTool(
    "tiny_delete_invoice_markers",
    {
      title: "Excluir Marcadores da NF",
      description: `Remove todos os marcadores de uma nota fiscal.`,
      inputSchema: z.object({
        idNotaFiscal: z.number().int().positive().describe("ID da nota fiscal")
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: { idNotaFiscal: number }) => {
      try {
        await apiDelete(`/notas-fiscais/${params.idNotaFiscal}/marcadores`);
        return {
          content: [{ type: "text", text: formatSuccess(`Marcadores da NF ${params.idNotaFiscal} removidos`) }],
          structuredContent: toStructuredContent({ id: params.idNotaFiscal, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
