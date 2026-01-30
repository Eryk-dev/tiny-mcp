/**
 * Tiny ERP API Constants
 */

export const API_BASE_URL = "https://api.tiny.com.br/public-api/v3";
export const CHARACTER_LIMIT = 25000;
export const DEFAULT_LIMIT = 100;
export const MAX_LIMIT = 100;

// Response format options
export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json"
}

// Order/Status enums
export enum OrderStatus {
  ABERTO = "aberto",
  APROVADO = "aprovado",
  PREPARANDO = "preparando",
  FATURADO = "faturado",
  PRONTO = "pronto",
  ENVIADO = "enviado",
  ENTREGUE = "entregue",
  CANCELADO = "cancelado"
}

export enum PayableStatus {
  ABERTO = "aberto",
  CANCELADA = "cancelada",
  PAGO = "pago",
  PARCIAL = "parcial",
  PREVISTA = "prevista",
  ATRASADAS = "atrasadas",
  EMISSAO = "emissao"
}

export enum ReceivableStatus {
  ABERTO = "aberto",
  CANCELADA = "cancelada",
  RECEBIDO = "recebido",
  PARCIAL = "parcial",
  PREVISTA = "prevista",
  ATRASADAS = "atrasadas",
  EMISSAO = "emissao"
}

export enum InvoiceStatus {
  PENDENTE = "pendente",
  EMITIDA = "emitida",
  CANCELADA = "cancelada",
  DENEGADA = "denegada",
  ERRO = "erro"
}

export enum ProductType {
  PRODUTO = "produto",
  SERVICO = "servico",
  KIT = "kit"
}

export enum OrderBy {
  ASC = "asc",
  DESC = "desc"
}
