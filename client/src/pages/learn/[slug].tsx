import { Fragment } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import LandingHeader from "@/components/landing-header";
import Footer from "@/components/footer";
import { Loader2 } from "lucide-react";
import type { BlogPost } from "@/lib/types";

export default function BlogPostPage() {
  const [, params] = useRoute("/learn/:slug");
  const slug = params?.slug;

  const { data: post, isLoading } = useQuery<BlogPost>({
    queryKey: ['/api/blog', slug],
    queryFn: async () => {
      const res = await fetch(`/api/blog/${slug}`);
      if (!res.ok) throw new Error('Failed to fetch post');
      return res.json();
    },
    enabled: !!slug
  });

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

  if (!post) {
    return (
      <Fragment>
        <LandingHeader />
        <main className="container mx-auto py-12 px-4">
          <h1 className="text-4xl font-bold mb-8">Post not found</h1>
        </main>
        <Footer />
      </Fragment>
    );
  }

  return (
    <Fragment>
      <LandingHeader />
      <main className="container mx-auto py-12 px-4 max-w-4xl">
        <article className="prose prose-lg mx-auto">
          <img 
            src={post.thumbnailUrl}
            alt={post.title}
            className="w-full h-[400px] object-cover rounded-lg mb-8"
          />
          <h1 className="text-4xl font-bold mb-4 text-primary">{post.title}</h1>
          <time className="text-gray-500 block mb-8">
            {new Date(post.publishedAt).toLocaleDateString()}
          </time>
          <div dangerouslySetInnerHTML={{ __html: post.content }} />
        </article>
      </main>
      <Footer />
    </Fragment>
  );
}