export type AiJobRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  type: string;
  status: string;
  input: Record<string, unknown>;
  credits_cost: number;
  attempts: number;
  provider_request_id: string | null;
};

export type RenderJobRow = {
  id: string;
  user_id: string;
  project_id: string;
  status: string;
  settings: unknown;
  timeline_snapshot: unknown;
  credits_cost: number;
  attempts: number;
};
