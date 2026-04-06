
/**
 * Research document interface that matches the database schema
 */
export interface ResearchDocument {
  id: number;
  title: string;
  slug: string;
  summary: string;
  excerpt?: string; // Client-side convenience alias for summary
  content: string;
  authors: string; // Stored as text in DB, parsed to array if necessary
  imageUrls?: string[]; // Matches the DB column name
  thumbnailUrl?: string; // Client-side convenience alias for first imageUrl
  publishedAt: string;
  updatedAt?: string;
  tags: string[];
}

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  thumbnailUrl: string;
  publishedAt: string;
  slug: string;
  updatedAt?: string;
}