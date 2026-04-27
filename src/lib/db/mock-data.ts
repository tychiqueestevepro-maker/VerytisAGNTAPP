import type {
  Activity,
  Agent,
  DocumentItem,
  Integration,
  Organization,
  User,
} from "@/types/models";

export const organizations: Organization[] = [
  { id: "org_1", name: "Maison Veritis", plan: "enterprise" },
];

export const activities: Activity[] = [
  { id: "act_1", time: "14:32", label: "Rapport hebdomadaire généré", type: "document" },
  { id: "act_2", time: "13:15", label: "Agent qualification terminé", type: "agent" },
  { id: "act_3", time: "11:02", label: "Synchronisation Gmail effectuée", type: "sync" },
  { id: "act_4", time: "09:45", label: "12 leads ajoutés", type: "lead" },
];

export const documents: DocumentItem[] = [
  { id: "doc_1", title: "Rapport hebdomadaire", type: "rapport", createdAt: "aujourd'hui", status: "termine" },
  { id: "doc_2", title: "Synthèse prospects", type: "synthese", createdAt: "hier", status: "termine" },
  { id: "doc_3", title: "Proposition commerciale", type: "proposition", createdAt: "il y a 3j", status: "en_attente" },
];

export const integrations: Integration[] = [
  { id: "int_1", name: "Gmail", status: "connecte" },
  { id: "int_2", name: "LinkedIn", status: "connecte" },
  { id: "int_3", name: "CRM", status: "en_attente" },
  { id: "int_4", name: "Google Sheets", status: "connecte" },
];

export const dashboardMetrics = {
  agentStatus: "Actif",
  connectedTools: 3,
  actionsToday: 48,
  documentsGenerated: 4,
  activity: [
    "12 leads traités",
    "34 messages générés",
    "5 conversations lancées",
    "4 documents créés",
  ],
};
