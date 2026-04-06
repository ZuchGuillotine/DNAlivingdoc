
import { Fragment } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import LandingHeader from "@/components/landing-header";
import Footer from "@/components/footer";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Loader2 } from "lucide-react";
import type { ResearchDocument } from "@/lib/types";

const DOCS_PER_PAGE = 6;

export default function ResearchPage() {
  const page = 1; // TODO: Get from URL params

  const { data: documents = [], isLoading } = useQuery<ResearchDocument[]>({
    queryKey: ['/api/research'],
    queryFn: async () => {
      const res = await fetch('/api/research');
      if (!res.ok) throw new Error('Failed to fetch research documents');
      return res.json();
    }
  });

  const startIndex = (page - 1) * DOCS_PER_PAGE;
  const paginatedDocuments = documents.slice(startIndex, startIndex + DOCS_PER_PAGE);
  const totalPages = Math.ceil(documents.length / DOCS_PER_PAGE);

  if (isLoading) {
    return (
      <Fragment>
        <LandingHeader />
        <main className="container mx-auto py-12 px-4">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </main>
        <Footer />
      </Fragment>
    );
  }

  return (
    <Fragment>
      <LandingHeader />
      <main className="container mx-auto py-12 px-4">
        <h1 className="text-4xl font-bold mb-8 text-primary">Research</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedDocuments.map((document) => (
            <article key={document.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              {document.thumbnailUrl && (
                <img 
                  src={document.thumbnailUrl} 
                  alt={document.title}
                  className="w-full h-48 object-cover"
                />
              )}
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-2">
                  <Link href={`/research/${document.slug}`} className="text-primary hover:underline">
                    {document.title}
                  </Link>
                </h2>
                <p className="text-gray-600 mb-4">{document.excerpt || document.summary}</p>
                <time className="text-sm text-gray-500">
                  {new Date(document.publishedAt).toLocaleDateString()}
                </time>
              </div>
            </article>
          ))}
        </div>

        {totalPages > 1 && (
          <Pagination className="mt-8">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious href="#" />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext href="#" />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </main>
      <Footer />
    </Fragment>
  );
}
