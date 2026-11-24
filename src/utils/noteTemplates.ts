import { LanguageCode } from '../types';
import { NoteAccentColor, NoteBlock, NoteTable, createBlockId } from '../hooks/useNotes';

export type NoteTemplateId =
  | 'blank'
  | 'study'
  | 'recipe'
  | 'shopping'
  | 'weekly_plan'
  | 'report';

export interface NoteTemplateDef {
  id: NoteTemplateId;
  emoji: string;
  labelPt: string;
  labelEs: string;
  descPt: string;
  descEs: string;
  accentColor: NoteAccentColor;
}

export const NOTE_TEMPLATES: NoteTemplateDef[] = [
  {
    id: 'blank',
    emoji: '📄',
    labelPt: 'Nota em branco',
    labelEs: 'Nota en blanco',
    descPt: 'Folha limpa pronta para escrever',
    descEs: 'Hoja limpia lista para escribir',
    accentColor: 'none',
  },
  {
    id: 'study',
    emoji: '📚',
    labelPt: 'Anotações de estudo',
    labelEs: 'Apuntes de estudio',
    descPt: 'Tópicos, resumo, citação e revisão',
    descEs: 'Temas, resumen, cita y repaso',
    accentColor: 'sky',
  },
  {
    id: 'recipe',
    emoji: '🍳',
    labelPt: 'Receita',
    labelEs: 'Receta',
    descPt: 'Ingredientes em checklist e preparo',
    descEs: 'Ingredientes en checklist y pasos',
    accentColor: 'amber',
  },
  {
    id: 'shopping',
    emoji: '🛒',
    labelPt: 'Lista de compras',
    labelEs: 'Lista de compras',
    descPt: 'Itens interativos por seção',
    descEs: 'Ítems interactivos por sección',
    accentColor: 'emerald',
  },
  {
    id: 'weekly_plan',
    emoji: '🗓️',
    labelPt: 'Planejamento semanal',
    labelEs: 'Planificación semanal',
    descPt: 'Prioridades da semana e metas',
    descEs: 'Prioridades de la semana y metas',
    accentColor: 'violet',
  },
  {
    id: 'report',
    emoji: '📊',
    labelPt: 'Relatório',
    labelEs: 'Informe',
    descPt: 'Resumo executivo, tabela e conclusões',
    descEs: 'Resumen ejecutivo, tabla y conclusiones',
    accentColor: 'teal',
  },
];

export function buildNoteFromTemplate(
  templateId: NoteTemplateId,
  language: LanguageCode = 'pt'
): {
  title: string;
  blocks: NoteBlock[];
  tables: NoteTable[];
  tags: string[];
  accentColor: NoteAccentColor;
} {
  const isEs = language === 'es';
  const blk = (type: NoteBlock['type'], html: string, checked?: boolean): NoteBlock => ({
    id: createBlockId(),
    type,
    html,
    ...(type === 'checklist' ? { checked: Boolean(checked) } : {}),
  });

  switch (templateId) {
    case 'study':
      return {
        title: isEs ? 'Apuntes de estudio' : 'Anotações de estudo',
        tags: [isEs ? 'Estudios' : 'Estudos'],
        accentColor: 'sky',
        tables: [],
        blocks: [
          blk('subheading', isEs ? 'Tema principal' : 'Tema principal'),
          blk('paragraph', isEs ? 'Escribe aquí el resumen general de la clase o lectura.' : 'Escreva aqui o resumo geral da aula ou leitura.'),
          blk('subheading', isEs ? 'Puntos clave' : 'Pontos-chave'),
          blk('bullet', isEs ? 'Concepto importante 1' : 'Conceito importante 1'),
          blk('bullet', isEs ? 'Concepto importante 2' : 'Conceito importante 2'),
          blk('quote', isEs ? 'Cita o definición para recordar.' : 'Citação ou definição importante para lembrar.'),
          blk('subheading', isEs ? 'Pendientes de repaso' : 'Checklist de revisão'),
          blk('checklist', isEs ? 'Revisar ejercicios' : 'Revisar exercícios', false),
          blk('checklist', isEs ? 'Hacer resumen final' : 'Fazer resumo final', false),
        ],
      };

    case 'recipe':
      return {
        title: isEs ? 'Nueva receta' : 'Nova receita',
        tags: [isEs ? 'Recetas' : 'Receitas'],
        accentColor: 'amber',
        tables: [],
        blocks: [
          blk('quote', isEs ? 'Tiempo de preparación: 30 min • Porciones: 4' : 'Tempo de preparo: 30 min • Rendimento: 4 porções'),
          blk('subheading', isEs ? 'Ingredientes' : 'Ingredientes'),
          blk('checklist', isEs ? 'Ingrediente 1' : 'Ingrediente 1', false),
          blk('checklist', isEs ? 'Ingrediente 2' : 'Ingrediente 2', false),
          blk('checklist', isEs ? 'Ingrediente 3' : 'Ingrediente 3', false),
          blk('subheading', isEs ? 'Modo de preparación' : 'Modo de preparo'),
          blk('numbered', isEs ? 'Preparar los ingredientes base.' : 'Separe e prepare os ingredientes base.'),
          blk('numbered', isEs ? 'Mezclar y cocinar hasta el punto ideal.' : 'Misture e leve ao fogo até o ponto ideal.'),
          blk('subheading', isEs ? 'Notas personales' : 'Dicas pessoais'),
          blk('paragraph', ''),
        ],
      };

    case 'shopping':
      return {
        title: isEs ? 'Lista de compras' : 'Lista de compras',
        tags: [isEs ? 'Compras' : 'Compras'],
        accentColor: 'emerald',
        tables: [],
        blocks: [
          blk('subheading', isEs ? 'Mercado / Esenciales' : 'Mercado / Essenciais'),
          blk('checklist', isEs ? 'Frutas y verduras' : 'Frutas e verduras', false),
          blk('checklist', isEs ? 'Lácteos y huevos' : 'Laticínios e ovos', false),
          blk('checklist', isEs ? 'Pan y café' : 'Pão e café', false),
          blk('subheading', isEs ? 'Casa y limpieza' : 'Casa e limpeza'),
          blk('checklist', isEs ? 'Productos de higiene' : 'Itens de higiene', false),
          blk('checklist', '', false),
        ],
      };

    case 'weekly_plan':
      return {
        title: isEs ? 'Planificación semanal' : 'Planejamento semanal',
        tags: [isEs ? 'Semana' : 'Semana'],
        accentColor: 'violet',
        tables: [],
        blocks: [
          blk('subheading', isEs ? 'Foco principal de la semana' : 'Foco principal da semana'),
          blk('quote', isEs ? '¿Qué haría que esta semana sea un éxito?' : 'O que tornaria esta semana excelente?'),
          blk('subheading', isEs ? 'Prioridades' : 'Prioridades'),
          blk('checklist', isEs ? 'Prioridad 1' : 'Prioridade 1', false),
          blk('checklist', isEs ? 'Prioridad 2' : 'Prioridade 2', false),
          blk('checklist', isEs ? 'Prioridad 3' : 'Prioridade 3', false),
          blk('subheading', isEs ? 'Notas y recordatorios' : 'Anotações e ideias'),
          blk('bullet', ''),
        ],
      };

    case 'report':
      return {
        title: isEs ? 'Informe' : 'Relatório',
        tags: [isEs ? 'Trabajo' : 'Relatório'],
        accentColor: 'teal',
        tables: [
          {
            id: `ntbl_${Date.now()}`,
            headers: isEs ? ['Ítem', 'Estado', 'Observación'] : ['Item', 'Status', 'Observação'],
            rows: [
              ['', '', ''],
              ['', '', ''],
            ],
          },
        ],
        blocks: [
          blk('subheading', isEs ? 'Resumen ejecutivo' : 'Resumo executivo'),
          blk('paragraph', isEs ? 'Describe brevemente el objetivo y los resultados principales.' : 'Descreva brevemente o objetivo e os principais resultados.'),
          blk('subheading', isEs ? 'Conclusiones y próximos pasos' : 'Conclusões e próximos passos'),
          blk('checklist', isEs ? 'Acción 1' : 'Ação 1', false),
          blk('checklist', isEs ? 'Acción 2' : 'Ação 2', false),
        ],
      };

    case 'blank':
    default:
      return {
        title: '',
        tags: [],
        accentColor: 'none',
        tables: [],
        blocks: [blk('paragraph', '')],
      };
  }
}
