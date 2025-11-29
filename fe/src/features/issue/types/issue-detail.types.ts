export interface IssueDetail {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  project_id: string;
  assignee_id?: string;
  reporter_id: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
  assignee?: {
    id: string;
    name: string;
    avatar_url?: string;
  };
  reporter?: {
    id: string;
    name: string;
    avatar_url?: string;
  };
  labels?: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  subtasks?: Array<{
    id: string;
    issue_id: string;
    title: string;
    completed: boolean;
    position: number;
    created_at: string;
    updated_at: string;
  }>;
  change_history?: Array<{
    id: string;
    issue_id: string;
    actor_id: string;
    field_name: string;
    old_value?: string;
    new_value?: string;
    created_at: string;
    actor?: {
      id: string;
      name: string;
      avatar_url?: string;
    };
  }>;
}

