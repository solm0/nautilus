export type User = {
  id: number
  email: string
  name: string
}

// breadcrumb
export interface TreeNode {
  lemma: string;
  children?: TreeNode[];
}

export type Comment = {
  id: number;
  parent_id: number | null;
  content: string;
  deleted: boolean;
  created_at: string;

  user: User;

  annotation_id: number;
  deleted_at: string;
};