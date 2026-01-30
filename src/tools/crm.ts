/**
 * CRM Tools for Tiny ERP MCP Server
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
  formatDateTime,
  formatSuccess,
  toStructuredContent
} from "../services/formatters.js";
import { ResponseFormatSchema, PaginationSchema, OrderBySchema } from "../schemas/common.js";
import type { CRMSubject, CRMAction, CRMNote, CRMStage } from "../types.js";

// ============================================================================
// Schemas
// ============================================================================

const ListSubjectsInputSchema = z.object({
  titulo: z.string().max(200).optional().describe("Filtrar por título"),
  idContato: z.number().int().positive().optional().describe("Filtrar por ID do contato"),
  idEstagio: z.number().int().positive().optional().describe("Filtrar por ID do estágio"),
  idResponsavel: z.number().int().positive().optional().describe("Filtrar por ID do responsável"),
  arquivado: z.boolean().optional().describe("Filtrar por assuntos arquivados"),
  dataInicialLimite: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data limite inicial"),
  dataFinalLimite: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data limite final"),
  orderBy: OrderBySchema,
  ...PaginationSchema.shape,
  response_format: ResponseFormatSchema
}).strict();

const GetSubjectInputSchema = z.object({
  idAssunto: z.number().int().positive().describe("ID do assunto"),
  response_format: ResponseFormatSchema
}).strict();

const CreateSubjectInputSchema = z.object({
  titulo: z.string().min(1).max(200).describe("Título do assunto"),
  descricao: z.string().max(5000).optional().describe("Descrição"),
  valor: z.number().min(0).optional().describe("Valor estimado"),
  dataLimite: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data limite"),
  idContato: z.number().int().positive().optional().describe("ID do contato"),
  idEstagio: z.number().int().positive().optional().describe("ID do estágio"),
  idResponsavel: z.number().int().positive().optional().describe("ID do responsável")
}).strict();

const UpdateSubjectInputSchema = z.object({
  idAssunto: z.number().int().positive().describe("ID do assunto"),
  titulo: z.string().max(200).optional().describe("Título"),
  descricao: z.string().max(5000).optional().describe("Descrição"),
  valor: z.number().min(0).optional().describe("Valor"),
  dataLimite: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data limite"),
  idEstagio: z.number().int().positive().optional().describe("ID do estágio"),
  idResponsavel: z.number().int().positive().optional().describe("ID do responsável")
}).strict();

const ArchiveSubjectInputSchema = z.object({
  idAssunto: z.number().int().positive().describe("ID do assunto"),
  arquivar: z.boolean().describe("true para arquivar, false para desarquivar")
}).strict();

const UpdateSubjectStarInputSchema = z.object({
  idAssunto: z.number().int().positive().describe("ID do assunto"),
  estrela: z.boolean().describe("true para marcar com estrela, false para desmarcar")
}).strict();

const ListActionsInputSchema = z.object({
  idAssunto: z.number().int().positive().describe("ID do assunto"),
  tipo: z.string().max(50).optional().describe("Filtrar por tipo de ação"),
  concluida: z.boolean().optional().describe("Filtrar por ações concluídas"),
  ...PaginationSchema.shape,
  response_format: ResponseFormatSchema
}).strict();

const GetActionInputSchema = z.object({
  idAssunto: z.number().int().positive().describe("ID do assunto"),
  idAcao: z.number().int().positive().describe("ID da ação"),
  response_format: ResponseFormatSchema
}).strict();

const CreateActionInputSchema = z.object({
  idAssunto: z.number().int().positive().describe("ID do assunto"),
  titulo: z.string().min(1).max(200).describe("Título da ação"),
  descricao: z.string().max(2000).optional().describe("Descrição"),
  tipo: z.string().max(50).optional().describe("Tipo da ação"),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data da ação")
}).strict();

const UpdateActionInputSchema = z.object({
  idAssunto: z.number().int().positive().describe("ID do assunto"),
  idAcao: z.number().int().positive().describe("ID da ação"),
  titulo: z.string().max(200).optional().describe("Título"),
  descricao: z.string().max(2000).optional().describe("Descrição"),
  concluida: z.boolean().optional().describe("Marcar como concluída")
}).strict();

const DeleteActionInputSchema = z.object({
  idAssunto: z.number().int().positive().describe("ID do assunto"),
  idAcao: z.number().int().positive().describe("ID da ação")
}).strict();

const ListNotesInputSchema = z.object({
  idAssunto: z.number().int().positive().describe("ID do assunto"),
  ...PaginationSchema.shape,
  response_format: ResponseFormatSchema
}).strict();

const CreateNoteInputSchema = z.object({
  idAssunto: z.number().int().positive().describe("ID do assunto"),
  conteudo: z.string().min(1).max(5000).describe("Conteúdo da anotação")
}).strict();

const UpdateNoteInputSchema = z.object({
  idAssunto: z.number().int().positive().describe("ID do assunto"),
  idAnotacao: z.number().int().positive().describe("ID da anotação"),
  conteudo: z.string().min(1).max(5000).describe("Novo conteúdo")
}).strict();

const DeleteNoteInputSchema = z.object({
  idAssunto: z.number().int().positive().describe("ID do assunto"),
  idAnotacao: z.number().int().positive().describe("ID da anotação")
}).strict();

const ListStagesInputSchema = z.object({
  ...PaginationSchema.shape,
  response_format: ResponseFormatSchema
}).strict();

const GetStageInputSchema = z.object({
  idEstagio: z.number().int().positive().describe("ID do estágio"),
  response_format: ResponseFormatSchema
}).strict();

const CreateStageInputSchema = z.object({
  nome: z.string().min(1).max(100).describe("Nome do estágio"),
  ordem: z.number().int().min(0).optional().describe("Ordem de exibição"),
  cor: z.string().max(20).optional().describe("Cor do estágio")
}).strict();

const UpdateStageInputSchema = z.object({
  idEstagio: z.number().int().positive().describe("ID do estágio"),
  nome: z.string().max(100).optional().describe("Nome"),
  ordem: z.number().int().min(0).optional().describe("Ordem"),
  cor: z.string().max(20).optional().describe("Cor")
}).strict();

const SubjectMarkersInputSchema = z.object({
  idAssunto: z.number().int().positive().describe("ID do assunto"),
  response_format: ResponseFormatSchema
}).strict();

const UpdateSubjectMarkersInputSchema = z.object({
  idAssunto: z.number().int().positive().describe("ID do assunto"),
  marcadores: z.array(z.object({
    id: z.number().int().positive(),
    nome: z.string().optional()
  })).describe("Lista de marcadores")
}).strict();

const CreateSubjectMarkersInputSchema = z.object({
  idAssunto: z.number().int().positive().describe("ID do assunto"),
  marcadores: z.array(z.object({
    nome: z.string().min(1).max(100)
  })).min(1).describe("Lista de marcadores")
}).strict();

// ============================================================================
// Formatters
// ============================================================================

function subjectToMarkdown(s: CRMSubject): string {
  return [
    `## ${s.titulo} (ID: ${s.id})`,
    "",
    `- **Valor:** ${formatCurrency(s.valor)}`,
    `- **Data Limite:** ${formatDate(s.dataLimite)}`,
    `- **Estágio:** ${s.idEstagio || "-"}`,
    `- **Contato:** ${s.idContato || "-"}`,
    `- **Responsável:** ${s.idResponsavel || "-"}`,
    `- **Estrela:** ${s.estrela ? "⭐" : "-"}`,
    `- **Arquivado:** ${s.arquivado ? "Sim" : "Não"}`,
    ""
  ].join("\n");
}

function actionToMarkdown(a: CRMAction): string {
  return [
    `### ${a.titulo} (ID: ${a.id})`,
    `- **Tipo:** ${a.tipo || "-"}`,
    `- **Data:** ${formatDate(a.data)}`,
    `- **Concluída:** ${a.concluida ? "Sim" : "Não"}`,
    a.descricao ? `- **Descrição:** ${a.descricao}` : "",
    ""
  ].filter(Boolean).join("\n");
}

function noteToMarkdown(n: CRMNote): string {
  return [
    `### Anotação ID: ${n.id}`,
    `**Data:** ${formatDateTime(n.dataCriacao)}`,
    "",
    n.conteudo,
    ""
  ].join("\n");
}

function stageToMarkdown(s: CRMStage): string {
  return `- ${s.nome} (ID: ${s.id}, Ordem: ${s.ordem || 0})`;
}

// ============================================================================
// Tool Registration
// ============================================================================

export function registerCRMTools(server: McpServer): void {
  // List Subjects
  server.registerTool(
    "tiny_list_crm_subjects",
    {
      title: "Listar Assuntos CRM",
      description: `Lista assuntos (oportunidades/negócios) do CRM.

Filtros: titulo, idContato, idEstagio, idResponsavel, arquivado, período de data limite.`,
      inputSchema: ListSubjectsInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof ListSubjectsInputSchema>) => {
      try {
        const queryParams: Record<string, unknown> = { limit: params.limit, offset: params.offset, orderBy: params.orderBy };
        if (params.titulo) queryParams.titulo = params.titulo;
        if (params.idContato) queryParams.idContato = params.idContato;
        if (params.idEstagio) queryParams.idEstagio = params.idEstagio;
        if (params.idResponsavel) queryParams.idResponsavel = params.idResponsavel;
        if (params.arquivado !== undefined) queryParams.arquivado = params.arquivado;
        if (params.dataInicialLimite) queryParams.dataInicialLimite = params.dataInicialLimite;
        if (params.dataFinalLimite) queryParams.dataFinalLimite = params.dataFinalLimite;

        const response = await apiGet<{ itens: CRMSubject[]; paginacao: { total: number } }>("/crm/assuntos", queryParams);
        const items = response.itens || [];
        const total = response.paginacao?.total || items.length;

        const { text, structured } = formatListResponse("Assuntos CRM", items, total, params.offset, params.response_format, subjectToMarkdown);
        return { content: [{ type: "text", text }], structuredContent: structured };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Get Subject
  server.registerTool(
    "tiny_get_crm_subject",
    {
      title: "Obter Assunto CRM",
      description: `Obtém detalhes de um assunto do CRM.`,
      inputSchema: GetSubjectInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof GetSubjectInputSchema>) => {
      try {
        const subject = await apiGet<CRMSubject>(`/crm/assuntos/${params.idAssunto}`);
        const { text, structured } = formatItemResponse(`Assunto: ${subject.titulo}`, subject, params.response_format, subjectToMarkdown);
        return { content: [{ type: "text", text }], structuredContent: structured };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Create Subject
  server.registerTool(
    "tiny_create_crm_subject",
    {
      title: "Criar Assunto CRM",
      description: `Cria um novo assunto (oportunidade/negócio) no CRM.`,
      inputSchema: CreateSubjectInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (params: z.infer<typeof CreateSubjectInputSchema>) => {
      try {
        const result = await apiPost<{ id: number }>("/crm/assuntos", params);
        return { content: [{ type: "text", text: formatSuccess(`Assunto criado com ID: ${result.id}`) }], structuredContent: toStructuredContent({ id: result.id, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Update Subject
  server.registerTool(
    "tiny_update_crm_subject",
    {
      title: "Atualizar Assunto CRM",
      description: `Atualiza um assunto do CRM.`,
      inputSchema: UpdateSubjectInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof UpdateSubjectInputSchema>) => {
      try {
        const { idAssunto, ...data } = params;
        await apiPut(`/crm/assuntos/${idAssunto}`, data);
        return { content: [{ type: "text", text: formatSuccess(`Assunto ${idAssunto} atualizado`) }], structuredContent: toStructuredContent({ id: idAssunto, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Delete Subject
  server.registerTool(
    "tiny_delete_crm_subject",
    {
      title: "Excluir Assunto CRM",
      description: `Exclui um assunto do CRM.`,
      inputSchema: z.object({ idAssunto: z.number().int().positive() }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true }
    },
    async (params: { idAssunto: number }) => {
      try {
        await apiDelete(`/crm/assuntos/${params.idAssunto}`);
        return { content: [{ type: "text", text: formatSuccess(`Assunto ${params.idAssunto} excluído`) }], structuredContent: toStructuredContent({ id: params.idAssunto, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Archive/Unarchive Subject
  server.registerTool(
    "tiny_archive_crm_subject",
    {
      title: "Arquivar/Desarquivar Assunto",
      description: `Arquiva ou desarquiva um assunto do CRM.`,
      inputSchema: ArchiveSubjectInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof ArchiveSubjectInputSchema>) => {
      try {
        await apiPut(`/crm/assuntos/${params.idAssunto}/arquivar`, { arquivar: params.arquivar });
        const action = params.arquivar ? "arquivado" : "desarquivado";
        return { content: [{ type: "text", text: formatSuccess(`Assunto ${params.idAssunto} ${action}`) }], structuredContent: toStructuredContent({ id: params.idAssunto, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Update Subject Star
  server.registerTool(
    "tiny_update_crm_subject_star",
    {
      title: "Atualizar Estrela do Assunto",
      description: `Marca ou desmarca um assunto com estrela.`,
      inputSchema: UpdateSubjectStarInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof UpdateSubjectStarInputSchema>) => {
      try {
        await apiPut(`/crm/assuntos/${params.idAssunto}/estrela`, { estrela: params.estrela });
        return { content: [{ type: "text", text: formatSuccess(`Estrela do assunto ${params.idAssunto} ${params.estrela ? "marcada" : "desmarcada"}`) }], structuredContent: toStructuredContent({ id: params.idAssunto, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // List Actions
  server.registerTool(
    "tiny_list_crm_actions",
    {
      title: "Listar Ações do Assunto",
      description: `Lista as ações de um assunto do CRM.`,
      inputSchema: ListActionsInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof ListActionsInputSchema>) => {
      try {
        const queryParams: Record<string, unknown> = { limit: params.limit, offset: params.offset };
        if (params.tipo) queryParams.tipo = params.tipo;
        if (params.concluida !== undefined) queryParams.concluida = params.concluida;

        const response = await apiGet<{ itens: CRMAction[]; paginacao: { total: number } }>(`/crm/assuntos/${params.idAssunto}/acoes`, queryParams);
        const items = response.itens || [];
        const total = response.paginacao?.total || items.length;

        const { text, structured } = formatListResponse(`Ações do Assunto ${params.idAssunto}`, items, total, params.offset, params.response_format, actionToMarkdown);
        return { content: [{ type: "text", text }], structuredContent: structured };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Get Action
  server.registerTool(
    "tiny_get_crm_action",
    {
      title: "Obter Ação do Assunto",
      description: `Obtém detalhes de uma ação.`,
      inputSchema: GetActionInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof GetActionInputSchema>) => {
      try {
        const action = await apiGet<CRMAction>(`/crm/assuntos/${params.idAssunto}/acoes/${params.idAcao}`);
        const { text, structured } = formatItemResponse(`Ação: ${action.titulo}`, action, params.response_format, actionToMarkdown);
        return { content: [{ type: "text", text }], structuredContent: structured };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Create Action
  server.registerTool(
    "tiny_create_crm_action",
    {
      title: "Criar Ação do Assunto",
      description: `Cria uma nova ação para um assunto.`,
      inputSchema: CreateActionInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (params: z.infer<typeof CreateActionInputSchema>) => {
      try {
        const { idAssunto, ...data } = params;
        const result = await apiPost<{ id: number }>(`/crm/assuntos/${idAssunto}/acoes`, data);
        return { content: [{ type: "text", text: formatSuccess(`Ação criada com ID: ${result.id}`) }], structuredContent: toStructuredContent({ idAssunto, id: result.id, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Update Action
  server.registerTool(
    "tiny_update_crm_action",
    {
      title: "Atualizar Ação do Assunto",
      description: `Atualiza uma ação de um assunto.`,
      inputSchema: UpdateActionInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof UpdateActionInputSchema>) => {
      try {
        const { idAssunto, idAcao, ...data } = params;
        await apiPut(`/crm/assuntos/${idAssunto}/acoes/${idAcao}`, data);
        return { content: [{ type: "text", text: formatSuccess(`Ação ${idAcao} atualizada`) }], structuredContent: toStructuredContent({ idAssunto, idAcao, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Delete Action
  server.registerTool(
    "tiny_delete_crm_action",
    {
      title: "Excluir Ação do Assunto",
      description: `Exclui uma ação de um assunto.`,
      inputSchema: DeleteActionInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof DeleteActionInputSchema>) => {
      try {
        await apiDelete(`/crm/assuntos/${params.idAssunto}/acoes/${params.idAcao}`);
        return { content: [{ type: "text", text: formatSuccess(`Ação ${params.idAcao} excluída`) }], structuredContent: toStructuredContent({ idAssunto: params.idAssunto, idAcao: params.idAcao, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // List Notes
  server.registerTool(
    "tiny_list_crm_notes",
    {
      title: "Listar Anotações do Assunto",
      description: `Lista as anotações de um assunto do CRM.`,
      inputSchema: ListNotesInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof ListNotesInputSchema>) => {
      try {
        const response = await apiGet<{ itens: CRMNote[]; paginacao: { total: number } }>(`/crm/assuntos/${params.idAssunto}/anotacoes`, { limit: params.limit, offset: params.offset });
        const items = response.itens || [];
        const total = response.paginacao?.total || items.length;

        const { text, structured } = formatListResponse(`Anotações do Assunto ${params.idAssunto}`, items, total, params.offset, params.response_format, noteToMarkdown);
        return { content: [{ type: "text", text }], structuredContent: structured };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Create Note
  server.registerTool(
    "tiny_create_crm_note",
    {
      title: "Criar Anotação do Assunto",
      description: `Adiciona uma anotação a um assunto do CRM.`,
      inputSchema: CreateNoteInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (params: z.infer<typeof CreateNoteInputSchema>) => {
      try {
        const { idAssunto, ...data } = params;
        const result = await apiPost<{ id: number }>(`/crm/assuntos/${idAssunto}/anotacoes`, data);
        return { content: [{ type: "text", text: formatSuccess(`Anotação criada com ID: ${result.id}`) }], structuredContent: toStructuredContent({ idAssunto, id: result.id, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Update Note
  server.registerTool(
    "tiny_update_crm_note",
    {
      title: "Atualizar Anotação do Assunto",
      description: `Atualiza uma anotação de um assunto.`,
      inputSchema: UpdateNoteInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof UpdateNoteInputSchema>) => {
      try {
        const { idAssunto, idAnotacao, ...data } = params;
        await apiPut(`/crm/assuntos/${idAssunto}/anotacoes/${idAnotacao}`, data);
        return { content: [{ type: "text", text: formatSuccess(`Anotação ${idAnotacao} atualizada`) }], structuredContent: toStructuredContent({ idAssunto, idAnotacao, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Delete Note
  server.registerTool(
    "tiny_delete_crm_note",
    {
      title: "Excluir Anotação do Assunto",
      description: `Exclui uma anotação de um assunto.`,
      inputSchema: DeleteNoteInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof DeleteNoteInputSchema>) => {
      try {
        await apiDelete(`/crm/assuntos/${params.idAssunto}/anotacoes/${params.idAnotacao}`);
        return { content: [{ type: "text", text: formatSuccess(`Anotação ${params.idAnotacao} excluída`) }], structuredContent: toStructuredContent({ idAssunto: params.idAssunto, idAnotacao: params.idAnotacao, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // List Stages
  server.registerTool(
    "tiny_list_crm_stages",
    {
      title: "Listar Estágios CRM",
      description: `Lista os estágios do funil de vendas do CRM.`,
      inputSchema: ListStagesInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof ListStagesInputSchema>) => {
      try {
        const response = await apiGet<{ itens: CRMStage[]; paginacao: { total: number } }>("/crm/estagios", { limit: params.limit, offset: params.offset });
        const items = response.itens || [];
        const total = response.paginacao?.total || items.length;

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify({ items, total }, null, 2) }], structuredContent: toStructuredContent({ items, total }) };
        }

        const lines = ["# Estágios CRM", "", `**Total:** ${total}`, "", ...items.map(stageToMarkdown)];
        return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: toStructuredContent({ items, total }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Get Stage
  server.registerTool(
    "tiny_get_crm_stage",
    {
      title: "Obter Estágio CRM",
      description: `Obtém detalhes de um estágio do CRM.`,
      inputSchema: GetStageInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof GetStageInputSchema>) => {
      try {
        const stage = await apiGet<CRMStage>(`/crm/estagios/${params.idEstagio}`);
        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify(stage, null, 2) }], structuredContent: toStructuredContent(stage) };
        }
        return { content: [{ type: "text", text: `# Estágio: ${stage.nome}\n\n- **ID:** ${stage.id}\n- **Ordem:** ${stage.ordem || 0}\n- **Cor:** ${stage.cor || "-"}` }], structuredContent: toStructuredContent(stage) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Create Stage
  server.registerTool(
    "tiny_create_crm_stage",
    {
      title: "Criar Estágio CRM",
      description: `Cria um novo estágio no funil do CRM.`,
      inputSchema: CreateStageInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (params: z.infer<typeof CreateStageInputSchema>) => {
      try {
        const result = await apiPost<{ id: number }>("/crm/estagios", params);
        return { content: [{ type: "text", text: formatSuccess(`Estágio criado com ID: ${result.id}`) }], structuredContent: toStructuredContent({ id: result.id, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Update Stage
  server.registerTool(
    "tiny_update_crm_stage",
    {
      title: "Atualizar Estágio CRM",
      description: `Atualiza um estágio do CRM.`,
      inputSchema: UpdateStageInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof UpdateStageInputSchema>) => {
      try {
        const { idEstagio, ...data } = params;
        await apiPut(`/crm/estagios/${idEstagio}`, data);
        return { content: [{ type: "text", text: formatSuccess(`Estágio ${idEstagio} atualizado`) }], structuredContent: toStructuredContent({ id: idEstagio, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Delete Stage
  server.registerTool(
    "tiny_delete_crm_stage",
    {
      title: "Excluir Estágio CRM",
      description: `Exclui um estágio do CRM.`,
      inputSchema: z.object({ idEstagio: z.number().int().positive() }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true }
    },
    async (params: { idEstagio: number }) => {
      try {
        await apiDelete(`/crm/estagios/${params.idEstagio}`);
        return { content: [{ type: "text", text: formatSuccess(`Estágio ${params.idEstagio} excluído`) }], structuredContent: toStructuredContent({ id: params.idEstagio, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Subject Markers
  server.registerTool(
    "tiny_get_crm_subject_markers",
    {
      title: "Obter Marcadores do Assunto",
      description: `Obtém os marcadores de um assunto do CRM.`,
      inputSchema: SubjectMarkersInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof SubjectMarkersInputSchema>) => {
      try {
        const markers = await apiGet<Array<{ id: number; nome: string }>>(`/crm/assuntos/${params.idAssunto}/marcadores`);
        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify(markers, null, 2) }], structuredContent: toStructuredContent({ items: markers }) };
        }
        const lines = [`# Marcadores do Assunto ${params.idAssunto}`, "", markers.length > 0 ? markers.map(m => `- ${m.nome} (ID: ${m.id})`).join("\n") : "Nenhum marcador"];
        return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: toStructuredContent({ items: markers }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_update_crm_subject_markers",
    {
      title: "Atualizar Marcadores do Assunto",
      description: `Atualiza os marcadores de um assunto.`,
      inputSchema: UpdateSubjectMarkersInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params: z.infer<typeof UpdateSubjectMarkersInputSchema>) => {
      try {
        await apiPut(`/crm/assuntos/${params.idAssunto}/marcadores`, params.marcadores);
        return { content: [{ type: "text", text: formatSuccess(`Marcadores do assunto ${params.idAssunto} atualizados`) }], structuredContent: toStructuredContent({ id: params.idAssunto, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_create_crm_subject_markers",
    {
      title: "Criar Marcadores do Assunto",
      description: `Adiciona novos marcadores a um assunto.`,
      inputSchema: CreateSubjectMarkersInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (params: z.infer<typeof CreateSubjectMarkersInputSchema>) => {
      try {
        await apiPost(`/crm/assuntos/${params.idAssunto}/marcadores`, params.marcadores);
        return { content: [{ type: "text", text: formatSuccess(`Marcadores adicionados ao assunto ${params.idAssunto}`) }], structuredContent: toStructuredContent({ id: params.idAssunto, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "tiny_delete_crm_subject_markers",
    {
      title: "Excluir Marcadores do Assunto",
      description: `Remove todos os marcadores de um assunto.`,
      inputSchema: z.object({ idAssunto: z.number().int().positive() }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true }
    },
    async (params: { idAssunto: number }) => {
      try {
        await apiDelete(`/crm/assuntos/${params.idAssunto}/marcadores`);
        return { content: [{ type: "text", text: formatSuccess(`Marcadores do assunto ${params.idAssunto} removidos`) }], structuredContent: toStructuredContent({ id: params.idAssunto, success: true }) };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
