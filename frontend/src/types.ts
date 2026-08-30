export type User = {
  id: number
  email: string
  name: string
}

export type TimelineItem = {
  id: number;
  content: string;
  created_at: string;
  pending_sync?: boolean;
  user?: User;
  page_id: number;
  page_name: string;
  source: string;
  type?: "link" | "memo" | "emoji";
};

// breadcrumb
export interface TreeNode {
  lemma: string;
  children?: TreeNode[];
}
