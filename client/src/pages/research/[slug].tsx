
import { Fragment } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import LandingHeader from "@/components/landing-header";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Loader2 } from "lucide-react";
import type { ResearchDocument } from "@/lib/types";

export default function ResearchDocumentPage() {
  const [, params] = useRoute("/research/:slug");
  const slug = params?.slug;

  const { data: document, isLoading, error } = useQuery<ResearchDocument>({
    queryKey: ['/api/research', slug],
    queryFn: async () => {
      if (!slug) throw new Error('No slug provided');
      const res = await fetch(`/api/research/${slug}`);
      if (!res.ok) throw new Error('Failed to fetch research document');
      return res.json();
    },
    enabled: !!slug
  });

  if (isLoading) {
    return (
      <Fragment>
        <LandingHeader />
        <div className="container mx-auto py-10 max-w-4xl">
          <Link href="/research">
            <Button variant="ghost" className="mb-6">
              <ChevronLeft className="mr-2 h-4 w-4" /> Back to Research
            </Button>
          </Link>
          
          <Card>
            <CardContent className="pt-6">
              <Skeleton className="h-8 w-3/4 mb-3" />
              <Skeleton className="h-4 w-1/2 mb-1" />
              <Skeleton className="h-4 w-1/3 mb-6" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        </div>
        <Footer />
      </Fragment>
    );
  }

  if (error || !document) {
    return (
      <Fragment>
        <LandingHeader />
        <div className="container mx-auto py-10 max-w-4xl">
          <Link href="/research">
            <Button variant="ghost" className="mb-6">
              <ChevronLeft className="mr-2 h-4 w-4" /> Back to Research
            </Button>
          </Link>
          
          <Card className="p-6 bg-red-50 border-red-200">
            <h2 className="text-red-700 text-xl font-semibold mb-4">Document Not Found</h2>
            <p className="text-red-600">
              We couldn't find the research document you're looking for. It may have been removed or the URL might be incorrect.
            </p>
          </Card>
        </div>
        <Footer />
      </Fragment>
    );
  }

  return (
    <Fragment>
      <LandingHeader />
      <main className="container mx-auto py-12 px-4 max-w-4xl">
        <Link href="/research">
          <Button variant="ghost" className="mb-6">
            <ChevronLeft className="mr-2 h-4 w-4" /> Back to Research
          </Button>
        </Link>
        
        <article className="prose prose-lg mx-auto">
          {document.thumbnailUrl && (
            <img 
              src={document.thumbnailUrl}
              alt={document.title}
              className="w-full h-[400px] object-cover rounded-lg mb-8"
            />
          )}
          <h1 className="text-4xl font-bold mb-4 text-primary">{document.title}</h1>
          {document.authors && document.authors.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {document.authors.map((author, index) => (
                <span key={index} className="text-sm bg-primary-100 text-primary-800 px-2 py-1 rounded">
                  {author}
                </span>
              ))}
            </div>
          )}
          <time className="text-gray-500 block mb-8">
            {new Date(document.publishedAt).toLocaleDateString()}
          </time>
          <div dangerouslySetInnerHTML={{ __html: document.content }} />
        </article>
      </main>
      <Footer />
    </Fragment>
  );
}
