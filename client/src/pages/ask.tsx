
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@/hooks/use-query";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import Header from "@/components/header";
import LandingHeader from "@/components/landing-header";
import Footer from "@/components/footer";
import { Spinner } from "@/components/ui/spinner";
import LimitReachedNotification from "@/components/ui/LimitReachedNotification";

export default function AskPage() {
  const [inputValue, setInputValue] = useState("");
  const { sendQuery, messages, isLoading, error, resetChat, limitReached, resetLimitReached } = useQuery();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  useEffect(() => {
    if (chatContainerRef.current) {
      const container = chatContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() === "" || isLoading) return;
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    try {
      await sendQuery(inputValue);
      setInputValue("");
    } catch (error) {
      console.error('Query submission error:', error);
    }
  };
  
  const { user } = useUser();
  
  return (
    <div className="min-h-screen flex flex-col">
      {user ? <Header /> : <LandingHeader />}
      
      <main className="flex-grow bg-white dark:bg-gray-950 p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          {limitReached && (
            <LimitReachedNotification onClose={resetLimitReached} />
          )}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Ask About Supplements
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Ask any supplement-related questions and get personalized answers based on scientific research.
            </p>
          </div>
          
          <div 
            ref={chatContainerRef}
            className="border rounded-lg p-4 mb-4 h-[60vh] overflow-y-auto bg-gray-50 dark:bg-gray-900"
          >
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Welcome to the StackTracker Assistant
                </h3>
                <p className="text-gray-500 dark:text-gray-500 max-w-md mx-auto">
                  Ask any questions about supplements, their effects, or how they might interact with your current regimen.
                </p>
              </div>
            ) : (
              messages.map((message, index) => (
                message.role !== "system" && (
                  <div 
                    key={index} 
                    className={`mb-4 ${
                      message.role === "user" 
                        ? "bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500" 
                        : "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500"
                    } p-3 rounded`}
                  >
                    <p className="font-semibold mb-1">
                      {message.role === "user" ? (user?.username || "You") : "Your ST AI"}:
                    </p>
                    <div className="whitespace-pre-wrap">
                      {message.content}
                      {isLoading && index === messages.length - 1 && message.role === "assistant" && "▋"}
                    </div>
                  </div>
                )
              ))
            )}
            
            {isLoading && messages.length === 0 && (
              <div className="flex justify-center items-center py-4">
                <Spinner className="h-6 w-6 text-green-600" />
                <span className="ml-2 text-gray-600 dark:text-gray-400">Thinking...</span>
              </div>
            )}
            
            {error && (
              <div className="bg-red-100 dark:bg-red-900/20 border-l-4 border-red-500 p-3 rounded mb-4">
                <p className="font-semibold mb-1">Error:</p>
                <p>{error}</p>
              </div>
            )}
          </div>
          
          <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-2">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask about supplements, interactions, or health advice..."
              className="flex-grow resize-none dark:bg-gray-900"
              rows={2}
            />
            <div className="flex flex-col gap-2">
              <Button 
                type="submit"
                disabled={isLoading || inputValue.trim() === ""}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isLoading ? <Spinner className="h-4 w-4 mr-2" /> : null}
                Send
              </Button>
              <Button 
                type="button"
                variant="outline" 
                onClick={resetChat}
                className="border-gray-300 dark:border-gray-700"
              >
                Clear Chat
              </Button>
            </div>
          </form>
          
          <div className="mt-8 text-sm text-gray-500 dark:text-gray-400">
            <p>
              This is an AI assistant designed to provide general information about supplements.
              Information provided is not medical advice. Always consult with a healthcare
              professional before starting any new supplement regimen.
            </p>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
