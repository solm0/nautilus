export type User = {
  id: number
  email: string
  name: string
}

export type TimelineItem = {
  id: string;
  content: string;
  created_at: string;
  user?: User;
  page_id: string;
  page_name: string;
  source: string;
  type?: "link" | "memo" | "emoji";
};

// breadcrumb
export interface TreeNode {
  lemma: string;
  children?: TreeNode[];
}
