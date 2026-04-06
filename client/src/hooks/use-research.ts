
import { useQuery } from '@tanstack/react-query';

export interface ResearchDocument {
  id: number;
  title: string;
  slug: string;
  summary: string;
  content: string;
  authors: string[];
  imageUrls?: string[];
  tags?: string[];
  publishedAt: string;
  updatedAt?: string;
}

export function useResearchDocuments() {
  return useQuery<ResearchDocument[]>({
    queryKey: ['/api/research'],
    queryFn: async () => {
      const res = await fetch('/api/research');
      if (!res.ok) throw new Error('Failed to fetch research documents');
      return res.json();
    },
    suspense: false, // Important: Disable suspense to prevent synchronous rendering errors
    refetchOnWindowFocus: false,
  });
}

export function useResearchDocument(slug: string | null) {
  return useQuery<ResearchDocument>({
    queryKey: ['/api/research', slug],
    queryFn: async () => {
      if (!slug) throw new Error('No slug provided');
      const res = await fetch(`/api/research/${slug}`);
      if (!res.ok) throw new Error('Failed to fetch research document');
      return res.json();
    },
    enabled: !!slug, // Only run query when slug is available
    suspense: false, // Important: Disable suspense to prevent synchronous rendering errors
    refetchOnWindowFocus: false,
  });
}
