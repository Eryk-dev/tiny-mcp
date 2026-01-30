/**
 * Tiny ERP API Type Definitions
 */

// Pagination
export interface PaginationInfo {
  limit: number;
  offset: number;
  total: number;
}

export interface PaginatedResponse<T> {
  itens: T[];
  paginacao: PaginationInfo;
}

// Common response wrapper
export interface ApiListResponse<T> {
  total: number;
  count: number;
  offset: number;
  items: T[];
  has_more: boolean;
  next_offset?: number;
}

// Error
export interface ApiError {
  erro: string;
  mensagem: string;
  detalhes?: string[];
}

// Category
export interface Category {
  id: number;
  nome: string;
  pai?: number;
  filhos?: Category[];
}

// Income/Expense Category
export interface IncomeExpenseCategory {
  id: number;
  descricao: string;
  grupo: string;
  tipo: "receita" | "despesa";
}

// Contact
export interface Contact {
  id: number;
  nome: string;
  fantasia?: string;
  tipoPessoa: "F" | "J";
  cpfCnpj?: string;
  ie?: string;
  email?: string;
  telefone?: string;
  celular?: string;
  endereco?: Address;
  situacao?: string;
  observacao?: string;
  dataCriacao?: string;
  dataAtualizacao?: string;
}

export interface ContactPerson {
  id: number;
  nome: string;
  email?: string;
  telefone?: string;
  cargo?: string;
}

export interface Address {
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  pais?: string;
}

// Product
export interface Product {
  id: number;
  sku?: string;
  nome: string;
  preco: number;
  precoCusto?: number;
  unidade?: string;
  gtin?: string;
  ncm?: string;
  origem?: number;
  tipo?: string;
  situacao?: string;
  descricao?: string;
  descricaoCurta?: string;
  pesoLiquido?: number;
  pesoBruto?: number;
  largura?: number;
  altura?: number;
  profundidade?: number;
  estoque?: number;
  estoqueMinimo?: number;
  estoqueMaximo?: number;
  localizacao?: string;
  categoria?: number;
  marca?: number;
  dataCriacao?: string;
  dataAtualizacao?: string;
}

export interface ProductVariation {
  id: number;
  sku?: string;
  nome: string;
  preco: number;
  estoque?: number;
  gtin?: string;
  grade?: Record<string, string>;
}

export interface ProductKit {
  id: number;
  itens: ProductKitItem[];
}

export interface ProductKitItem {
  idProduto: number;
  quantidade: number;
}

export interface ManufacturedProduct {
  id: number;
  itens: ManufacturedProductItem[];
}

export interface ManufacturedProductItem {
  idProduto: number;
  quantidade: number;
}

// Stock
export interface Stock {
  idProduto: number;
  saldo: number;
  reservado?: number;
  disponivel?: number;
}

// Order
export interface Order {
  id: number;
  numero?: string;
  numeroEcommerce?: string;
  dataEmissao: string;
  dataPrevista?: string;
  cliente: OrderContact;
  itens: OrderItem[];
  situacao: string;
  valorFrete?: number;
  valorDesconto?: number;
  valorTotal: number;
  observacao?: string;
  observacaoInterna?: string;
  idFormaPagamento?: number;
  idFormaEnvio?: number;
  idVendedor?: number;
  codigoRastreamento?: string;
  urlRastreamento?: string;
  dataCriacao?: string;
  dataAtualizacao?: string;
}

export interface OrderContact {
  id?: number;
  nome: string;
  tipoPessoa?: "F" | "J";
  cpfCnpj?: string;
  email?: string;
  telefone?: string;
  endereco?: Address;
}

export interface OrderItem {
  id?: number;
  idProduto?: number;
  sku?: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal?: number;
  desconto?: number;
}

// Invoice
export interface Invoice {
  id: number;
  numero?: string;
  serie?: string;
  chaveAcesso?: string;
  dataEmissao?: string;
  situacao: string;
  tipo?: string;
  naturezaOperacao?: string;
  cliente?: InvoiceContact;
  itens?: InvoiceItem[];
  valorTotal?: number;
  valorFrete?: number;
  valorDesconto?: number;
  valorProdutos?: number;
  valorIcms?: number;
  valorIpi?: number;
}

export interface InvoiceContact {
  id?: number;
  nome: string;
  cpfCnpj?: string;
  ie?: string;
  endereco?: Address;
}

export interface InvoiceItem {
  id: number;
  idProduto?: number;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  ncm?: string;
  cfop?: string;
}

// Payable/Receivable
export interface Payable {
  id: number;
  nomeCliente?: string;
  dataEmissao: string;
  dataVencimento: string;
  dataPagamento?: string;
  valor: number;
  valorPago?: number;
  situacao: string;
  historico?: string;
  categoria?: number;
  formaPagamento?: number;
  numeroBancario?: string;
}

export interface Receivable {
  id: number;
  nomeCliente?: string;
  dataEmissao: string;
  dataVencimento: string;
  dataRecebimento?: string;
  valor: number;
  valorRecebido?: number;
  situacao: string;
  historico?: string;
  categoria?: number;
  formaRecebimento?: number;
}

export interface Receipt {
  id: number;
  data: string;
  valor: number;
  observacao?: string;
}

// Purchase Order
export interface PurchaseOrder {
  id: number;
  numero?: string;
  dataEmissao: string;
  dataPrevista?: string;
  fornecedor: OrderContact;
  itens: OrderItem[];
  situacao: string;
  valorTotal: number;
  observacao?: string;
}

// Service Order
export interface ServiceOrder {
  id: number;
  numero?: string;
  dataEmissao: string;
  cliente: OrderContact;
  itens: ServiceOrderItem[];
  situacao: string;
  valorTotal: number;
  observacao?: string;
}

export interface ServiceOrderItem {
  id?: number;
  idServico?: number;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal?: number;
}

// Shipping
export interface ShipmentGroup {
  id: number;
  nome?: string;
  dataCriacao: string;
  situacao: string;
  expedições?: Shipment[];
}

export interface Shipment {
  id: number;
  idPedido?: number;
  situacao: string;
  codigoRastreamento?: string;
}

export interface ShippingMethod {
  id: number;
  nome: string;
  tipo?: string;
  prazo?: number;
  valor?: number;
}

// Separation
export interface Separation {
  id: number;
  dataCriacao: string;
  situacao: string;
  itens?: SeparationItem[];
}

export interface SeparationItem {
  idProduto: number;
  quantidade: number;
  quantidadeSeparada?: number;
}

// Payment/Receipt Methods
export interface PaymentMethod {
  id: number;
  nome: string;
  padrao?: boolean;
}

export interface ReceiptMethod {
  id: number;
  nome: string;
  padrao?: boolean;
}

// Brand
export interface Brand {
  id: number;
  nome: string;
  descricao?: string;
}

// Price List
export interface PriceList {
  id: number;
  nome: string;
  descricao?: string;
}

// Tag
export interface Tag {
  id: number;
  nome: string;
  cor?: string;
}

export interface TagGroup {
  id: number;
  nome: string;
  tags?: Tag[];
}

// Marker/Label
export interface Marker {
  id: number;
  nome: string;
  cor?: string;
}

// CRM Subject
export interface CRMSubject {
  id: number;
  titulo: string;
  descricao?: string;
  valor?: number;
  dataLimite?: string;
  situacao?: string;
  idEstagio?: number;
  idContato?: number;
  idResponsavel?: number;
  estrela?: boolean;
  arquivado?: boolean;
  dataCriacao?: string;
  dataAtualizacao?: string;
}

export interface CRMAction {
  id: number;
  titulo: string;
  descricao?: string;
  tipo?: string;
  data?: string;
  concluida?: boolean;
}

export interface CRMNote {
  id: number;
  conteudo: string;
  dataCriacao: string;
}

export interface CRMStage {
  id: number;
  nome: string;
  ordem?: number;
  cor?: string;
}

// Intermediary (Marketplace)
export interface Intermediary {
  id: number;
  nome: string;
  codigo?: string;
}

// Service
export interface Service {
  id: number;
  nome: string;
  preco: number;
  codigo?: string;
  descricao?: string;
  situacao?: string;
}

// User
export interface User {
  id: number;
  nome: string;
  email: string;
  situacao?: string;
}

// Salesperson
export interface Salesperson {
  id: number;
  nome: string;
  email?: string;
  comissao?: number;
}

// Company Info
export interface CompanyInfo {
  nome: string;
  fantasia?: string;
  cnpj?: string;
  ie?: string;
  im?: string;
  endereco?: Address;
  telefone?: string;
  email?: string;
}

// Contact Type
export interface ContactType {
  id: number;
  nome: string;
}
