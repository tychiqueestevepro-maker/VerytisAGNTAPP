export type Status = "actif" | "planifie" | "en_attente" | "connecte" | "termine" | "erreur";

export type Organization = {
  id: string;
  name: string;
  plan: "premium" | "enterprise";
};

export type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  organizationId: string;
  role: "proprietaire" | "admin" | "membre";
};

export type Agent = {
  id: string;
  name: string;
  status: Status;
  lastRun: string;
  actionsToday: number;
};

export type Activity = {
  id: string;
  time: string;
  label: string;
  type: "lead" | "message" | "document" | "sync" | "agent";
};

export type DocumentItem = {
  id: string;
  title: string;
  type: "rapport" | "proposition" | "synthese";
  createdAt: string;
  status: Status;
};

export type Integration = {
  id: string;
  name: "Gmail" | "LinkedIn" | "CRM" | "Google Sheets";
  status: Status;
};
