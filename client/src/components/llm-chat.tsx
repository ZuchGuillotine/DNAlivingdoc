import { useState, useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLLM, ChatResponse } from '@/hooks/use-llm';
import { Loader2, SendHorizontal, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import LimitReachedNotification from '@/components/ui/LimitReachedNotification';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export default function LLMChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingResponse, setStreamingResponse] = useState('');
  const { chat, limitReached, resetLimitReached } = useLLM();
  const { toast } = useToast();
  const eventSourceRef = useRef<EventSource | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
    };

    // Create a stable message array with user message
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setStreamingResponse('');
    setIsLoading(true);
    setError(null);

    try {
      // Add initial empty assistant message while preserving user message
      const assistantMessage = { role: 'assistant', content: '' };
      setMessages([...messages, userMessage, assistantMessage]);

      const encodedMessage = encodeURIComponent(userMessage.content);
      const eventSource = new EventSource(`/api/chat?message=${encodedMessage}`);
      eventSourceRef.current = eventSource;

      timeoutRef.current = setTimeout(() => {
        console.error('Response timeout');
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        setIsLoading(false);

        if (!streamingResponse) {
          setMessages((prev) => [
            ...prev.slice(0, prev.length - 1),
            { role: 'assistant', content: "I'm sorry, there was a timeout while generating a response. Please try again." }
          ]);
          setStreamingResponse('');
        }
      }, 30000);

      let fullResponse = '';

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }

          if (data.error) {
            console.error('Server returned error:', data.error);
            eventSource.close();
            eventSourceRef.current = null;
            setIsLoading(false);

            setMessages((prev) => [
              ...prev.slice(0, prev.length - 1),
              { role: 'assistant', content: "I'm sorry, there was an error generating a response. Please try again." }
            ]);
            setStreamingResponse('');
          } else if (data.streaming === false) {
            eventSource.close();
            eventSourceRef.current = null;
            setIsLoading(false);

            if (fullResponse) {
              const updatedMessages = [
                ...messages.slice(0, messages.length - 1),
                { role: 'assistant', content: fullResponse }
              ];
              setMessages(updatedMessages);

              // Automatically save the chat
              (async () => {
                try {
                  await fetch('/api/chat/save', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    content: JSON.stringify(updatedMessages),
                    type: 'chat',
                    tags: ['ai_conversation'],
                  }),
                });
                } catch (saveError) {
                  console.error('Failed to auto-save chat:', saveError);
                }
              })();
            } else {
              setMessages((prev) => [
                ...prev.slice(0, prev.length - 1),
                { role: 'assistant', content: "I don't have a response for that." }
              ]);
            }

            setStreamingResponse('');
          } else {
            const newContent = data.response || '';
            fullResponse += newContent;
            setStreamingResponse((prev) => prev + newContent);
            setMessages((prev) => [
              ...prev.slice(0, prev.length - 1),
              { role: 'assistant', content: fullResponse }
            ]);
          }
        } catch (parseError) {
          console.error('Error parsing SSE data:', parseError, 'raw data:', event.data);
        }
      };

      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);

        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        setIsLoading(false);

        // Preserve user message and handle error state
        const errorMessage = "I apologize, but there was an error connecting to the AI service. Please try again.";

        setMessages((prev) => {
          const userMessages = prev.filter(msg => msg.role === 'user');
          const lastUserMessage = userMessages[userMessages.length - 1];

          return [
            ...prev.filter(msg => msg.role === 'user'),
            { role: 'assistant', content: fullResponse || errorMessage }
          ];
        });
      };

    } catch (error: any) {
      console.error('Error:', error);
      setIsLoading(false);

      setMessages((prev) => [
        ...prev.slice(0, prev.length - 1),
        { role: 'assistant', content: "I'm sorry, an unexpected error occurred. Please try again." }
      ]);

      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Something went wrong',
      });
    }
  };

  const handleSaveChat = async () => {
    if (messages.length === 0) return;

    try {
      const response = await fetch('/api/chat/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: JSON.stringify(messages),
          type: 'chat',
          tags: ['saved_chat'],
        }),
      });

      if (!response.ok) throw new Error('Failed to save chat');

      toast({
        title: "Success",
        description: "Chat saved successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save chat",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {limitReached && (
        <LimitReachedNotification onClose={resetLimitReached} />
      )}
      {error && error.includes('monthly chat limit') ? (
        <LimitReachedNotification message={error} onClose={() => setError(null)} />
      ) : (
        error && (
          <div className="text-red-500 mb-4">
            {error}
          </div>
        )
      )}
      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <Card
              key={index}
              className={`${
                message.role === 'assistant'
                  ? 'bg-white/10 text-white'
                  : 'bg-white text-[#1b4332]'
              }`}
            >
              <CardContent className="p-4">
                <p className="text-sm whitespace-pre-wrap">
                  {message.content}
                  {isLoading && index === messages.length - 1 && message.role === 'assistant' && '▋'}
                </p>
              </CardContent>
            </Card>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="mt-4 flex flex-col gap-2">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell me about your mood, energy, or other supplement responses ..."
            className="bg-white/10 text-white placeholder:text-white/60 min-h-[100px] resize-y"
            disabled={isLoading}
          />
          <Button
            type="submit"
            disabled={isLoading}
            className="bg-white text-[#1b4332] hover:bg-white/90"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizontal className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}