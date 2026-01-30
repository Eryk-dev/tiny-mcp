/**
 * Finance Tools (Accounts Payable/Receivable) for Tiny ERP MCP Server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ResponseFormat } from "../constants.js";
import { apiGet, apiPost, apiPut, apiDelete, handleApiError } from "../services/api-client.js";
import { formatListResponse, formatItemResponse, formatCurrency, formatDate, formatSuccess, toStructuredContent } from "../services/formatters.js";
import { ResponseFormatSchema, PaginationSchema, OrderBySchema } from "../schemas/common.js";
import type { Payable, Receivable, Receipt, IncomeExpenseCategory } from "../types.js";

// ============================================================================
// Schemas
// ============================================================================

const ListPayablesInputSchema = z.object({
  nomeCliente: z.string().max(200).optional().describe("Filtrar por nome do fornecedor"),
  situacao: z.enum(["aberto", "cancelada", "pago", "parcial", "prevista", "atrasadas", "emissao"]).optional().describe("Situação"),
  dataInicialEmissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data inicial de emissão"),
  dataFinalEmissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data final de emissão"),
  dataInicialVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data inicial de vencimento"),
  dataFinalVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data final de vencimento"),
  orderBy: OrderBySchema,
  ...PaginationSchema.shape,
  response_format: ResponseFormatSchema
}).strict();

const GetPayableInputSchema = z.object({
  idContaPagar: z.number().int().positive().describe("ID da conta a pagar"),
  response_format: ResponseFormatSchema
}).strict();

const CreatePayableInputSchema = z.object({
  nomeCliente: z.string().min(1).max(200).describe("Nome do fornecedor"),
  dataEmissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Data de emissão"),
  dataVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Data de vencimento"),
  valor: z.number().positive().describe("Valor"),
  historico: z.string().max(500).optional().describe("Histórico/descrição"),
  idCategoria: z.number().int().positive().optional().describe("ID da categoria"),
  idFormaPagamento: z.number().int().positive().optional().describe("ID da forma de pagamento"),
  numeroBancario: z.string().max(50).optional().describe("Número bancário")
}).strict();

const ListReceivablesInputSchema = z.object({
  nomeCliente: z.string().max(200).optional().describe("Filtrar por nome do cliente"),
  situacao: z.enum(["aberto", "cancelada", "recebido", "parcial", "prevista", "atrasadas", "emissao"]).optional().describe("Situação"),
  dataInicialEmissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data inicial de emissão"),
  dataFinalEmissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data final de emissão"),
  dataInicialVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data inicial de vencimento"),
  dataFinalVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data final de vencimento"),
  orderBy: OrderBySchema,
  ...PaginationSchema.shape,
  response_format: ResponseFormatSchema
}).strict();

const GetReceivableInputSchema = z.object({
  idContaReceber: z.number().int().positive().describe("ID da conta a receber"),
  response_format: ResponseFormatSchema
}).strict();

const CreateReceivableInputSchema = z.object({
  nomeCliente: z.string().min(1).max(200).describe("Nome do cliente"),
  dataEmissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Data de emissão"),
  dataVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Data de vencimento"),
  valor: z.number().positive().describe("Valor"),
  historico: z.string().max(500).optional().describe("Histórico/descrição"),
  idCategoria: z.number().int().positive().optional().describe("ID da categoria"),
  idFormaRecebimento: z.number().int().positive().optional().describe("ID da forma de recebimento")
}).strict();

const UpdateReceivableInputSchema = z.object({
  idContaReceber: z.number().int().positive().describe("ID da conta a receber"),
  dataVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Nova data de vencimento"),
  valor: z.number().positive().optional().describe("Novo valor"),
  historico: z.string().max(500).optional().describe("Novo histórico")
}).strict();

const SettleReceivableInputSchema = z.object({
  idContaReceber: z.number().int().positive().describe("ID da conta a receber"),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Data do recebimento"),
  valor: z.number().positive().describe("Valor recebido"),
  observacao: z.string().max(500).optional().describe("Observação")
}).strict();

const GetReceiptsInputSchema = z.object({
  idConta: z.number().int().positive().describe("ID da conta"),
  tipo: z.enum(["pagar", "receber"]).describe("Tipo: pagar ou receber"),
  response_format: ResponseFormatSchema
}).strict();

const AccountMarkersInputSchema = z.object({
  idConta: z.number().int().positive().describe("ID da conta"),
  tipo: z.enum(["pagar", "receber"]).describe("Tipo: pagar ou receber"),
  response_format: ResponseFormatSchema
}).strict();

const UpdateAccountMarkersInputSchema = z.object({
  idConta: z.number().int().positive().describe("ID da conta"),
  tipo: z.enum(["pagar", "receber"]).describe("Tipo: pagar ou receber"),
  marcadores: z.array(z.object({ id: z.number().int().positive(), nome: z.string().optional() })).describe("Lista de marcadores")
}).strict();

const CreateAccountMarkersInputSchema = z.object({
  idConta: z.number().int().positive().describe("ID da conta"),
  tipo: z.enum(["pagar", "receber"]).describe("Tipo: pagar ou receber"),
  marcadores: z.array(z.object({ nome: z.string().min(1).max(100) })).min(1).describe("Lista de marcadores")
}).strict();

const ListIncomeExpenseCategoriesInputSchema = z.object({
  descricao: z.string().max(200).optional().describe("Filtrar por descrição"),
  grupo: z.string().max(100).optional().describe("Filtrar por grupo"),
  orderBy: OrderBySchema,
  ...PaginationSchema.shape,
  response_format: ResponseFormatSchema
}).strict();

// ============================================================================
// Formatters
// ============================================================================

function payableToMarkdown(p: Payable): string {
  return [
    `## Conta a Pagar #${p.id}`,
    "",
    `- **Fornecedor:** ${p.nomeCliente || "-"}`,
    `- **Emissão:** ${formatDate(p.dataEmissao)}`,
    `- **Vencimento:** ${formatDate(p.dataVencimento)}`,
    `- **Valor:** ${formatCurrency(p.valor)}`,
    `- **Pago:** ${formatCurrency(p.valorPago)}`,
    `- **Situação:** ${p.situacao}`,
    `- **Histórico:** ${p.historico || "-"}`,
    ""
  ].join("\n");
}

function receivableToMarkdown(r: Receivable): string {
  return [
    `## Conta a Receber #${r.id}`,
    "",
    `- **Cliente:** ${r.nomeCliente || "-"}`,
    `- **Emissão:** ${formatDate(r.dataEmissao)}`,
    `- **Vencimento:** ${formatDate(r.dataVencimento)}`,
    `- **Valor:** ${formatCurrency(r.valor)}`,
    `- **Recebido:** ${formatCurrency(r.valorRecebido)}`,
    `- **Situação:** ${r.situacao}`,
    `- **Histórico:** ${r.historico || "-"}`,
    ""
  ].join("\n");
}

function categoryToMarkdown(c: IncomeExpenseCategory): string {
  return `- ${c.descricao} (ID: ${c.id}) - Grupo: ${c.grupo}, Tipo: ${c.tipo}`;
}

// ============================================================================
// Tool Registration
// ============================================================================

export function registerFinanceTools(server: McpServer): void {
  // List Payables
  server.registerTool(
    "tiny_list_payables",
    {
      title: "Listar Contas a Pagar",
      description: `Lista contas a pagar do financeiro.

Filtros: nomeCliente, situacao, período de emissão/vencimento.`,
      inputSchema: ListPayablesInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof ListPayablesInputSchema>) => {
      try {
        const queryParams: Record<string, unknown> = { limit: params.limit, offset: params.offset, orderBy: params.orderBy };
        if (params.nomeCliente) queryParams.nomeCliente = params.nomeCliente;
        if (params.situacao) queryParams.situacao = params.situacao;
        if (params.dataInicialEmissao) queryParams.dataInicialEmissao = params.dataInicialEmissao;
        if (params.dataFinalEmissao) queryParams.dataFinalEmissao = params.dataFinalEmissao;
        if (params.dataInicialVencimento) queryParams.dataInicialVencimento = params.dataInicialVencimento;
        if (params.dataFinalVencimento) queryParams.dataFinalVencimento = params.dataFinalVencimento;

        const response = await apiGet<{ itens: Payable[]; paginacao: { total: number } }>("/contas-pagar", queryParams);
        const items = response.itens || [];
        const total = response.paginacao?.total || items.length;

        const { text, structured } = formatListResponse("Contas a Pagar", items, total, params.offset, params.response_format, payableToMarkdown);
        return { content: [{ type: "text", text }], structuredContent: structured };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Get Payable
  server.registerTool(
    "tiny_get_payable",
    {
      title: "Obter Conta a Pagar",
      description: `Obtém detalhes de uma conta a pagar.`,
      inputSchema: GetPayableInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof GetPayableInputSchema>) => {
      try {
        const payable = await apiGet<Payable>(`/contas-pagar/${params.idContaPagar}`);
        const { text, structured } = formatItemResponse(`Conta a Pagar #${payable.id}`, payable, params.response_format, payableToMarkdown);
        return { content: [{ type: "text", text }], structuredContent: structured };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Create Payable
  server.registerTool(
    "tiny_create_payable",
    {
      title: "Criar Conta a Pagar",
      description: `Cria uma nova conta a pagar.`,
      inputSchema: CreatePayableInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (params: z.infer<typeof CreatePayableInputSchema>) => {
      try {
        const result = await apiPost<{ id: number }>("/contas-pagar", params);
        return { content: [{ type: "text", text: formatSuccess(`Conta a pagar criada com ID: ${result.id}`) }], structuredContent: toStructuredContent({ id: result.id, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Get Payable Receipts
  server.registerTool(
    "tiny_get_payable_receipts",
    {
      title: "Obter Pagamentos da Conta a Pagar",
      description: `Obtém os pagamentos realizados de uma conta a pagar.`,
      inputSchema: z.object({ idContaPagar: z.number().int().positive(), response_format: ResponseFormatSchema }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { idContaPagar: number; response_format: ResponseFormat }) => {
      try {
        const receipts = await apiGet<Receipt[]>(`/contas-pagar/${params.idContaPagar}/recebimentos`);
        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify(receipts, null, 2) }], structuredContent: toStructuredContent({ items: receipts }) };
        }
        const lines = [`# Pagamentos da Conta ${params.idContaPagar}`, "", ...receipts.map(r => `- ${formatDate(r.data)}: ${formatCurrency(r.valor)} - ${r.observacao || ""}`)];
        return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: toStructuredContent({ items: receipts }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // List Receivables
  server.registerTool(
    "tiny_list_receivables",
    {
      title: "Listar Contas a Receber",
      description: `Lista contas a receber do financeiro.`,
      inputSchema: ListReceivablesInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof ListReceivablesInputSchema>) => {
      try {
        const queryParams: Record<string, unknown> = { limit: params.limit, offset: params.offset, orderBy: params.orderBy };
        if (params.nomeCliente) queryParams.nomeCliente = params.nomeCliente;
        if (params.situacao) queryParams.situacao = params.situacao;
        if (params.dataInicialEmissao) queryParams.dataInicialEmissao = params.dataInicialEmissao;
        if (params.dataFinalEmissao) queryParams.dataFinalEmissao = params.dataFinalEmissao;
        if (params.dataInicialVencimento) queryParams.dataInicialVencimento = params.dataInicialVencimento;
        if (params.dataFinalVencimento) queryParams.dataFinalVencimento = params.dataFinalVencimento;

        const response = await apiGet<{ itens: Receivable[]; paginacao: { total: number } }>("/contas-receber", queryParams);
        const items = response.itens || [];
        const total = response.paginacao?.total || items.length;

        const { text, structured } = formatListResponse("Contas a Receber", items, total, params.offset, params.response_format, receivableToMarkdown);
        return { content: [{ type: "text", text }], structuredContent: structured };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Get Receivable
  server.registerTool(
    "tiny_get_receivable",
    {
      title: "Obter Conta a Receber",
      description: `Obtém detalhes de uma conta a receber.`,
      inputSchema: GetReceivableInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof GetReceivableInputSchema>) => {
      try {
        const receivable = await apiGet<Receivable>(`/contas-receber/${params.idContaReceber}`);
        const { text, structured } = formatItemResponse(`Conta a Receber #${receivable.id}`, receivable, params.response_format, receivableToMarkdown);
        return { content: [{ type: "text", text }], structuredContent: structured };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Create Receivable
  server.registerTool(
    "tiny_create_receivable",
    {
      title: "Criar Conta a Receber",
      description: `Cria uma nova conta a receber.`,
      inputSchema: CreateReceivableInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (params: z.infer<typeof CreateReceivableInputSchema>) => {
      try {
        const result = await apiPost<{ id: number }>("/contas-receber", params);
        return { content: [{ type: "text", text: formatSuccess(`Conta a receber criada com ID: ${result.id}`) }], structuredContent: toStructuredContent({ id: result.id, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Update Receivable
  server.registerTool(
    "tiny_update_receivable",
    {
      title: "Atualizar Conta a Receber",
      description: `Atualiza uma conta a receber.`,
      inputSchema: UpdateReceivableInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof UpdateReceivableInputSchema>) => {
      try {
        const { idContaReceber, ...data } = params;
        await apiPut(`/contas-receber/${idContaReceber}`, data);
        return { content: [{ type: "text", text: formatSuccess(`Conta a receber ${idContaReceber} atualizada`) }], structuredContent: toStructuredContent({ id: idContaReceber, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Settle Receivable
  server.registerTool(
    "tiny_settle_receivable",
    {
      title: "Baixar Conta a Receber",
      description: `Registra um recebimento para uma conta a receber.`,
      inputSchema: SettleReceivableInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (params: z.infer<typeof SettleReceivableInputSchema>) => {
      try {
        const { idContaReceber, ...data } = params;
        await apiPost(`/contas-receber/${idContaReceber}/baixar`, data);
        return { content: [{ type: "text", text: formatSuccess(`Recebimento de ${formatCurrency(params.valor)} registrado na conta ${idContaReceber}`) }], structuredContent: toStructuredContent({ id: idContaReceber, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Get Receivable Receipts
  server.registerTool(
    "tiny_get_receivable_receipts",
    {
      title: "Obter Recebimentos da Conta a Receber",
      description: `Obtém os recebimentos de uma conta a receber.`,
      inputSchema: z.object({ idContaReceber: z.number().int().positive(), response_format: ResponseFormatSchema }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { idContaReceber: number; response_format: ResponseFormat }) => {
      try {
        const receipts = await apiGet<Receipt[]>(`/contas-receber/${params.idContaReceber}/recebimentos`);
        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify(receipts, null, 2) }], structuredContent: toStructuredContent({ items: receipts }) };
        }
        const lines = [`# Recebimentos da Conta ${params.idContaReceber}`, "", ...receipts.map(r => `- ${formatDate(r.data)}: ${formatCurrency(r.valor)} - ${r.observacao || ""}`)];
        return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: toStructuredContent({ items: receipts }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Account Markers (Payable)
  server.registerTool(
    "tiny_get_payable_markers",
    {
      title: "Obter Marcadores da Conta a Pagar",
      description: `Obtém os marcadores de uma conta a pagar.`,
      inputSchema: z.object({ idContaPagar: z.number().int().positive(), response_format: ResponseFormatSchema }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { idContaPagar: number; response_format: ResponseFormat }) => {
      try {
        const markers = await apiGet<Array<{ id: number; nome: string }>>(`/contas-pagar/${params.idContaPagar}/marcadores`);
        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify(markers, null, 2) }], structuredContent: toStructuredContent({ items: markers }) };
        }
        const lines = [`# Marcadores da Conta a Pagar ${params.idContaPagar}`, "", markers.length > 0 ? markers.map(m => `- ${m.nome} (ID: ${m.id})`).join("\n") : "Nenhum"];
        return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: toStructuredContent({ items: markers }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_update_payable_markers",
    {
      title: "Atualizar Marcadores da Conta a Pagar",
      inputSchema: z.object({ idContaPagar: z.number().int().positive(), marcadores: z.array(z.object({ id: z.number().int().positive() })) }).strict(),
      description: `Atualiza os marcadores de uma conta a pagar.`,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { idContaPagar: number; marcadores: Array<{ id: number }> }) => {
      try {
        await apiPut(`/contas-pagar/${params.idContaPagar}/marcadores`, params.marcadores);
        return { content: [{ type: "text", text: formatSuccess(`Marcadores atualizados`) }], structuredContent: toStructuredContent({ id: params.idContaPagar, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_create_payable_markers",
    {
      title: "Criar Marcadores da Conta a Pagar",
      inputSchema: z.object({ idContaPagar: z.number().int().positive(), marcadores: z.array(z.object({ nome: z.string().min(1).max(100) })).min(1) }).strict(),
      description: `Adiciona marcadores a uma conta a pagar.`,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (params: { idContaPagar: number; marcadores: Array<{ nome: string }> }) => {
      try {
        await apiPost(`/contas-pagar/${params.idContaPagar}/marcadores`, params.marcadores);
        return { content: [{ type: "text", text: formatSuccess(`Marcadores adicionados`) }], structuredContent: toStructuredContent({ id: params.idContaPagar, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_delete_payable_markers",
    {
      title: "Excluir Marcadores da Conta a Pagar",
      inputSchema: z.object({ idContaPagar: z.number().int().positive() }).strict(),
      description: `Remove todos os marcadores de uma conta a pagar.`,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true }
    },
    async (params: { idContaPagar: number }) => {
      try {
        await apiDelete(`/contas-pagar/${params.idContaPagar}/marcadores`);
        return { content: [{ type: "text", text: formatSuccess(`Marcadores removidos`) }], structuredContent: toStructuredContent({ id: params.idContaPagar, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Account Markers (Receivable)
  server.registerTool(
    "tiny_get_receivable_markers",
    {
      title: "Obter Marcadores da Conta a Receber",
      inputSchema: z.object({ idContaReceber: z.number().int().positive(), response_format: ResponseFormatSchema }).strict(),
      description: `Obtém os marcadores de uma conta a receber.`,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { idContaReceber: number; response_format: ResponseFormat }) => {
      try {
        const markers = await apiGet<Array<{ id: number; nome: string }>>(`/contas-receber/${params.idContaReceber}/marcadores`);
        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify(markers, null, 2) }], structuredContent: toStructuredContent({ items: markers }) };
        }
        const lines = [`# Marcadores da Conta a Receber ${params.idContaReceber}`, "", markers.length > 0 ? markers.map(m => `- ${m.nome} (ID: ${m.id})`).join("\n") : "Nenhum"];
        return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: toStructuredContent({ items: markers }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_update_receivable_markers",
    {
      title: "Atualizar Marcadores da Conta a Receber",
      inputSchema: z.object({ idContaReceber: z.number().int().positive(), marcadores: z.array(z.object({ id: z.number().int().positive() })) }).strict(),
      description: `Atualiza os marcadores de uma conta a receber.`,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { idContaReceber: number; marcadores: Array<{ id: number }> }) => {
      try {
        await apiPut(`/contas-receber/${params.idContaReceber}/marcadores`, params.marcadores);
        return { content: [{ type: "text", text: formatSuccess(`Marcadores atualizados`) }], structuredContent: toStructuredContent({ id: params.idContaReceber, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_create_receivable_markers",
    {
      title: "Criar Marcadores da Conta a Receber",
      inputSchema: z.object({ idContaReceber: z.number().int().positive(), marcadores: z.array(z.object({ nome: z.string().min(1).max(100) })).min(1) }).strict(),
      description: `Adiciona marcadores a uma conta a receber.`,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (params: { idContaReceber: number; marcadores: Array<{ nome: string }> }) => {
      try {
        await apiPost(`/contas-receber/${params.idContaReceber}/marcadores`, params.marcadores);
        return { content: [{ type: "text", text: formatSuccess(`Marcadores adicionados`) }], structuredContent: toStructuredContent({ id: params.idContaReceber, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_delete_receivable_markers",
    {
      title: "Excluir Marcadores da Conta a Receber",
      inputSchema: z.object({ idContaReceber: z.number().int().positive() }).strict(),
      description: `Remove todos os marcadores de uma conta a receber.`,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true }
    },
    async (params: { idContaReceber: number }) => {
      try {
        await apiDelete(`/contas-receber/${params.idContaReceber}/marcadores`);
        return { content: [{ type: "text", text: formatSuccess(`Marcadores removidos`) }], structuredContent: toStructuredContent({ id: params.idContaReceber, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // List Income/Expense Categories
  server.registerTool(
    "tiny_list_income_expense_categories",
    {
      title: "Listar Categorias de Receita e Despesa",
      description: `Lista as categorias de receita e despesa do financeiro.`,
      inputSchema: ListIncomeExpenseCategoriesInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof ListIncomeExpenseCategoriesInputSchema>) => {
      try {
        const queryParams: Record<string, unknown> = { limit: params.limit, offset: params.offset, orderBy: params.orderBy };
        if (params.descricao) queryParams.descricao = params.descricao;
        if (params.grupo) queryParams.grupo = params.grupo;

        const response = await apiGet<{ itens: IncomeExpenseCategory[]; paginacao: { total: number } }>("/categorias-receita-despesa", queryParams);
        const items = response.itens || [];
        const total = response.paginacao?.total || items.length;

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify({ items, total, offset: params.offset }, null, 2) }], structuredContent: toStructuredContent({ items, total, offset: params.offset }) };
        }

        const lines = ["# Categorias de Receita e Despesa", "", `**Total:** ${total}`, "", ...items.map(categoryToMarkdown)];
        return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: toStructuredContent({ items, total, offset: params.offset }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
