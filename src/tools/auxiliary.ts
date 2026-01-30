/**
 * Auxiliary Tools for Tiny ERP MCP Server
 * Categories, Shipping/Payment/Receipt Methods, Brands, Price Lists, Tags,
 * Intermediaries, Services, Users, Salespeople, Company Info
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ResponseFormat } from "../constants.js";
import { apiGet, apiPost, apiPut, handleApiError } from "../services/api-client.js";
import { formatCurrency, formatSuccess, toStructuredContent } from "../services/formatters.js";
import { ResponseFormatSchema, PaginationSchema, OrderBySchema } from "../schemas/common.js";
import type { Category, ShippingMethod, PaymentMethod, ReceiptMethod, Brand, PriceList, TagGroup, Intermediary, Service, User, Salesperson, CompanyInfo } from "../types.js";

// ============================================================================
// Tool Registration
// ============================================================================

export function registerAuxiliaryTools(server: McpServer): void {
  // Categories
  server.registerTool(
    "tiny_list_categories",
    {
      title: "Listar Árvore de Categorias",
      description: `Lista todas as categorias de produtos em formato de árvore.`,
      inputSchema: z.object({ response_format: ResponseFormatSchema }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { response_format: ResponseFormat }) => {
      try {
        const categories = await apiGet<Category[]>("/categorias/todas");
        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify(categories, null, 2) }], structuredContent: toStructuredContent({ items: categories }) };
        }

        const formatCategory = (cat: Category, level = 0): string => {
          const indent = "  ".repeat(level);
          let result = `${indent}- ${cat.nome} (ID: ${cat.id})\n`;
          if (cat.filhos) {
            for (const child of cat.filhos) {
              result += formatCategory(child, level + 1);
            }
          }
          return result;
        };

        const lines = ["# Categorias de Produtos", "", ...categories.map(c => formatCategory(c))];
        return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: toStructuredContent({ items: categories }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Shipping Methods
  server.registerTool(
    "tiny_list_shipping_methods",
    {
      title: "Listar Formas de Envio",
      description: `Lista as formas de envio disponíveis.`,
      inputSchema: z.object({ nome: z.string().max(100).optional(), ...PaginationSchema.shape, response_format: ResponseFormatSchema }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { nome?: string; limit: number; offset: number; response_format: ResponseFormat }) => {
      try {
        const queryParams: Record<string, unknown> = { limit: params.limit, offset: params.offset };
        if (params.nome) queryParams.nome = params.nome;

        const response = await apiGet<{ itens: ShippingMethod[]; paginacao: { total: number } }>("/formas-envio", queryParams);
        const items = response.itens || [];
        const total = response.paginacao?.total || items.length;

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify({ items, total }, null, 2) }], structuredContent: toStructuredContent({ items, total }) };
        }

        const lines = ["# Formas de Envio", "", `**Total:** ${total}`, "", ...items.map(s => `- ${s.nome} (ID: ${s.id})`)];
        return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: toStructuredContent({ items, total }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_get_shipping_method",
    {
      title: "Obter Forma de Envio",
      description: `Obtém detalhes de uma forma de envio.`,
      inputSchema: z.object({ idFormaEnvio: z.number().int().positive(), response_format: ResponseFormatSchema }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { idFormaEnvio: number; response_format: ResponseFormat }) => {
      try {
        const method = await apiGet<ShippingMethod>(`/formas-envio/${params.idFormaEnvio}`);
        return { content: [{ type: "text", text: JSON.stringify(method, null, 2) }], structuredContent: toStructuredContent(method) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Payment Methods
  server.registerTool(
    "tiny_list_payment_methods",
    {
      title: "Listar Formas de Pagamento",
      description: `Lista as formas de pagamento disponíveis.`,
      inputSchema: z.object({ ...PaginationSchema.shape, response_format: ResponseFormatSchema }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { limit: number; offset: number; response_format: ResponseFormat }) => {
      try {
        const response = await apiGet<{ itens: PaymentMethod[]; paginacao: { total: number } }>("/formas-pagamento", { limit: params.limit, offset: params.offset });
        const items = response.itens || [];
        const total = response.paginacao?.total || items.length;

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify({ items, total }, null, 2) }], structuredContent: toStructuredContent({ items, total }) };
        }

        const lines = ["# Formas de Pagamento", "", `**Total:** ${total}`, "", ...items.map(p => `- ${p.nome} (ID: ${p.id})${p.padrao ? " [Padrão]" : ""}`)];
        return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: toStructuredContent({ items, total }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_get_payment_method",
    {
      title: "Obter Forma de Pagamento",
      inputSchema: z.object({ idFormaPagamento: z.number().int().positive(), response_format: ResponseFormatSchema }).strict(),
      description: `Obtém detalhes de uma forma de pagamento.`,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { idFormaPagamento: number; response_format: ResponseFormat }) => {
      try {
        const method = await apiGet<PaymentMethod>(`/formas-pagamento/${params.idFormaPagamento}`);
        return { content: [{ type: "text", text: JSON.stringify(method, null, 2) }], structuredContent: toStructuredContent(method) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Receipt Methods
  server.registerTool(
    "tiny_list_receipt_methods",
    {
      title: "Listar Formas de Recebimento",
      description: `Lista as formas de recebimento disponíveis.`,
      inputSchema: z.object({ ...PaginationSchema.shape, response_format: ResponseFormatSchema }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { limit: number; offset: number; response_format: ResponseFormat }) => {
      try {
        const response = await apiGet<{ itens: ReceiptMethod[]; paginacao: { total: number } }>("/formas-recebimento", { limit: params.limit, offset: params.offset });
        const items = response.itens || [];
        const total = response.paginacao?.total || items.length;

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify({ items, total }, null, 2) }], structuredContent: toStructuredContent({ items, total }) };
        }

        const lines = ["# Formas de Recebimento", "", `**Total:** ${total}`, "", ...items.map(r => `- ${r.nome} (ID: ${r.id})${r.padrao ? " [Padrão]" : ""}`)];
        return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: toStructuredContent({ items, total }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_get_receipt_method",
    {
      title: "Obter Forma de Recebimento",
      inputSchema: z.object({ idFormaRecebimento: z.number().int().positive(), response_format: ResponseFormatSchema }).strict(),
      description: `Obtém detalhes de uma forma de recebimento.`,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { idFormaRecebimento: number; response_format: ResponseFormat }) => {
      try {
        const method = await apiGet<ReceiptMethod>(`/formas-recebimento/${params.idFormaRecebimento}`);
        return { content: [{ type: "text", text: JSON.stringify(method, null, 2) }], structuredContent: toStructuredContent(method) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Brands
  server.registerTool(
    "tiny_list_brands",
    {
      title: "Listar Marcas",
      description: `Lista as marcas de produtos.`,
      inputSchema: z.object({ nome: z.string().max(100).optional(), ...PaginationSchema.shape, response_format: ResponseFormatSchema }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { nome?: string; limit: number; offset: number; response_format: ResponseFormat }) => {
      try {
        const queryParams: Record<string, unknown> = { limit: params.limit, offset: params.offset };
        if (params.nome) queryParams.nome = params.nome;

        const response = await apiGet<{ itens: Brand[]; paginacao: { total: number } }>("/marcas", queryParams);
        const items = response.itens || [];
        const total = response.paginacao?.total || items.length;

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify({ items, total }, null, 2) }], structuredContent: toStructuredContent({ items, total }) };
        }

        const lines = ["# Marcas", "", `**Total:** ${total}`, "", ...items.map(b => `- ${b.nome} (ID: ${b.id})`)];
        return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: toStructuredContent({ items, total }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_create_brand",
    {
      title: "Criar Marca",
      description: `Cria uma nova marca de produto.`,
      inputSchema: z.object({ nome: z.string().min(1).max(100).describe("Nome da marca"), descricao: z.string().max(500).optional() }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (params: { nome: string; descricao?: string }) => {
      try {
        const result = await apiPost<{ id: number }>("/marcas", params);
        return { content: [{ type: "text", text: formatSuccess(`Marca criada com ID: ${result.id}`) }], structuredContent: toStructuredContent({ id: result.id, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_update_brand",
    {
      title: "Atualizar Marca",
      description: `Atualiza uma marca de produto.`,
      inputSchema: z.object({ idMarca: z.number().int().positive(), nome: z.string().max(100).optional(), descricao: z.string().max(500).optional() }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { idMarca: number; nome?: string; descricao?: string }) => {
      try {
        const { idMarca, ...data } = params;
        await apiPut(`/marcas/${idMarca}`, data);
        return { content: [{ type: "text", text: formatSuccess(`Marca ${idMarca} atualizada`) }], structuredContent: toStructuredContent({ id: idMarca, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Price Lists
  server.registerTool(
    "tiny_list_price_lists",
    {
      title: "Listar Listas de Preços",
      description: `Lista as listas de preços disponíveis.`,
      inputSchema: z.object({ ...PaginationSchema.shape, response_format: ResponseFormatSchema }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { limit: number; offset: number; response_format: ResponseFormat }) => {
      try {
        const response = await apiGet<{ itens: PriceList[]; paginacao: { total: number } }>("/listas-precos", { limit: params.limit, offset: params.offset });
        const items = response.itens || [];
        const total = response.paginacao?.total || items.length;

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify({ items, total }, null, 2) }], structuredContent: toStructuredContent({ items, total }) };
        }

        const lines = ["# Listas de Preços", "", `**Total:** ${total}`, "", ...items.map(l => `- ${l.nome} (ID: ${l.id})`)];
        return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: toStructuredContent({ items, total }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_get_price_list",
    {
      title: "Obter Lista de Preços",
      inputSchema: z.object({ idListaPrecos: z.number().int().positive(), response_format: ResponseFormatSchema }).strict(),
      description: `Obtém detalhes de uma lista de preços.`,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { idListaPrecos: number; response_format: ResponseFormat }) => {
      try {
        const list = await apiGet<PriceList>(`/listas-precos/${params.idListaPrecos}`);
        return { content: [{ type: "text", text: JSON.stringify(list, null, 2) }], structuredContent: toStructuredContent(list) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Tag Groups
  server.registerTool(
    "tiny_list_tag_groups",
    {
      title: "Listar Grupos de Tags",
      description: `Lista os grupos de tags disponíveis.`,
      inputSchema: z.object({ ...PaginationSchema.shape, response_format: ResponseFormatSchema }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { limit: number; offset: number; response_format: ResponseFormat }) => {
      try {
        const response = await apiGet<{ itens: TagGroup[]; paginacao: { total: number } }>("/grupos-tags", { limit: params.limit, offset: params.offset });
        const items = response.itens || [];
        const total = response.paginacao?.total || items.length;

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify({ items, total }, null, 2) }], structuredContent: toStructuredContent({ items, total }) };
        }

        const lines = ["# Grupos de Tags", "", `**Total:** ${total}`, ""];
        for (const group of items) {
          lines.push(`## ${group.nome} (ID: ${group.id})`);
          if (group.tags && group.tags.length > 0) {
            for (const tag of group.tags) {
              lines.push(`  - ${tag.nome} (ID: ${tag.id})`);
            }
          }
          lines.push("");
        }
        return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: toStructuredContent({ items, total }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Product Tags
  server.registerTool(
    "tiny_list_product_tags_global",
    {
      title: "Listar Tags de Produtos",
      description: `Lista todas as tags de produtos disponíveis.`,
      inputSchema: z.object({ ...PaginationSchema.shape, response_format: ResponseFormatSchema }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { limit: number; offset: number; response_format: ResponseFormat }) => {
      try {
        const response = await apiGet<{ itens: Array<{ id: number; nome: string }>; paginacao: { total: number } }>("/tags-produtos", { limit: params.limit, offset: params.offset });
        const items = response.itens || [];
        const total = response.paginacao?.total || items.length;

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify({ items, total }, null, 2) }], structuredContent: toStructuredContent({ items, total }) };
        }

        const lines = ["# Tags de Produtos", "", `**Total:** ${total}`, "", ...items.map(t => `- ${t.nome} (ID: ${t.id})`)];
        return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: toStructuredContent({ items, total }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_create_product_tags_global",
    {
      title: "Criar Tags de Produtos",
      description: `Cria novas tags de produtos.`,
      inputSchema: z.object({ tags: z.array(z.object({ nome: z.string().min(1).max(100) })).min(1) }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (params: { tags: Array<{ nome: string }> }) => {
      try {
        await apiPost("/tags-produtos", params.tags);
        return { content: [{ type: "text", text: formatSuccess(`Tags criadas`) }], structuredContent: toStructuredContent({ success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Intermediaries (Marketplaces)
  server.registerTool(
    "tiny_list_intermediaries",
    {
      title: "Listar Intermediadores",
      description: `Lista os intermediadores/marketplaces cadastrados.`,
      inputSchema: z.object({ ...PaginationSchema.shape, response_format: ResponseFormatSchema }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { limit: number; offset: number; response_format: ResponseFormat }) => {
      try {
        const response = await apiGet<{ itens: Intermediary[]; paginacao: { total: number } }>("/intermediadores", { limit: params.limit, offset: params.offset });
        const items = response.itens || [];
        const total = response.paginacao?.total || items.length;

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify({ items, total }, null, 2) }], structuredContent: toStructuredContent({ items, total }) };
        }

        const lines = ["# Intermediadores", "", `**Total:** ${total}`, "", ...items.map(i => `- ${i.nome} (ID: ${i.id})`)];
        return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: toStructuredContent({ items, total }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_get_intermediary",
    {
      title: "Obter Intermediador",
      inputSchema: z.object({ idIntermediador: z.number().int().positive(), response_format: ResponseFormatSchema }).strict(),
      description: `Obtém detalhes de um intermediador.`,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { idIntermediador: number; response_format: ResponseFormat }) => {
      try {
        const inter = await apiGet<Intermediary>(`/intermediadores/${params.idIntermediador}`);
        return { content: [{ type: "text", text: JSON.stringify(inter, null, 2) }], structuredContent: toStructuredContent(inter) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Services
  server.registerTool(
    "tiny_list_services",
    {
      title: "Listar Serviços",
      description: `Lista os serviços cadastrados.`,
      inputSchema: z.object({ nome: z.string().max(200).optional(), situacao: z.enum(["ativo", "inativo"]).optional(), ...PaginationSchema.shape, response_format: ResponseFormatSchema }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { nome?: string; situacao?: string; limit: number; offset: number; response_format: ResponseFormat }) => {
      try {
        const queryParams: Record<string, unknown> = { limit: params.limit, offset: params.offset };
        if (params.nome) queryParams.nome = params.nome;
        if (params.situacao) queryParams.situacao = params.situacao;

        const response = await apiGet<{ itens: Service[]; paginacao: { total: number } }>("/servicos", queryParams);
        const items = response.itens || [];
        const total = response.paginacao?.total || items.length;

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify({ items, total }, null, 2) }], structuredContent: toStructuredContent({ items, total }) };
        }

        const lines = ["# Serviços", "", `**Total:** ${total}`, "", ...items.map(s => `- ${s.nome} (ID: ${s.id}) - ${formatCurrency(s.preco)}`)];
        return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: toStructuredContent({ items, total }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_get_service",
    {
      title: "Obter Serviço",
      inputSchema: z.object({ idServico: z.number().int().positive(), response_format: ResponseFormatSchema }).strict(),
      description: `Obtém detalhes de um serviço.`,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { idServico: number; response_format: ResponseFormat }) => {
      try {
        const service = await apiGet<Service>(`/servicos/${params.idServico}`);
        return { content: [{ type: "text", text: JSON.stringify(service, null, 2) }], structuredContent: toStructuredContent(service) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_create_service",
    {
      title: "Criar Serviço",
      description: `Cria um novo serviço.`,
      inputSchema: z.object({ nome: z.string().min(1).max(200), preco: z.number().min(0), codigo: z.string().max(50).optional(), descricao: z.string().max(2000).optional() }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (params: { nome: string; preco: number; codigo?: string; descricao?: string }) => {
      try {
        const result = await apiPost<{ id: number }>("/servicos", params);
        return { content: [{ type: "text", text: formatSuccess(`Serviço criado com ID: ${result.id}`) }], structuredContent: toStructuredContent({ id: result.id, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_update_service",
    {
      title: "Atualizar Serviço",
      description: `Atualiza um serviço.`,
      inputSchema: z.object({ idServico: z.number().int().positive(), nome: z.string().max(200).optional(), preco: z.number().min(0).optional(), descricao: z.string().max(2000).optional() }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { idServico: number; nome?: string; preco?: number; descricao?: string }) => {
      try {
        const { idServico, ...data } = params;
        await apiPut(`/servicos/${idServico}`, data);
        return { content: [{ type: "text", text: formatSuccess(`Serviço ${idServico} atualizado`) }], structuredContent: toStructuredContent({ id: idServico, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_convert_service_to_product",
    {
      title: "Transformar Serviço em Produto",
      description: `Converte um serviço em produto.`,
      inputSchema: z.object({ idServico: z.number().int().positive() }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (params: { idServico: number }) => {
      try {
        const result = await apiPost<{ idProduto: number }>(`/servicos/${params.idServico}/transformar-produto`);
        return { content: [{ type: "text", text: formatSuccess(`Serviço convertido em produto com ID: ${result.idProduto}`) }], structuredContent: toStructuredContent({ idServico: params.idServico, idProduto: result.idProduto, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Users
  server.registerTool(
    "tiny_list_users",
    {
      title: "Listar Usuários",
      description: `Lista os usuários do sistema.`,
      inputSchema: z.object({ ...PaginationSchema.shape, response_format: ResponseFormatSchema }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { limit: number; offset: number; response_format: ResponseFormat }) => {
      try {
        const response = await apiGet<{ itens: User[]; paginacao: { total: number } }>("/usuarios", { limit: params.limit, offset: params.offset });
        const items = response.itens || [];
        const total = response.paginacao?.total || items.length;

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify({ items, total }, null, 2) }], structuredContent: toStructuredContent({ items, total }) };
        }

        const lines = ["# Usuários", "", `**Total:** ${total}`, "", ...items.map(u => `- ${u.nome} (ID: ${u.id}) - ${u.email}`)];
        return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: toStructuredContent({ items, total }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Salespeople
  server.registerTool(
    "tiny_list_salespeople",
    {
      title: "Listar Vendedores",
      description: `Lista os vendedores cadastrados.`,
      inputSchema: z.object({ ...PaginationSchema.shape, response_format: ResponseFormatSchema }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { limit: number; offset: number; response_format: ResponseFormat }) => {
      try {
        const response = await apiGet<{ itens: Salesperson[]; paginacao: { total: number } }>("/vendedores", { limit: params.limit, offset: params.offset });
        const items = response.itens || [];
        const total = response.paginacao?.total || items.length;

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify({ items, total }, null, 2) }], structuredContent: toStructuredContent({ items, total }) };
        }

        const lines = ["# Vendedores", "", `**Total:** ${total}`, "", ...items.map(s => `- ${s.nome} (ID: ${s.id})${s.comissao ? ` - Comissão: ${s.comissao}%` : ""}`)];
        return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: toStructuredContent({ items, total }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Company Info
  server.registerTool(
    "tiny_get_company_info",
    {
      title: "Obter Informações da Empresa",
      description: `Obtém informações da conta/empresa.`,
      inputSchema: z.object({ response_format: ResponseFormatSchema }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: { response_format: ResponseFormat }) => {
      try {
        const info = await apiGet<CompanyInfo>("/empresa/info");

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }], structuredContent: toStructuredContent(info) };
        }

        const lines = [
          "# Informações da Empresa",
          "",
          `- **Nome:** ${info.nome}`,
          `- **Fantasia:** ${info.fantasia || "-"}`,
          `- **CNPJ:** ${info.cnpj || "-"}`,
          `- **IE:** ${info.ie || "-"}`,
          `- **IM:** ${info.im || "-"}`,
          `- **Telefone:** ${info.telefone || "-"}`,
          `- **E-mail:** ${info.email || "-"}`
        ];

        return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: toStructuredContent(info) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
