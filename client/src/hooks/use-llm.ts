import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export interface ChatResponse {
  response?: string;
  error?: string;
  limitReached?: boolean;
  streaming?: boolean;
}

export function useLLM() {
  const [limitReached, setLimitReached] = useState(false);

  const chatMutation = useMutation<
    { response: string },
    Error,
    { messages: Message[]; onStream?: (chunk: string, data?: ChatResponse) => void }
  >({
    mutationFn: async ({ messages, onStream }) => {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(JSON.stringify(errorData));
      }

      // Handle streaming response
      if (response.headers.get("content-type")?.includes("text/event-stream")) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullResponse = "";

        if (!reader) throw new Error("No response body");

        try {
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
                  const data: ChatResponse = JSON.parse(line.slice(6));
                  console.log('Parsed SSE data:', data);

                  if (data.response) {
                    fullResponse += data.response;
                    onStream?.(data.response, data);
                  } else if (data.error) {
                    throw new Error(data.error);
                  } else if (data.limitReached) {
                    setLimitReached(true);
                    throw new Error('Usage limit reached');
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

        return { response: fullResponse };
      }

      // Handle non-streaming response
      return response.json();
    },
    onError: (error) => {
      console.error("Chat error details:", error);
    }
  });

  return {
    chat: chatMutation.mutateAsync,
    isLoading: chatMutation.isPending,
    limitReached,
    resetLimitReached: () => setLimitReached(false)
  };
}