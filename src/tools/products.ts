/**
 * Product and Stock Tools for Tiny ERP MCP Server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ResponseFormat } from "../constants.js";
import { apiGet, apiPost, apiPut, apiDelete, handleApiError } from "../services/api-client.js";
import {
  formatListResponse,
  formatItemResponse,
  formatCurrency,
  formatNumber,
  formatSuccess,
  toStructuredContent
} from "../services/formatters.js";
import { ResponseFormatSchema, PaginationSchema, OrderBySchema } from "../schemas/common.js";
import type { Product, Stock } from "../types.js";

// ============================================================================
// Schemas
// ============================================================================

const ListProductsInputSchema = z.object({
  sku: z.string().max(50).optional().describe("Filtrar por SKU (código do produto) - USE ESTE para buscar produtos por código"),
  nome: z.string().max(200).optional().describe("Filtrar por nome do produto"),
  gtin: z.string().max(20).optional().describe("Filtrar por código de barras EAN/GTIN (apenas se explicitamente solicitado)"),
  situacao: z.enum(["ativo", "inativo"]).optional().describe("Filtrar por situação: ativo ou inativo"),
  tipo: z.enum(["produto", "servico", "kit"]).optional().describe("Filtrar por tipo: produto, servico ou kit"),
  idCategoria: z.number().int().positive().optional().describe("Filtrar por ID da categoria"),
  idMarca: z.number().int().positive().optional().describe("Filtrar por ID da marca"),
  orderBy: OrderBySchema,
  ...PaginationSchema.shape,
  response_format: ResponseFormatSchema
}).strict();

const GetProductInputSchema = z.object({
  idProduto: z.number().int().positive().describe("ID do produto"),
  response_format: ResponseFormatSchema
}).strict();

const CreateProductInputSchema = z.object({
  nome: z.string().min(1).max(200).describe("Nome do produto"),
  sku: z.string().max(50).optional().describe("SKU do produto"),
  preco: z.number().min(0).describe("Preço de venda"),
  precoCusto: z.number().min(0).optional().describe("Preço de custo"),
  unidade: z.string().max(10).optional().describe("Unidade (ex: UN, KG, CX)"),
  gtin: z.string().max(20).optional().describe("Código de barras (GTIN/EAN)"),
  ncm: z.string().max(10).optional().describe("Código NCM"),
  origem: z.number().int().min(0).max(8).optional().describe("Origem do produto (0-8)"),
  tipo: z.enum(["produto", "servico", "kit"]).optional().describe("Tipo: produto, servico ou kit"),
  descricao: z.string().max(5000).optional().describe("Descrição completa"),
  descricaoCurta: z.string().max(500).optional().describe("Descrição curta"),
  pesoLiquido: z.number().min(0).optional().describe("Peso líquido em kg"),
  pesoBruto: z.number().min(0).optional().describe("Peso bruto em kg"),
  largura: z.number().min(0).optional().describe("Largura em cm"),
  altura: z.number().min(0).optional().describe("Altura em cm"),
  profundidade: z.number().min(0).optional().describe("Profundidade em cm"),
  estoqueMinimo: z.number().min(0).optional().describe("Estoque mínimo"),
  estoqueMaximo: z.number().min(0).optional().describe("Estoque máximo"),
  localizacao: z.string().max(100).optional().describe("Localização no estoque"),
  idCategoria: z.number().int().positive().optional().describe("ID da categoria"),
  idMarca: z.number().int().positive().optional().describe("ID da marca")
}).strict();

const UpdateProductInputSchema = z.object({
  idProduto: z.number().int().positive().describe("ID do produto"),
  nome: z.string().min(1).max(200).optional().describe("Nome do produto"),
  sku: z.string().max(50).optional().describe("SKU do produto"),
  preco: z.number().min(0).optional().describe("Preço de venda"),
  precoCusto: z.number().min(0).optional().describe("Preço de custo"),
  unidade: z.string().max(10).optional().describe("Unidade"),
  gtin: z.string().max(20).optional().describe("Código de barras"),
  ncm: z.string().max(10).optional().describe("Código NCM"),
  descricao: z.string().max(5000).optional().describe("Descrição completa"),
  descricaoCurta: z.string().max(500).optional().describe("Descrição curta"),
  situacao: z.enum(["ativo", "inativo"]).optional().describe("Situação do produto"),
  localizacao: z.string().max(100).optional().describe("Localização no estoque")
}).strict();

const UpdateProductPriceInputSchema = z.object({
  idProduto: z.number().int().positive().describe("ID do produto"),
  preco: z.number().min(0).describe("Novo preço de venda"),
  precoCusto: z.number().min(0).optional().describe("Novo preço de custo")
}).strict();

const GetStockInputSchema = z.object({
  idProduto: z.number().int().positive().describe("ID do produto"),
  response_format: ResponseFormatSchema
}).strict();

// Depósito padrão: CWB
const DEPOSITO_PADRAO_ID = 653728712;

const UpdateStockInputSchema = z.object({
  idProduto: z.number().int().positive().describe("ID do produto"),
  tipo: z.enum(["E", "S", "B"]).describe("Tipo de movimento: E (Entrada), S (Saída), B (Balanço)"),
  quantidade: z.number().positive().describe("Quantidade do movimento (sempre positivo)"),
  precoUnitario: z.number().min(0).optional().describe("Preço unitário do movimento"),
  idDeposito: z.number().int().positive().optional().describe("ID do depósito (padrão: CWB)"),
  observacoes: z.string().max(500).optional().describe("Observação do movimento")
}).strict();

const GetProductKitInputSchema = z.object({
  idProduto: z.number().int().positive().describe("ID do produto kit"),
  response_format: ResponseFormatSchema
}).strict();

const UpdateProductKitInputSchema = z.object({
  idProduto: z.number().int().positive().describe("ID do produto kit"),
  itens: z.array(z.object({
    idProduto: z.number().int().positive().describe("ID do produto componente"),
    quantidade: z.number().positive().describe("Quantidade do componente")
  })).min(1).describe("Lista de componentes do kit")
}).strict();

const GetManufacturedProductInputSchema = z.object({
  idProduto: z.number().int().positive().describe("ID do produto fabricado"),
  response_format: ResponseFormatSchema
}).strict();

const UpdateManufacturedProductInputSchema = z.object({
  idProduto: z.number().int().positive().describe("ID do produto fabricado"),
  itens: z.array(z.object({
    idProduto: z.number().int().positive().describe("ID do insumo"),
    quantidade: z.number().positive().describe("Quantidade do insumo")
  })).min(1).describe("Lista de insumos para fabricação")
}).strict();

const CreateVariationInputSchema = z.object({
  idProduto: z.number().int().positive().describe("ID do produto pai"),
  sku: z.string().max(50).optional().describe("SKU da variação"),
  gtin: z.string().max(20).optional().describe("Código de barras da variação"),
  preco: z.number().min(0).optional().describe("Preço da variação (se diferente do pai)"),
  grade: z.record(z.string()).describe("Atributos da variação (ex: {cor: 'Azul', tamanho: 'M'})")
}).strict();

const UpdateVariationInputSchema = z.object({
  idProduto: z.number().int().positive().describe("ID do produto pai"),
  idVariacao: z.number().int().positive().describe("ID da variação"),
  sku: z.string().max(50).optional().describe("SKU da variação"),
  gtin: z.string().max(20).optional().describe("Código de barras"),
  preco: z.number().min(0).optional().describe("Preço da variação")
}).strict();

const DeleteVariationInputSchema = z.object({
  idProduto: z.number().int().positive().describe("ID do produto pai"),
  idVariacao: z.number().int().positive().describe("ID da variação")
}).strict();

const ProductTagsInputSchema = z.object({
  idProduto: z.number().int().positive().describe("ID do produto"),
  response_format: ResponseFormatSchema
}).strict();

const UpdateProductTagsInputSchema = z.object({
  idProduto: z.number().int().positive().describe("ID do produto"),
  tags: z.array(z.object({
    id: z.number().int().positive().describe("ID da tag"),
    nome: z.string().optional().describe("Nome da tag")
  })).describe("Lista de tags para atualizar")
}).strict();

const CreateProductTagsInputSchema = z.object({
  idProduto: z.number().int().positive().describe("ID do produto"),
  tags: z.array(z.object({
    nome: z.string().min(1).max(100).describe("Nome da tag")
  })).min(1).describe("Lista de tags para criar")
}).strict();

const ListProductCostsInputSchema = z.object({
  idProduto: z.number().int().positive().describe("ID do produto"),
  ...PaginationSchema.shape,
  response_format: ResponseFormatSchema
}).strict();

// ============================================================================
// Formatters
// ============================================================================

function productToMarkdown(p: Product): string {
  const lines = [
    `## ${p.nome} (ID: ${p.id})`,
    "",
    `- **SKU:** ${p.sku || "-"}`,
    `- **Preço:** ${formatCurrency(p.preco)}`,
    `- **Preço Custo:** ${formatCurrency(p.precoCusto)}`,
    `- **Unidade:** ${p.unidade || "-"}`,
    `- **Tipo:** ${p.tipo || "produto"}`,
    `- **Situação:** ${p.situacao || "-"}`,
    `- **Estoque:** ${formatNumber(p.estoque, 0)}`,
    `- **GTIN:** ${p.gtin || "-"}`,
    `- **NCM:** ${p.ncm || "-"}`,
    ""
  ];
  return lines.join("\n");
}

function productToJson(p: Product): Record<string, unknown> {
  return {
    id: p.id,
    sku: p.sku,
    nome: p.nome,
    preco: p.preco,
    precoCusto: p.precoCusto,
    unidade: p.unidade,
    tipo: p.tipo,
    situacao: p.situacao,
    estoque: p.estoque,
    gtin: p.gtin,
    ncm: p.ncm,
    categoria: p.categoria,
    marca: p.marca
  };
}

function stockToMarkdown(s: Stock): string {
  return [
    `## Estoque do Produto (ID: ${s.idProduto})`,
    "",
    `- **Saldo Total:** ${formatNumber(s.saldo, 0)}`,
    `- **Reservado:** ${formatNumber(s.reservado, 0)}`,
    `- **Disponível:** ${formatNumber(s.disponivel, 0)}`,
    ""
  ].join("\n");
}

// ============================================================================
// Tool Registration
// ============================================================================

export function registerProductTools(server: McpServer): void {
  // List Products
  server.registerTool(
    "tiny_list_products",
    {
      title: "Listar Produtos",
      description: `Lista produtos do Tiny ERP com filtros e paginação.

IMPORTANTE: Quando o usuário pedir um produto por código (ex: "007672"), use o parâmetro SKU.
O SKU é o código principal de identificação dos produtos no sistema.

Parâmetros de filtro:
- sku: Filtrar por SKU (código do produto) - USE ESTE PARA BUSCAR POR CÓDIGO
- nome: Filtrar por nome
- gtin: Filtrar por código de barras EAN/GTIN (apenas se explicitamente solicitado)
- situacao: ativo ou inativo
- tipo: produto, servico ou kit
- idCategoria: ID da categoria
- idMarca: ID da marca

Retorna lista paginada com informações básicas de cada produto.`,
      inputSchema: ListProductsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof ListProductsInputSchema>) => {
      try {
        const queryParams: Record<string, unknown> = {
          limit: params.limit,
          offset: params.offset,
          orderBy: params.orderBy
        };

        if (params.nome) queryParams.nome = params.nome;
        if (params.sku) queryParams.codigo = params.sku; // API usa 'codigo' para SKU
        if (params.gtin) queryParams.gtin = params.gtin;
        if (params.situacao) queryParams.situacao = params.situacao;
        if (params.tipo) queryParams.tipo = params.tipo;
        if (params.idCategoria) queryParams.idCategoria = params.idCategoria;
        if (params.idMarca) queryParams.idMarca = params.idMarca;

        const response = await apiGet<{ itens: Product[]; paginacao: { total: number } }>("/produtos", queryParams);
        const items = response.itens || [];
        const total = response.paginacao?.total || items.length;

        const { text, structured } = formatListResponse(
          "Produtos",
          items,
          total,
          params.offset,
          params.response_format,
          productToMarkdown
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

  // Get Product
  server.registerTool(
    "tiny_get_product",
    {
      title: "Obter Produto",
      description: `Obtém detalhes completos de um produto pelo ID.

Retorna todas as informações do produto incluindo:
- Dados básicos (nome, SKU, preços)
- Dimensões e peso
- Informações fiscais (NCM, origem)
- Estoque
- Categoria e marca`,
      inputSchema: GetProductInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof GetProductInputSchema>) => {
      try {
        const product = await apiGet<Product>(`/produtos/${params.idProduto}`);

        const { text, structured } = formatItemResponse(
          `Produto: ${product.nome}`,
          product,
          params.response_format,
          productToMarkdown
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

  // Create Product
  server.registerTool(
    "tiny_create_product",
    {
      title: "Criar Produto",
      description: `Cria um novo produto no Tiny ERP.

Campos obrigatórios:
- nome: Nome do produto
- preco: Preço de venda

Campos opcionais incluem SKU, código de barras, NCM, dimensões, etc.`,
      inputSchema: CreateProductInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof CreateProductInputSchema>) => {
      try {
        const result = await apiPost<{ id: number }>("/produtos", params);
        return {
          content: [{ type: "text", text: formatSuccess(`Produto criado com ID: ${result.id}`) }],
          structuredContent: toStructuredContent({ id: result.id, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Update Product
  server.registerTool(
    "tiny_update_product",
    {
      title: "Atualizar Produto",
      description: `Atualiza um produto existente no Tiny ERP.

Informe o ID do produto e os campos que deseja atualizar.
Campos não informados mantêm seus valores atuais.`,
      inputSchema: UpdateProductInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof UpdateProductInputSchema>) => {
      try {
        const { idProduto, localizacao, ...rest } = params;
        const data: Record<string, unknown> = { ...rest };

        // Localização vai dentro do objeto estoque
        if (localizacao !== undefined) {
          data.estoque = { localizacao };
        }

        await apiPut(`/produtos/${idProduto}`, data);
        return {
          content: [{ type: "text", text: formatSuccess(`Produto ${idProduto} atualizado com sucesso`) }],
          structuredContent: toStructuredContent({ id: idProduto, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Update Product Price
  server.registerTool(
    "tiny_update_product_price",
    {
      title: "Atualizar Preço do Produto",
      description: `Atualiza o preço de venda e/ou custo de um produto.

Esta é uma operação específica para atualização de preços,
mais rápida que atualizar o produto completo.`,
      inputSchema: UpdateProductPriceInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof UpdateProductPriceInputSchema>) => {
      try {
        const { idProduto, ...data } = params;
        await apiPut(`/produtos/${idProduto}/preco`, data);
        return {
          content: [{ type: "text", text: formatSuccess(`Preço do produto ${idProduto} atualizado`) }],
          structuredContent: toStructuredContent({ id: idProduto, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Get Stock
  server.registerTool(
    "tiny_get_stock",
    {
      title: "Obter Estoque",
      description: `Obtém informações de estoque de um produto.

Retorna:
- Saldo total
- Quantidade reservada
- Quantidade disponível`,
      inputSchema: GetStockInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof GetStockInputSchema>) => {
      try {
        const stock = await apiGet<Stock>(`/estoque/${params.idProduto}`);

        const { text, structured } = formatItemResponse(
          "Estoque",
          stock,
          params.response_format,
          stockToMarkdown
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

  // Update Stock
  server.registerTool(
    "tiny_update_stock",
    {
      title: "Atualizar Estoque",
      description: `Movimenta o estoque de um produto.

Tipos de movimento:
- E: Entrada (adiciona ao estoque)
- S: Saída (remove do estoque)
- B: Balanço (ajuste para valor específico)

Parâmetros:
- tipo: E, S ou B
- quantidade: valor positivo
- precoUnitario: preço unitário (opcional, padrão 0)
- idDeposito: ID do depósito (opcional, padrão: CWB)
- observacoes: observação do movimento (opcional)

O depósito padrão é CWB (653728712).`,
      inputSchema: UpdateStockInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof UpdateStockInputSchema>) => {
      try {
        const { idProduto, idDeposito, ...rest } = params;
        const depositoId = idDeposito ?? DEPOSITO_PADRAO_ID;
        const data: Record<string, unknown> = {
          tipo: rest.tipo,
          quantidade: rest.quantidade,
          precoUnitario: rest.precoUnitario ?? 0,
          deposito: { id: depositoId },
        };
        if (rest.observacoes) data.observacoes = rest.observacoes;

        await apiPost(`/estoque/${idProduto}`, data);

        const tipoDesc = rest.tipo === "E" ? "Entrada" : rest.tipo === "S" ? "Saída" : "Balanço";
        return {
          content: [{ type: "text", text: formatSuccess(`${tipoDesc} de ${rest.quantidade} unidades no estoque do produto ${idProduto}`) }],
          structuredContent: toStructuredContent({ id: idProduto, success: true, tipo: rest.tipo, quantidade: rest.quantidade })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Get Product Kit
  server.registerTool(
    "tiny_get_product_kit",
    {
      title: "Obter Produto Kit",
      description: `Obtém os componentes de um produto do tipo kit.

Retorna a lista de produtos que compõem o kit
com suas respectivas quantidades.`,
      inputSchema: GetProductKitInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof GetProductKitInputSchema>) => {
      try {
        const kit = await apiGet<{ itens: Array<{ idProduto: number; quantidade: number; nome?: string }> }>(
          `/produtos/${params.idProduto}/kit`
        );

        if (params.response_format === ResponseFormat.JSON) {
          return {
            content: [{ type: "text", text: JSON.stringify(kit, null, 2) }],
            structuredContent: toStructuredContent(kit)
          };
        }

        const lines = [
          `# Componentes do Kit (ID: ${params.idProduto})`,
          "",
          "| ID Produto | Nome | Quantidade |",
          "|------------|------|------------|"
        ];

        for (const item of kit.itens || []) {
          lines.push(`| ${item.idProduto} | ${item.nome || "-"} | ${item.quantidade} |`);
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
          structuredContent: toStructuredContent(kit)
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Update Product Kit
  server.registerTool(
    "tiny_update_product_kit",
    {
      title: "Atualizar Produto Kit",
      description: `Atualiza os componentes de um produto kit.

Informe a lista completa de componentes com seus IDs e quantidades.
A lista existente será substituída pela nova.`,
      inputSchema: UpdateProductKitInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof UpdateProductKitInputSchema>) => {
      try {
        await apiPut(`/produtos/${params.idProduto}/kit`, { itens: params.itens });
        return {
          content: [{ type: "text", text: formatSuccess(`Kit do produto ${params.idProduto} atualizado`) }],
          structuredContent: toStructuredContent({ id: params.idProduto, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Get Manufactured Product
  server.registerTool(
    "tiny_get_manufactured_product",
    {
      title: "Obter Produto Fabricado",
      description: `Obtém a estrutura de um produto fabricado (insumos).

Retorna a lista de matérias-primas/insumos necessários
para fabricar o produto com suas quantidades.`,
      inputSchema: GetManufacturedProductInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof GetManufacturedProductInputSchema>) => {
      try {
        const manufactured = await apiGet<{ itens: Array<{ idProduto: number; quantidade: number; nome?: string }> }>(
          `/produtos/${params.idProduto}/fabricado`
        );

        if (params.response_format === ResponseFormat.JSON) {
          return {
            content: [{ type: "text", text: JSON.stringify(manufactured, null, 2) }],
            structuredContent: toStructuredContent(manufactured)
          };
        }

        const lines = [
          `# Estrutura do Produto Fabricado (ID: ${params.idProduto})`,
          "",
          "| ID Insumo | Nome | Quantidade |",
          "|-----------|------|------------|"
        ];

        for (const item of manufactured.itens || []) {
          lines.push(`| ${item.idProduto} | ${item.nome || "-"} | ${item.quantidade} |`);
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
          structuredContent: toStructuredContent(manufactured)
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Update Manufactured Product
  server.registerTool(
    "tiny_update_manufactured_product",
    {
      title: "Atualizar Produto Fabricado",
      description: `Atualiza a estrutura de um produto fabricado.

Informe a lista de insumos com seus IDs e quantidades.
A estrutura existente será substituída pela nova.`,
      inputSchema: UpdateManufacturedProductInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof UpdateManufacturedProductInputSchema>) => {
      try {
        await apiPut(`/produtos/${params.idProduto}/fabricado`, { itens: params.itens });
        return {
          content: [{ type: "text", text: formatSuccess(`Estrutura do produto fabricado ${params.idProduto} atualizada`) }],
          structuredContent: toStructuredContent({ id: params.idProduto, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Create Product Variation
  server.registerTool(
    "tiny_create_product_variation",
    {
      title: "Criar Variação de Produto",
      description: `Cria uma nova variação para um produto.

Informe o produto pai e os atributos da variação (ex: cor, tamanho).
Opcionalmente defina SKU, GTIN e preço específicos para a variação.`,
      inputSchema: CreateVariationInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof CreateVariationInputSchema>) => {
      try {
        const { idProduto, ...data } = params;
        const result = await apiPost<{ id: number }>(`/produtos/${idProduto}/variacoes`, data);
        return {
          content: [{ type: "text", text: formatSuccess(`Variação criada com ID: ${result.id}`) }],
          structuredContent: toStructuredContent({ id: result.id, idProduto, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Update Product Variation
  server.registerTool(
    "tiny_update_product_variation",
    {
      title: "Atualizar Variação de Produto",
      description: `Atualiza uma variação existente de um produto.

Informe o produto pai, o ID da variação e os campos a atualizar.`,
      inputSchema: UpdateVariationInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof UpdateVariationInputSchema>) => {
      try {
        const { idProduto, idVariacao, ...data } = params;
        await apiPut(`/produtos/${idProduto}/variacoes/${idVariacao}`, data);
        return {
          content: [{ type: "text", text: formatSuccess(`Variação ${idVariacao} atualizada`) }],
          structuredContent: toStructuredContent({ idProduto, idVariacao, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Delete Product Variation
  server.registerTool(
    "tiny_delete_product_variation",
    {
      title: "Excluir Variação de Produto",
      description: `Exclui uma variação de um produto.

ATENÇÃO: Esta ação não pode ser desfeita.`,
      inputSchema: DeleteVariationInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof DeleteVariationInputSchema>) => {
      try {
        await apiDelete(`/produtos/${params.idProduto}/variacoes/${params.idVariacao}`);
        return {
          content: [{ type: "text", text: formatSuccess(`Variação ${params.idVariacao} excluída`) }],
          structuredContent: toStructuredContent({ idProduto: params.idProduto, idVariacao: params.idVariacao, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Get Product Tags
  server.registerTool(
    "tiny_get_product_tags",
    {
      title: "Obter Tags do Produto",
      description: `Obtém as tags associadas a um produto.`,
      inputSchema: ProductTagsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof ProductTagsInputSchema>) => {
      try {
        const tags = await apiGet<Array<{ id: number; nome: string }>>(`/produtos/${params.idProduto}/tags`);

        if (params.response_format === ResponseFormat.JSON) {
          return {
            content: [{ type: "text", text: JSON.stringify(tags, null, 2) }],
            structuredContent: toStructuredContent({ items: tags })
          };
        }

        const lines = [
          `# Tags do Produto (ID: ${params.idProduto})`,
          "",
          tags.length > 0
            ? tags.map(t => `- ${t.nome} (ID: ${t.id})`).join("\n")
            : "Nenhuma tag encontrada"
        ];

        return {
          content: [{ type: "text", text: lines.join("\n") }],
          structuredContent: toStructuredContent({ items: tags })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Update Product Tags
  server.registerTool(
    "tiny_update_product_tags",
    {
      title: "Atualizar Tags do Produto",
      description: `Atualiza as tags de um produto.

A lista informada substituirá as tags existentes.`,
      inputSchema: UpdateProductTagsInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof UpdateProductTagsInputSchema>) => {
      try {
        await apiPut(`/produtos/${params.idProduto}/tags`, params.tags);
        return {
          content: [{ type: "text", text: formatSuccess(`Tags do produto ${params.idProduto} atualizadas`) }],
          structuredContent: toStructuredContent({ id: params.idProduto, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Create Product Tags
  server.registerTool(
    "tiny_create_product_tags",
    {
      title: "Criar Tags do Produto",
      description: `Adiciona novas tags a um produto.

As tags informadas serão adicionadas às existentes.`,
      inputSchema: CreateProductTagsInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof CreateProductTagsInputSchema>) => {
      try {
        await apiPost(`/produtos/${params.idProduto}/tags`, params.tags);
        return {
          content: [{ type: "text", text: formatSuccess(`Tags adicionadas ao produto ${params.idProduto}`) }],
          structuredContent: toStructuredContent({ id: params.idProduto, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Delete Product Tags
  server.registerTool(
    "tiny_delete_product_tags",
    {
      title: "Excluir Tags do Produto",
      description: `Remove todas as tags de um produto.`,
      inputSchema: z.object({
        idProduto: z.number().int().positive().describe("ID do produto")
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: { idProduto: number }) => {
      try {
        await apiDelete(`/produtos/${params.idProduto}/tags`);
        return {
          content: [{ type: "text", text: formatSuccess(`Tags do produto ${params.idProduto} removidas`) }],
          structuredContent: toStructuredContent({ id: params.idProduto, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // List Product Costs
  server.registerTool(
    "tiny_list_product_costs",
    {
      title: "Listar Custos do Produto",
      description: `Lista o histórico de custos de um produto.`,
      inputSchema: ListProductCostsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof ListProductCostsInputSchema>) => {
      try {
        const response = await apiGet<{ itens: Array<{ data: string; custo: number; observacao?: string }>; paginacao: { total: number } }>(
          `/produtos/${params.idProduto}/custos`,
          { limit: params.limit, offset: params.offset }
        );

        const items = response.itens || [];
        const total = response.paginacao?.total || items.length;

        if (params.response_format === ResponseFormat.JSON) {
          return {
            content: [{ type: "text", text: JSON.stringify({ items, total, offset: params.offset }, null, 2) }],
            structuredContent: toStructuredContent({ items, total, offset: params.offset })
          };
        }

        const lines = [
          `# Histórico de Custos (Produto ID: ${params.idProduto})`,
          "",
          `**Total:** ${total} registros`,
          "",
          "| Data | Custo | Observação |",
          "|------|-------|------------|"
        ];

        for (const item of items) {
          lines.push(`| ${item.data} | ${formatCurrency(item.custo)} | ${item.observacao || "-"} |`);
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
          structuredContent: toStructuredContent({ items, total, offset: params.offset })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
