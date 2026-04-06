import { useState } from "react";
import { Message } from "@/lib/types";

export interface QueryResult {
  response: string;
  error?: string;
  limitReached?: boolean;
  streaming?: boolean;
}

export function useQuery() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  const sendQuery = async (query: string, onStream?: (chunk: string) => void) => {
    try {
      setIsLoading(true);
      setError(null);

      // Add user message to the chat
      const newUserMessage: Message = { role: "user", content: query };
      const updatedMessages = [...messages, newUserMessage];
      setMessages(updatedMessages);

      // Send query to API
      const response = await fetch("/api/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to get response");
      }

      // Handle streaming response
      if (response.headers.get("content-type")?.includes("text/event-stream")) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullResponse = "";

        if (!reader) throw new Error("No response body");

        try {
          // Add a placeholder assistant message
          const assistantMessage: Message = { role: "assistant", content: "" };
          setMessages((prev) => [...prev, assistantMessage]);

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            console.log('Received SSE chunk:', chunk);

            // Parse SSE format
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  console.log('Parsed SSE data:', data);

                  // Check if the user has reached their daily limit
                  if (data.limitReached) {
                    setLimitReached(true);
                    
                    // Update the last message with the error about limit
                    setMessages((prev) => {
                      const newMessages = [...prev];
                      // Remove the last message (assistant placeholder)
                      return newMessages.slice(0, -1);
                    });
                    
                    // Set the result with error info
                    setResult({
                      response: "",
                      error: data.error || "Daily limit reached",
                      limitReached: true
                    });
                    
                    // End the streaming since we've reached the limit
                    break;
                  } else if (data.response) {
                    fullResponse += data.response;
                    onStream?.(data.response);

                    // Update the last message (assistant's response) with the accumulated content
                    setMessages((prev) => {
                      const newMessages = [...prev];
                      newMessages[newMessages.length - 1] = {
                        role: "assistant",
                        content: fullResponse,
                      };
                      return newMessages;
                    });
                  }
                } catch (e) {
                  console.error('Error parsing SSE data:', e);
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        setResult({ response: fullResponse });
        return;
      }

      // Handle non-streaming response for backward compatibility
      const data = await response.json();
      
      // Check if the user has reached their daily limit
      if (data.limitReached) {
        setLimitReached(true);
        setResult({
          response: "",
          error: data.error || "Daily limit reached",
          limitReached: true
        });
      } else {
        const assistantMessage: Message = { role: "assistant", content: data.response };
        setMessages((prev) => [...prev, assistantMessage]);
        setResult(data);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Query error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetChat = () => {
    setMessages([]);
    setResult(null);
    setError(null);
  };

  const loadHistory = async () => {
    try {
      const response = await fetch("/api/query/history");
      if (!response.ok) {
        throw new Error("Failed to fetch query history");
      }

      const history = await response.json();
      return history;
    } catch (err) {
      console.error("Error loading query history:", err);
      return [];
    }
  };

  const resetLimitReached = () => {
    setLimitReached(false);
  };

  return {
    sendQuery,
    resetChat,
    loadHistory,
    messages,
    result,
    isLoading,
    error,
    limitReached,
    resetLimitReached
  };
}