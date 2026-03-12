import * as React from "react";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AIInput,
  AIInputSubmit,
  AIInputTextarea,
  AIInputToolbar,
  AIInputTools,
} from "@/components/chat/ai-input";
import { AISuggestion, AISuggestions } from "@/components/chat/ai-suggestions";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "intro",
    role: "assistant",
    content: "Hi! I can help with product questions or support requests.",
  },
];
const SUGGESTIONS = [
  "I need help with my account.",
  "What plans do you offer?",
  "How do I reset my password?",
  "Talk to a human agent.",
];

export const FloatingChatbot = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [messages, setMessages] =
    React.useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = React.useState("");
  const scrollAreaId = "floating-chatbot-scroll";

  React.useEffect(() => {
    const root = document.getElementById(scrollAreaId);
    if (!root) return;
    const viewport = root.querySelector(
      "[data-slot='scroll-area-viewport']",
    ) as HTMLDivElement | null;
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [messages, isOpen]);

  const handleSend = (content?: string) => {
    const trimmed = (content ?? input).trim();
    if (!trimmed) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content:
        "Thanks! This is a placeholder response. Hook me up to your chat API to go live.",
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput("");
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      <div
        className={cn(
          "origin-bottom-right transition-all duration-300 ease-out",
          isOpen
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-4 scale-[0.98] opacity-0",
        )}
      >
        <div className="relative rounded-[26px] p-[1.5px]">
          <div className="pointer-events-none absolute inset-0 rounded-[26px] bg-[conic-gradient(from_180deg_at_50%_50%,rgba(56,189,248,0.0),rgba(56,189,248,0.45),rgba(14,116,144,0.25),rgba(56,189,248,0.45),rgba(56,189,248,0.0))] opacity-80 blur-[1px]" />
          <div className="pointer-events-none absolute inset-0 rounded-[26px] ring-1 ring-cyan-400/40" />
          <Card className="relative w-[340px] overflow-hidden rounded-[24px] border border-cyan-300/30 bg-card/90 shadow-[0_20px_60px_-28px_rgba(8,47,73,0.8)] backdrop-blur md:w-[420px] py-0">
            <CardHeader className="border-b border-border/60 bg-muted/40 py-4">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-base font-semibold text-foreground">
                  Support Chat
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  We typically reply within a few minutes.
                </p>
              </div>
              <CardAction>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close chat"
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="px-4 py-4">
              <ScrollArea id={scrollAreaId} className="h-72">
                <div className="flex flex-col gap-3 pr-3">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm",
                        message.role === "user"
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "bg-background/80 text-foreground ring-1 ring-border/60",
                      )}
                    >
                      {message.content}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
            <CardFooter className="border-t border-border/60 bg-muted/30 px-4 py-4">
              <div className="flex w-full flex-col gap-3">
                <AISuggestions>
                  {SUGGESTIONS.map((suggestion) => (
                    <AISuggestion
                      key={suggestion}
                      suggestion={suggestion}
                      onClick={handleSend}
                      className="text-xs"
                    />
                  ))}
                </AISuggestions>
                <AIInput
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleSend();
                  }}
                >
                  <AIInputTextarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Type your message..."
                    minHeight={52}
                    maxHeight={160}
                  />
                  <AIInputToolbar className="border-t border-border/60">
                    <AIInputTools />
                    <AIInputSubmit />
                  </AIInputToolbar>
                </AIInput>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
      <Button
        className={cn(
          "h-12 w-12 rounded-full shadow-lg transition-all duration-300 ease-out",
          isOpen
            ? "pointer-events-none translate-y-2 opacity-0"
            : "translate-y-0 opacity-100",
        )}
        onClick={() => setIsOpen(true)}
        aria-label="Open chat"
      >
        <MessageCircle className="h-5 w-5" />
      </Button>
    </div>
  );
};
