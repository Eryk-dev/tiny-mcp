/**
 * Common Zod schemas used across multiple tools
 */

import { z } from "zod";
import { ResponseFormat, OrderBy, DEFAULT_LIMIT, MAX_LIMIT } from "../constants.js";

// Response format schema
export const ResponseFormatSchema = z.nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe("Formato de saída: 'markdown' para leitura humana ou 'json' para processamento");

// Order by schema
export const OrderBySchema = z.nativeEnum(OrderBy)
  .default(OrderBy.DESC)
  .describe("Ordenação: 'asc' crescente ou 'desc' decrescente");

// Pagination schema
export const PaginationSchema = z.object({
  limit: z.number()
    .int()
    .min(1)
    .max(MAX_LIMIT)
    .default(DEFAULT_LIMIT)
    .describe(`Limite de resultados por página (máximo ${MAX_LIMIT})`),
  offset: z.number()
    .int()
    .min(0)
    .default(0)
    .describe("Deslocamento para paginação")
});

// Date range schema
export const DateRangeSchema = z.object({
  dataInicial: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato deve ser YYYY-MM-DD")
    .optional()
    .describe("Data inicial no formato YYYY-MM-DD"),
  dataFinal: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato deve ser YYYY-MM-DD")
    .optional()
    .describe("Data final no formato YYYY-MM-DD")
});

// ID schema
export const IdSchema = z.number()
  .int()
  .positive()
  .describe("Identificador único");

// Optional ID schema
export const OptionalIdSchema = z.number()
  .int()
  .positive()
  .optional()
  .describe("Identificador único (opcional)");

// String search schema
export const SearchStringSchema = z.string()
  .min(1)
  .max(200)
  .optional()
  .describe("Texto para pesquisa");

// Address schema
export const AddressSchema = z.object({
  logradouro: z.string().max(200).optional().describe("Logradouro"),
  numero: z.string().max(20).optional().describe("Número"),
  complemento: z.string().max(100).optional().describe("Complemento"),
  bairro: z.string().max(100).optional().describe("Bairro"),
  cidade: z.string().max(100).optional().describe("Cidade"),
  uf: z.string().length(2).optional().describe("UF (sigla do estado)"),
  cep: z.string().max(10).optional().describe("CEP"),
  pais: z.string().max(50).optional().describe("País")
}).strict();

// Contact base schema
export const ContactBaseSchema = z.object({
  nome: z.string().min(1).max(200).describe("Nome do contato"),
  fantasia: z.string().max(200).optional().describe("Nome fantasia"),
  tipoPessoa: z.enum(["F", "J"]).optional().describe("Tipo de pessoa: F=Física, J=Jurídica"),
  cpfCnpj: z.string().max(18).optional().describe("CPF ou CNPJ"),
  ie: z.string().max(20).optional().describe("Inscrição estadual"),
  email: z.string().email().max(100).optional().describe("E-mail"),
  telefone: z.string().max(20).optional().describe("Telefone"),
  celular: z.string().max(20).optional().describe("Celular"),
  endereco: AddressSchema.optional().describe("Endereço"),
  observacao: z.string().max(2000).optional().describe("Observações")
}).strict();

// Order item schema
export const OrderItemSchema = z.object({
  idProduto: z.number().int().positive().optional().describe("ID do produto"),
  sku: z.string().max(50).optional().describe("SKU do produto"),
  descricao: z.string().min(1).max(500).describe("Descrição do item"),
  quantidade: z.number().positive().describe("Quantidade"),
  valorUnitario: z.number().min(0).describe("Valor unitário"),
  desconto: z.number().min(0).optional().describe("Valor do desconto")
}).strict();

// Marker schema
export const MarkerSchema = z.object({
  id: z.number().int().positive().describe("ID do marcador"),
  nome: z.string().min(1).max(100).describe("Nome do marcador"),
  cor: z.string().max(20).optional().describe("Cor do marcador")
}).strict();

// Create marker schema
export const CreateMarkerSchema = z.object({
  nome: z.string().min(1).max(100).describe("Nome do marcador"),
  cor: z.string().max(20).optional().describe("Cor do marcador (hex ou nome)")
}).strict();

// Update marker schema
export const UpdateMarkerSchema = z.object({
  id: z.number().int().positive().describe("ID do marcador"),
  nome: z.string().min(1).max(100).optional().describe("Novo nome do marcador"),
  cor: z.string().max(20).optional().describe("Nova cor do marcador")
}).strict();

// Tag schema
export const TagSchema = z.object({
  id: z.number().int().positive().describe("ID da tag"),
  nome: z.string().min(1).max(100).describe("Nome da tag")
}).strict();

// Create tag schema
export const CreateTagSchema = z.object({
  nome: z.string().min(1).max(100).describe("Nome da tag")
}).strict();

// Tracking info schema
export const TrackingInfoSchema = z.object({
  codigoRastreamento: z.string().max(100).optional().describe("Código de rastreamento"),
  urlRastreamento: z.string().url().max(500).optional().describe("URL de rastreamento")
}).strict();
