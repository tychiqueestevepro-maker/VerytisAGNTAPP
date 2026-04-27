export type FlowStatus = 'setup_required' | 'active' | 'paused' | 'disabled';

export interface ClientFlow {
  id: string;
  client_id: string;
  flow_key: string;
  display_name: string;
  description: string | null;
  status: FlowStatus;
  route: string;
  config: any;
  workflow_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStepWithAgent {
  id: string;
  workflow_id: string;
  agent_id: string;
  step_order: number;
  name: string;
  description: string | null;
  input_status: string;
  success_status: string;
  failure_status: string;
  is_active: boolean;
  retry_limit: number;
  timeout_seconds: number | null;
  config: any;
  agent_name: string;
  agent_slug: string;
  agent_role: string;
  agent_description: string | null;
}
