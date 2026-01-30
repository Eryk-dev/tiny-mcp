/**
 * Contact Tools for Tiny ERP MCP Server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ResponseFormat } from "../constants.js";
import { apiGet, apiPost, apiPut, apiDelete, handleApiError } from "../services/api-client.js";
import {
  formatListResponse,
  formatItemResponse,
  formatSuccess,
  formatAddress,
  toStructuredContent
} from "../services/formatters.js";
import { ResponseFormatSchema, PaginationSchema, OrderBySchema, AddressSchema, ContactBaseSchema } from "../schemas/common.js";
import type { Contact, ContactPerson } from "../types.js";

// ============================================================================
// Schemas
// ============================================================================

const ListContactsInputSchema = z.object({
  nome: z.string().max(200).optional().describe("Filtrar por nome"),
  cpfCnpj: z.string().max(18).optional().describe("Filtrar por CPF/CNPJ"),
  email: z.string().max(100).optional().describe("Filtrar por e-mail"),
  telefone: z.string().max(20).optional().describe("Filtrar por telefone"),
  tipoPessoa: z.enum(["F", "J"]).optional().describe("Tipo: F=Física, J=Jurídica"),
  situacao: z.enum(["ativo", "inativo"]).optional().describe("Situação do contato"),
  idTipoContato: z.number().int().positive().optional().describe("Filtrar por tipo de contato"),
  orderBy: OrderBySchema,
  ...PaginationSchema.shape,
  response_format: ResponseFormatSchema
}).strict();

const GetContactInputSchema = z.object({
  idContato: z.number().int().positive().describe("ID do contato"),
  response_format: ResponseFormatSchema
}).strict();

const CreateContactInputSchema = ContactBaseSchema.extend({
  idTipoContato: z.number().int().positive().optional().describe("ID do tipo de contato")
});

const UpdateContactInputSchema = z.object({
  idContato: z.number().int().positive().describe("ID do contato"),
  nome: z.string().max(200).optional().describe("Nome"),
  fantasia: z.string().max(200).optional().describe("Nome fantasia"),
  cpfCnpj: z.string().max(18).optional().describe("CPF/CNPJ"),
  ie: z.string().max(20).optional().describe("Inscrição estadual"),
  email: z.string().email().max(100).optional().describe("E-mail"),
  telefone: z.string().max(20).optional().describe("Telefone"),
  celular: z.string().max(20).optional().describe("Celular"),
  endereco: AddressSchema.optional().describe("Endereço"),
  observacao: z.string().max(2000).optional().describe("Observações")
}).strict();

const UpdateContactCRMStatusInputSchema = z.object({
  idContato: z.number().int().positive().describe("ID do contato"),
  situacaoCRM: z.string().min(1).max(50).describe("Nova situação no CRM")
}).strict();

const ListContactPersonsInputSchema = z.object({
  idContato: z.number().int().positive().describe("ID do contato"),
  ...PaginationSchema.shape,
  response_format: ResponseFormatSchema
}).strict();

const GetContactPersonInputSchema = z.object({
  idContato: z.number().int().positive().describe("ID do contato"),
  idPessoa: z.number().int().positive().describe("ID da pessoa de contato"),
  response_format: ResponseFormatSchema
}).strict();

const CreateContactPersonInputSchema = z.object({
  idContato: z.number().int().positive().describe("ID do contato"),
  nome: z.string().min(1).max(200).describe("Nome da pessoa"),
  email: z.string().email().max(100).optional().describe("E-mail"),
  telefone: z.string().max(20).optional().describe("Telefone"),
  cargo: z.string().max(100).optional().describe("Cargo")
}).strict();

const UpdateContactPersonInputSchema = z.object({
  idContato: z.number().int().positive().describe("ID do contato"),
  idPessoa: z.number().int().positive().describe("ID da pessoa de contato"),
  nome: z.string().max(200).optional().describe("Nome"),
  email: z.string().email().max(100).optional().describe("E-mail"),
  telefone: z.string().max(20).optional().describe("Telefone"),
  cargo: z.string().max(100).optional().describe("Cargo")
}).strict();

const DeleteContactPersonInputSchema = z.object({
  idContato: z.number().int().positive().describe("ID do contato"),
  idPessoa: z.number().int().positive().describe("ID da pessoa de contato")
}).strict();

const ListContactTypesInputSchema = z.object({
  ...PaginationSchema.shape,
  response_format: ResponseFormatSchema
}).strict();

// ============================================================================
// Formatters
// ============================================================================

function contactToMarkdown(c: Contact): string {
  const lines = [
    `## ${c.nome} (ID: ${c.id})`,
    "",
    `- **Tipo:** ${c.tipoPessoa === "J" ? "Pessoa Jurídica" : "Pessoa Física"}`,
    `- **CPF/CNPJ:** ${c.cpfCnpj || "-"}`,
    `- **E-mail:** ${c.email || "-"}`,
    `- **Telefone:** ${c.telefone || "-"}`,
    `- **Celular:** ${c.celular || "-"}`,
    `- **Endereço:** ${formatAddress(c.endereco)}`,
    `- **Situação:** ${c.situacao || "-"}`,
    ""
  ];
  return lines.join("\n");
}

function contactToJson(c: Contact): Record<string, unknown> {
  return {
    id: c.id,
    nome: c.nome,
    fantasia: c.fantasia,
    tipoPessoa: c.tipoPessoa,
    cpfCnpj: c.cpfCnpj,
    ie: c.ie,
    email: c.email,
    telefone: c.telefone,
    celular: c.celular,
    endereco: c.endereco,
    situacao: c.situacao
  };
}

function personToMarkdown(p: ContactPerson): string {
  return [
    `### ${p.nome} (ID: ${p.id})`,
    `- **E-mail:** ${p.email || "-"}`,
    `- **Telefone:** ${p.telefone || "-"}`,
    `- **Cargo:** ${p.cargo || "-"}`,
    ""
  ].join("\n");
}

// ============================================================================
// Tool Registration
// ============================================================================

export function registerContactTools(server: McpServer): void {
  // List Contacts
  server.registerTool(
    "tiny_list_contacts",
    {
      title: "Listar Contatos",
      description: `Lista contatos do Tiny ERP (clientes, fornecedores, etc).

Filtros: nome, cpfCnpj, email, telefone, tipoPessoa (F/J), situacao, idTipoContato.`,
      inputSchema: ListContactsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof ListContactsInputSchema>) => {
      try {
        const queryParams: Record<string, unknown> = {
          limit: params.limit,
          offset: params.offset,
          orderBy: params.orderBy
        };

        if (params.nome) queryParams.nome = params.nome;
        if (params.cpfCnpj) queryParams.cpfCnpj = params.cpfCnpj;
        if (params.email) queryParams.email = params.email;
        if (params.telefone) queryParams.telefone = params.telefone;
        if (params.tipoPessoa) queryParams.tipoPessoa = params.tipoPessoa;
        if (params.situacao) queryParams.situacao = params.situacao;
        if (params.idTipoContato) queryParams.idTipoContato = params.idTipoContato;

        const response = await apiGet<{ itens: Contact[]; paginacao: { total: number } }>("/contatos", queryParams);
        const items = response.itens || [];
        const total = response.paginacao?.total || items.length;

        const { text, structured } = formatListResponse(
          "Contatos",
          items,
          total,
          params.offset,
          params.response_format,
          contactToMarkdown
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

  // Get Contact
  server.registerTool(
    "tiny_get_contact",
    {
      title: "Obter Contato",
      description: `Obtém detalhes de um contato pelo ID.`,
      inputSchema: GetContactInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof GetContactInputSchema>) => {
      try {
        const contact = await apiGet<Contact>(`/contatos/${params.idContato}`);

        const { text, structured } = formatItemResponse(
          `Contato: ${contact.nome}`,
          contact,
          params.response_format,
          contactToMarkdown
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

  // Create Contact
  server.registerTool(
    "tiny_create_contact",
    {
      title: "Criar Contato",
      description: `Cria um novo contato (cliente, fornecedor, etc).

Campo obrigatório: nome
Campos opcionais: fantasia, tipoPessoa, cpfCnpj, ie, email, telefone, celular, endereco, observacao, idTipoContato`,
      inputSchema: CreateContactInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof CreateContactInputSchema>) => {
      try {
        const result = await apiPost<{ id: number }>("/contatos", params);
        return {
          content: [{ type: "text", text: formatSuccess(`Contato criado com ID: ${result.id}`) }],
          structuredContent: toStructuredContent({ id: result.id, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Update Contact
  server.registerTool(
    "tiny_update_contact",
    {
      title: "Atualizar Contato",
      description: `Atualiza dados de um contato existente.`,
      inputSchema: UpdateContactInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof UpdateContactInputSchema>) => {
      try {
        const { idContato, ...data } = params;
        await apiPut(`/contatos/${idContato}`, data);
        return {
          content: [{ type: "text", text: formatSuccess(`Contato ${idContato} atualizado`) }],
          structuredContent: toStructuredContent({ id: idContato, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Update Contact CRM Status
  server.registerTool(
    "tiny_update_contact_crm_status",
    {
      title: "Atualizar Status CRM do Contato",
      description: `Atualiza a situação do contato no CRM.`,
      inputSchema: UpdateContactCRMStatusInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof UpdateContactCRMStatusInputSchema>) => {
      try {
        await apiPut(`/contatos/${params.idContato}/situacao-crm`, { situacaoCRM: params.situacaoCRM });
        return {
          content: [{ type: "text", text: formatSuccess(`Status CRM do contato ${params.idContato} atualizado para: ${params.situacaoCRM}`) }],
          structuredContent: toStructuredContent({ id: params.idContato, situacaoCRM: params.situacaoCRM, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // List Contact Persons
  server.registerTool(
    "tiny_list_contact_persons",
    {
      title: "Listar Pessoas de Contato",
      description: `Lista as pessoas de contato associadas a um contato.`,
      inputSchema: ListContactPersonsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof ListContactPersonsInputSchema>) => {
      try {
        const response = await apiGet<{ itens: ContactPerson[]; paginacao: { total: number } }>(
          `/contatos/${params.idContato}/pessoas`,
          { limit: params.limit, offset: params.offset }
        );
        const items = response.itens || [];
        const total = response.paginacao?.total || items.length;

        const { text, structured } = formatListResponse(
          `Pessoas de Contato (Contato ID: ${params.idContato})`,
          items,
          total,
          params.offset,
          params.response_format,
          personToMarkdown
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

  // Get Contact Person
  server.registerTool(
    "tiny_get_contact_person",
    {
      title: "Obter Pessoa de Contato",
      description: `Obtém detalhes de uma pessoa de contato.`,
      inputSchema: GetContactPersonInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof GetContactPersonInputSchema>) => {
      try {
        const person = await apiGet<ContactPerson>(`/contatos/${params.idContato}/pessoas/${params.idPessoa}`);

        const { text, structured } = formatItemResponse(
          `Pessoa de Contato: ${person.nome}`,
          person,
          params.response_format,
          personToMarkdown
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

  // Create Contact Person
  server.registerTool(
    "tiny_create_contact_person",
    {
      title: "Criar Pessoa de Contato",
      description: `Adiciona uma nova pessoa de contato a um contato.`,
      inputSchema: CreateContactPersonInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof CreateContactPersonInputSchema>) => {
      try {
        const { idContato, ...data } = params;
        const result = await apiPost<{ id: number }>(`/contatos/${idContato}/pessoas`, data);
        return {
          content: [{ type: "text", text: formatSuccess(`Pessoa de contato criada com ID: ${result.id}`) }],
          structuredContent: toStructuredContent({ idContato, id: result.id, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Update Contact Person
  server.registerTool(
    "tiny_update_contact_person",
    {
      title: "Atualizar Pessoa de Contato",
      description: `Atualiza dados de uma pessoa de contato.`,
      inputSchema: UpdateContactPersonInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof UpdateContactPersonInputSchema>) => {
      try {
        const { idContato, idPessoa, ...data } = params;
        await apiPut(`/contatos/${idContato}/pessoas/${idPessoa}`, data);
        return {
          content: [{ type: "text", text: formatSuccess(`Pessoa de contato ${idPessoa} atualizada`) }],
          structuredContent: toStructuredContent({ idContato, idPessoa, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Delete Contact Person
  server.registerTool(
    "tiny_delete_contact_person",
    {
      title: "Excluir Pessoa de Contato",
      description: `Remove uma pessoa de contato.`,
      inputSchema: DeleteContactPersonInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof DeleteContactPersonInputSchema>) => {
      try {
        await apiDelete(`/contatos/${params.idContato}/pessoas/${params.idPessoa}`);
        return {
          content: [{ type: "text", text: formatSuccess(`Pessoa de contato ${params.idPessoa} excluída`) }],
          structuredContent: toStructuredContent({ idContato: params.idContato, idPessoa: params.idPessoa, success: true })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // List Contact Types
  server.registerTool(
    "tiny_list_contact_types",
    {
      title: "Listar Tipos de Contatos",
      description: `Lista os tipos de contatos disponíveis (cliente, fornecedor, etc).`,
      inputSchema: ListContactTypesInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: z.infer<typeof ListContactTypesInputSchema>) => {
      try {
        const response = await apiGet<{ itens: Array<{ id: number; nome: string }>; paginacao: { total: number } }>(
          "/tipos-contatos",
          { limit: params.limit, offset: params.offset }
        );
        const items = response.itens || [];
        const total = response.paginacao?.total || items.length;

        if (params.response_format === ResponseFormat.JSON) {
          return {
            content: [{ type: "text", text: JSON.stringify({ items, total }, null, 2) }],
            structuredContent: toStructuredContent({ items, total })
          };
        }

        const lines = [
          "# Tipos de Contatos",
          "",
          `**Total:** ${total}`,
          "",
          ...items.map(t => `- ${t.nome} (ID: ${t.id})`)
        ];

        return {
          content: [{ type: "text", text: lines.join("\n") }],
          structuredContent: toStructuredContent({ items, total })
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
