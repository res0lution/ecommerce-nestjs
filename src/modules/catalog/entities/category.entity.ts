export interface CategoryEntity {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  level: number;
}
