/**
 * Order Tools for Tiny ERP MCP Server
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
  formatAddress,
  toStructuredContent
} from "../services/formatters.js";
import { ResponseFormatSchema, PaginationSchema, OrderBySchema, AddressSchema, OrderItemSchema } from "../schemas/common.js";
import type { Order } from "../types.js";

// ============================================================================
// Schemas
// ============================================================================

const ListOrdersInputSchema = z.object({
  numero: z.string().max(50).optional().describe("Filtrar por número do pedido"),
  numeroEcommerce: z.string().max(100).optional().describe("Filtrar por número do e-commerce"),
  nomeCliente: z.string().max(200).optional().describe("Filtrar por nome do cliente"),
  situacao: z.enum(["aberto", "aprovado", "preparando", "faturado", "pronto", "enviado", "entregue", "cancelado"])
    .optional().describe("Filtrar por situação"),
  dataInicialEmissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data inicial de emissão (YYYY-MM-DD)"),
  dataFinalEmissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data final de emissão (YYYY-MM-DD)"),
  idVendedor: z.number().int().positive().optional().describe("Filtrar por ID do vendedor"),
  idFormaEnvio: z.number().int().positive().optional().describe("Filtrar por forma de envio"),
  idFormaPagamento: z.number().int().positive().optional().describe("Filtrar por forma de pagamento"),
  orderBy: OrderBySchema,
  ...PaginationSchema.shape,
  response_format: ResponseFormatSchema
}).strict();

const GetOrderInputSchema = z.object({
  idPedido: z.number().int().positive().describe("ID do pedido"),
  response_format: ResponseFormatSchema
}).strict();

const CreateOrderInputSchema = z.object({
  cliente: z.object({
    id: z.number().int().positive().optional().describe("ID do cliente existente"),
    nome: z.string().min(1).max(200).describe("Nome do cliente"),
    tipoPessoa: z.enum(["F", "J"]).optional().describe("Tipo: F=Física, J=Jurídica"),
    cpfCnpj: z.string().max(18).optional().describe("CPF ou CNPJ"),
    email: z.string().email().max(100).optional().describe("E-mail"),
    telefone: z.string().max(20).optional().describe("Telefone"),
    endereco: AddressSchema.optional().describe("Endereço de entrega")
  }).describe("Dados do cliente"),
  itens: z.array(OrderItemSchema).min(1).describe("Itens do pedido"),
  dataEmissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data de emissão (YYYY-MM-DD)"),
  dataPrevista: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data prevista de entrega"),
  valorFrete: z.number().min(0).optional().describe("Valor do frete"),
  valorDesconto: z.number().min(0).optional().describe("Valor do desconto"),
  observacao: z.string().max(2000).optional().describe("Observações do pedido"),
  observacaoInterna: z.string().max(2000).optional().describe("Observações internas"),
  idFormaPagamento: z.number().int().positive().optional().describe("ID da forma de pagamento"),
  idFormaEnvio: z.number().int().positive().optional().describe("ID da forma de envio"),
  idVendedor: z.number().int().positive().optional().describe("ID do vendedor"),
  numeroEcommerce: z.string().max(100).optional().describe("Número do pedido no e-commerce")
}).strict();

const UpdateOrderInputSchema = z.object({
  idPedido: z.number().int().positive().describe("ID do pedido"),
  cliente: z.object({
    nome: z.string().max(200).optional(),
    email: z.string().email().max(100).optional(),
    telefone: z.string().max(20).optional(),
    endereco: AddressSchema.optional()
  }).optional().describe("Dados do cliente a atualizar"),
  dataPrevista: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Nova data prevista"),
  valorFrete: z.number().min(0).optional().describe("Novo valor do frete"),
  valorDesconto: z.number().min(0).optional().describe("Novo valor do desconto"),
  observacao: z.string().max(2000).optional().describe("Novas observações"),
  observacaoInterna: z.string().max(2000).optional().describe("Novas observações internas")
}).strict();

const UpdateOrderStatusInputSchema = z.object({
  idPedido: z.number().int().positive().describe("ID do pedido"),
  situacao: z.enum(["aberto", "aprovado", "preparando", "faturado", "pronto", "enviado", "entregue", "cancelado"])
    .describe("Nova situação do pedido")
}).strict();

const UpdateOrderTrackingInputSchema = z.object({
  idPedido: z.number().int().positive().describe("ID do pedido"),
  codigoRastreamento: z.string().max(100).optional().describe("Código de rastreamento"),
  urlRastreamento: z.string().url().max(500).optional().describe("URL de rastreamento")
}).strict();

const GenerateOrderInvoiceInputSchema = z.object({
  idPedido: z.number().int().positive().describe("ID do pedido"),
  naturezaOperacao: z.string().max(100).optional().describe("Natureza da operação fiscal")
}).strict();

const GenerateProductionOrderInputSchema = z.object({
  idPedido: z.number().int().positive().describe("ID do pedido")
}).strict();

const OrderAccountsInputSchema = z.object({
  idPedido: z.number().int().positive().describe("ID do pedido")
}).strict();

const OrderMarkersInputSchema = z.object({
  idPedido: z.number().int().positive().describe("ID do pedido"),
  response_format: ResponseFormatSchema
}).strict();

const UpdateOrderMarkersInputSchema = z.object({
  idPedido: z.number().int().positive().describe("ID do pedido"),
  marcadores: z.array(z.object({
    id: z.number().int().positive().describe("ID do marcador"),
    nome: z.string().optional()
  })).describe("Lista de marcadores")
}).strict();

const CreateOrderMarkersInputSchema = z.object({
  idPedido: z.number().int().positive().describe("ID do pedido"),
  marcadores: z.array(z.object({
    nome: z.string().min(1).max(100).describe("Nome do marcador")
  })).min(1).describe("Lista de marcadores a criar")
}).strict();

// ============================================================================
// Formatters
// ============================================================================

function orderToMarkdown(o: Order): string {
  const lines = [
    `## Pedido #${o.numero || o.id}`,
    "",
    `- **ID:** ${o.id}`,
    `- **Data Emissão:** ${formatDate(o.dataEmissao)}`,
    `- **Situação:** ${o.situacao}`,
    `- **Cliente:** ${o.cliente?.nome || "-"}`,
    `- **Valor Total:** ${formatCurrency(o.valorTotal)}`,
    `- **Frete:** ${formatCurrency(o.valorFrete)}`,
    `- **Desconto:** ${formatCurrency(o.valorDesconto)}`,
    ""
  ];

  if (o.itens && o.itens.length > 0) {
    lines.push("**Itens:**");
    for (const item of o.itens) {
      lines.push(`  - ${item.descricao} (${item.quantidade}x ${formatCurrency(item.valorUnitario)})`);
    }
    lines.push("");
  }

  if (o.codigoRastreamento) {
    lines.push(`- **Rastreamento:** ${o.codigoRastreamento}`);
  }

  lines.push("");
  return lines.join("\n");
}

function orderToJson(o: Order): Record<string, unknown> {
  return {
    id: o.id,
    numero: o.numero,
    numeroEcommerce: o.numeroEcommerce,
    dataEmissao: o.dataEmissao,
    dataPrevista: o.dataPrevista,
    situacao: o.situacao,
    cliente: o.cliente,
    itens: o.itens,
    valorTotal: o.valorTotal,
    valorFrete: o.valorFrete,
    valorDesconto: o.valorDesconto,
    codigoRastreamento: o.codigoRastreamento
  };
}

// ============================================================================
// Tool Registration
// ============================================================================

export function registerOrderTools(server: McpServer): void {
  // List Orders
  server.registerTool(
    "tiny_list_orders",
    {
      title: "Listar Pedidos",
      description: `Lista pedidos do Tiny ERP com filtros e paginação.

Filtros disponíveis:
- numero: Número do pedido
- numeroEcommerce: Número do e-commerce
- nomeCliente: Nome do cliente
- situacao: aberto, aprovado, preparando, faturado, pronto, enviado, entregue, cancelado
- dataInicialEmissao/dataFinalEmissao: Período de emissão
- idVendedor, idFormaEnvio, idFormaPagamento`,
      inputSchema: ListOrdersInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof ListOrdersInputSchema>) => {
      try {
        const queryParams: Record<string, unknown> = {
          limit: params.limit,
          offset: params.offset,
          orderBy: params.orderBy
        };

        if (params.numero) queryParams.numero = params.numero;
        if (params.numeroEcommerce) queryParams.numeroEcommerce = params.numeroEcommerce;
        if (params.nomeCliente) queryParams.nomeCliente = params.nomeCliente;
        if (params.situacao) queryParams.situacao = params.situacao;
        if (params.dataInicialEmissao) queryParams.dataInicialEmissao = params.dataInicialEmissao;
        if (params.dataFinalEmissao) queryParams.dataFinalEmissao = params.dataFinalEmissao;
        if (params.idVendedor) queryParams.idVendedor = params.idVendedor;
        if (params.idFormaEnvio) queryParams.idFormaEnvio = params.idFormaEnvio;
        if (params.idFormaPagamento) queryParams.idFormaPagamento = params.idFormaPagamento;

        const response = await apiGet<{ itens: Order[]; paginacao: { total: number } }>("/pedidos", queryParams);
        const items = response.itens || [];
        const total = response.paginacao?.total || items.length;

        const { text, structured } = formatListResponse(
          "Pedidos",
          items,
          total,
          params.offset,
          params.response_format,
          orderToMarkdown
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

  // Get Order
  server.registerTool(
    "tiny_get_order",
    {
      title: "Obter Pedido",
      description: `Obtém detalhes completos de um pedido pelo ID.`,
      inputSchema: GetOrderInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof GetOrderInputSchema>) => {
      try {
        const order = await apiGet<Order>(`/pedidos/${params.idPedido}`);

        const { text, structured } = formatItemResponse(
          `Pedido #${order.numero || order.id}`,
          order,
          params.response_format,
          orderToMarkdown
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

  // Create Order
  server.registerTool(
    "tiny_create_order",
    {
      title: "Criar Pedido",
      description: `Cria um novo pedido no Tiny ERP.

Campos obrigatórios:
- cliente: Dados do cliente (nome obrigatório)
- itens: Lista de produtos/serviços

O pedido é criado com situação "aberto" por padrão.`,
      inputSchema: CreateOrderInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof CreateOrderInputSchema>) => {
      try {
        const result = await apiPost<{ id: number }>("/pedidos", params);
        return {
          content: [{ type: "text", text: formatSuccess(`Pedido criado com ID: ${result.id}`) }],
          structuredContent: toStructuredContent({ id: result.id, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Update Order
  server.registerTool(
    "tiny_update_order",
    {
      title: "Atualizar Pedido",
      description: `Atualiza dados de um pedido existente.

Campos que podem ser atualizados:
- Dados do cliente (nome, email, telefone, endereço)
- Data prevista
- Valores de frete e desconto
- Observações`,
      inputSchema: UpdateOrderInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof UpdateOrderInputSchema>) => {
      try {
        const { idPedido, ...data } = params;
        await apiPut(`/pedidos/${idPedido}`, data);
        return {
          content: [{ type: "text", text: formatSuccess(`Pedido ${idPedido} atualizado`) }],
          structuredContent: toStructuredContent({ id: idPedido, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Update Order Status
  server.registerTool(
    "tiny_update_order_status",
    {
      title: "Atualizar Situação do Pedido",
      description: `Altera a situação de um pedido.

Situações possíveis:
- aberto: Pedido aberto
- aprovado: Pedido aprovado
- preparando: Em preparação
- faturado: Faturado (NF emitida)
- pronto: Pronto para envio
- enviado: Enviado
- entregue: Entregue
- cancelado: Cancelado`,
      inputSchema: UpdateOrderStatusInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof UpdateOrderStatusInputSchema>) => {
      try {
        await apiPut(`/pedidos/${params.idPedido}/situacao`, { situacao: params.situacao });
        return {
          content: [{ type: "text", text: formatSuccess(`Situação do pedido ${params.idPedido} alterada para: ${params.situacao}`) }],
          structuredContent: toStructuredContent({ id: params.idPedido, situacao: params.situacao, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Update Order Tracking
  server.registerTool(
    "tiny_update_order_tracking",
    {
      title: "Atualizar Rastreamento do Pedido",
      description: `Atualiza informações de rastreamento de um pedido.`,
      inputSchema: UpdateOrderTrackingInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof UpdateOrderTrackingInputSchema>) => {
      try {
        const { idPedido, ...data } = params;
        await apiPut(`/pedidos/${idPedido}/rastreamento`, data);
        return {
          content: [{ type: "text", text: formatSuccess(`Rastreamento do pedido ${idPedido} atualizado`) }],
          structuredContent: toStructuredContent({ id: idPedido, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Generate Order Invoice
  server.registerTool(
    "tiny_generate_order_invoice",
    {
      title: "Gerar Nota Fiscal do Pedido",
      description: `Gera uma nota fiscal a partir de um pedido.

O pedido precisa estar aprovado para gerar a NF.`,
      inputSchema: GenerateOrderInvoiceInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof GenerateOrderInvoiceInputSchema>) => {
      try {
        const result = await apiPost<{ idNotaFiscal: number }>(`/pedidos/${params.idPedido}/gerar-nota-fiscal`, {
          naturezaOperacao: params.naturezaOperacao
        });
        return {
          content: [{ type: "text", text: formatSuccess(`Nota fiscal gerada com ID: ${result.idNotaFiscal}`) }],
          structuredContent: toStructuredContent({ idPedido: params.idPedido, idNotaFiscal: result.idNotaFiscal, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Generate Production Order
  server.registerTool(
    "tiny_generate_production_order",
    {
      title: "Gerar Ordem de Produção do Pedido",
      description: `Gera uma ordem de produção a partir de um pedido.

Usado quando o pedido contém produtos fabricados.`,
      inputSchema: GenerateProductionOrderInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof GenerateProductionOrderInputSchema>) => {
      try {
        const result = await apiPost<{ idOrdemProducao: number }>(`/pedidos/${params.idPedido}/gerar-ordem-producao`);
        return {
          content: [{ type: "text", text: formatSuccess(`Ordem de produção gerada com ID: ${result.idOrdemProducao}`) }],
          structuredContent: toStructuredContent({ idPedido: params.idPedido, idOrdemProducao: result.idOrdemProducao, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Post Order Accounts
  server.registerTool(
    "tiny_post_order_accounts",
    {
      title: "Lançar Contas do Pedido",
      description: `Lança as contas a receber do pedido no financeiro.`,
      inputSchema: OrderAccountsInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof OrderAccountsInputSchema>) => {
      try {
        await apiPost(`/pedidos/${params.idPedido}/lancar-contas`);
        return {
          content: [{ type: "text", text: formatSuccess(`Contas do pedido ${params.idPedido} lançadas`) }],
          structuredContent: toStructuredContent({ id: params.idPedido, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Reverse Order Accounts
  server.registerTool(
    "tiny_reverse_order_accounts",
    {
      title: "Estornar Contas do Pedido",
      description: `Estorna as contas lançadas do pedido.`,
      inputSchema: OrderAccountsInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof OrderAccountsInputSchema>) => {
      try {
        await apiPost(`/pedidos/${params.idPedido}/estornar-contas`);
        return {
          content: [{ type: "text", text: formatSuccess(`Contas do pedido ${params.idPedido} estornadas`) }],
          structuredContent: toStructuredContent({ id: params.idPedido, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Post Order Stock
  server.registerTool(
    "tiny_post_order_stock",
    {
      title: "Lançar Estoque do Pedido",
      description: `Dá baixa no estoque dos produtos do pedido.`,
      inputSchema: OrderAccountsInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof OrderAccountsInputSchema>) => {
      try {
        await apiPost(`/pedidos/${params.idPedido}/lancar-estoque`);
        return {
          content: [{ type: "text", text: formatSuccess(`Estoque do pedido ${params.idPedido} lançado`) }],
          structuredContent: toStructuredContent({ id: params.idPedido, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Reverse Order Stock
  server.registerTool(
    "tiny_reverse_order_stock",
    {
      title: "Estornar Estoque do Pedido",
      description: `Estorna o estoque lançado do pedido.`,
      inputSchema: OrderAccountsInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof OrderAccountsInputSchema>) => {
      try {
        await apiPost(`/pedidos/${params.idPedido}/estornar-estoque`);
        return {
          content: [{ type: "text", text: formatSuccess(`Estoque do pedido ${params.idPedido} estornado`) }],
          structuredContent: toStructuredContent({ id: params.idPedido, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Get Order Markers
  server.registerTool(
    "tiny_get_order_markers",
    {
      title: "Obter Marcadores do Pedido",
      description: `Obtém os marcadores associados a um pedido.`,
      inputSchema: OrderMarkersInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof OrderMarkersInputSchema>) => {
      try {
        const markers = await apiGet<Array<{ id: number; nome: string; cor?: string }>>(`/pedidos/${params.idPedido}/marcadores`);

        if (params.response_format === ResponseFormat.JSON) {
          return {
            content: [{ type: "text", text: JSON.stringify(markers, null, 2) }],
            structuredContent: toStructuredContent({ items: markers })
          };
        }

        const lines = [
          `# Marcadores do Pedido (ID: ${params.idPedido})`,
          "",
          markers.length > 0
            ? markers.map(m => `- ${m.nome} (ID: ${m.id})`).join("\n")
            : "Nenhum marcador encontrado"
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

  // Update Order Markers
  server.registerTool(
    "tiny_update_order_markers",
    {
      title: "Atualizar Marcadores do Pedido",
      description: `Atualiza os marcadores de um pedido.`,
      inputSchema: UpdateOrderMarkersInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof UpdateOrderMarkersInputSchema>) => {
      try {
        await apiPut(`/pedidos/${params.idPedido}/marcadores`, params.marcadores);
        return {
          content: [{ type: "text", text: formatSuccess(`Marcadores do pedido ${params.idPedido} atualizados`) }],
          structuredContent: toStructuredContent({ id: params.idPedido, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Create Order Markers
  server.registerTool(
    "tiny_create_order_markers",
    {
      title: "Criar Marcadores do Pedido",
      description: `Adiciona novos marcadores a um pedido.`,
      inputSchema: CreateOrderMarkersInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof CreateOrderMarkersInputSchema>) => {
      try {
        await apiPost(`/pedidos/${params.idPedido}/marcadores`, params.marcadores);
        return {
          content: [{ type: "text", text: formatSuccess(`Marcadores adicionados ao pedido ${params.idPedido}`) }],
          structuredContent: toStructuredContent({ id: params.idPedido, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Delete Order Markers
  server.registerTool(
    "tiny_delete_order_markers",
    {
      title: "Excluir Marcadores do Pedido",
      description: `Remove todos os marcadores de um pedido.`,
      inputSchema: z.object({
        idPedido: z.number().int().positive().describe("ID do pedido")
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: { idPedido: number }) => {
      try {
        await apiDelete(`/pedidos/${params.idPedido}/marcadores`);
        return {
          content: [{ type: "text", text: formatSuccess(`Marcadores do pedido ${params.idPedido} removidos`) }],
          structuredContent: toStructuredContent({ id: params.idPedido, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
