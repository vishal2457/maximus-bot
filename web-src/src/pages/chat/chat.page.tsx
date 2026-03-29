import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useProjects } from "../../lib/api/projects";
import {
  listSessions,
  getSessionMessages,
  createSession,
  abortSession,
  type Session,
  type Message,
} from "../../lib/api/chat";
import { getSocket } from "../../lib/socket";
import { toast } from "sonner";
import {
  Play,
  Square,
  Plus,
  MessageSquare,
  Bot,
  User,
  Loader2,
  FolderKanban,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";

type PermissionRequest = {
  requestId: string;
  projectId: string;
  sessionId: string;
  permission: string;
  patterns: string[];
};

type QuestionRequest = {
  requestId: string;
  projectId: string;
  sessionId: string;
  questions: Array<{
    header: string;
    question: string;
    options: Array<{ label: string; description: string }>;
    multiple?: boolean;
  }>;
};

export const ChatPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: projects } = useProjects();

  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    searchParams.get("project") || "",
  );
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    searchParams.get("session") || "",
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [agentBusy, setAgentBusy] = useState(false);
  const [permissionRequest, setPermissionRequest] =
    useState<PermissionRequest | null>(null);
  const [questionRequest, setQuestionRequest] =
    useState<QuestionRequest | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load sessions when project changes
  useEffect(() => {
    if (!selectedProjectId) return;
    setSessionsLoading(true);
    listSessions(selectedProjectId)
      .then(setSessions)
      .catch(() => toast.error("Failed to load sessions"))
      .finally(() => setSessionsLoading(false));
  }, [selectedProjectId]);

  // Load messages when session changes
  useEffect(() => {
    if (!selectedProjectId || !selectedSessionId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    getSessionMessages(selectedProjectId, selectedSessionId)
      .then(setMessages)
      .catch(() => toast.error("Failed to load messages"))
      .finally(() => setLoadingMessages(false));
  }, [selectedProjectId, selectedSessionId]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Socket.IO event listeners
  useEffect(() => {
    const socket = getSocket();

    if (selectedProjectId) {
      socket.emit("project:join", selectedProjectId);
    }

    const onMessageSendAck = (data: {
      projectId: string;
      sessionId: string;
      status: string;
    }) => {
      console.log("[Chat] message:send:ack", data);
      if (
        data.projectId === selectedProjectId &&
        data.sessionId &&
        data.sessionId !== selectedSessionId
      ) {
        setSelectedSessionId(data.sessionId);
        setSearchParams({
          project: selectedProjectId,
          session: data.sessionId,
        });
      }
    };

    const onMessageUpdated = (data: {
      projectId: string;
      sessionId: string;
      message: Message;
    }) => {
      if (data.projectId !== selectedProjectId) return;
      if (data.sessionId === selectedSessionId) {
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === data.message.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = data.message;
            return updated;
          }
          return [...prev, data.message];
        });
      }
      setAgentBusy(false);
    };

    const onPartDelta = (data: {
      projectId: string;
      sessionId: string;
      messageId: string;
      delta: { type: string; text?: string };
    }) => {
      if (data.projectId !== selectedProjectId) return;
      if (data.sessionId === selectedSessionId && data.delta.text) {
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === data.messageId);
          if (idx < 0) return prev;
          const updated = [...prev];
          const msg = { ...updated[idx] };
          const parts = [...(msg.parts || [])];
          const lastPart = parts[parts.length - 1];
          if (lastPart?.type === "text") {
            parts[parts.length - 1] = {
              ...lastPart,
              text: (lastPart.text || "") + data.delta.text!,
            };
          } else {
            parts.push({ type: "text", text: data.delta.text });
          }
          msg.parts = parts;
          updated[idx] = msg;
          return updated;
        });
      }
    };

    const onSessionCreated = (data: {
      projectId: string;
      session: Session;
    }) => {
      if (data.projectId !== selectedProjectId) return;
      setSessions((prev) => [data.session, ...prev]);
      setSelectedSessionId(data.session.id);
      toast.success("New session created");
    };

    const onSessionIdle = (data: { projectId: string; sessionId: string }) => {
      if (data.projectId !== selectedProjectId) return;
      setAgentBusy(false);
    };

    const onSessionStatus = (data: {
      projectId: string;
      sessionId: string;
      status: { type: string };
    }) => {
      if (data.projectId !== selectedProjectId) return;
      console.log("[Chat] session:status", data);
      if (data.sessionId === selectedSessionId) {
        setAgentBusy(data.status.type === "busy");
      }
    };

    const onError = (data: { event: string; message: string }) => {
      console.error("[Chat] Socket error:", data);
      toast.error(`${data.event}: ${data.message}`);
      setAgentBusy(false);
    };

    const onOpenCodeEvent = (data: {
      projectId: string;
      type: string;
      data: unknown;
    }) => {
      console.log("[Chat] opencode:event", data.type, data);
    };

    const onPermissionAsked = (data: PermissionRequest) => {
      if (data.projectId !== selectedProjectId) return;
      setPermissionRequest(data);
    };

    const onQuestionAsked = (data: QuestionRequest) => {
      if (data.projectId !== selectedProjectId) return;
      setQuestionRequest(data);
    };

    socket.on("message:send:ack", onMessageSendAck);
    socket.on("message:updated", onMessageUpdated);
    socket.on("message:part:delta", onPartDelta);
    socket.on("session:created", onSessionCreated);
    socket.on("session:idle", onSessionIdle);
    socket.on("session:status", onSessionStatus);
    socket.on("permission:asked", onPermissionAsked);
    socket.on("question:asked", onQuestionAsked);
    socket.on("error", onError);
    socket.on("opencode:event", onOpenCodeEvent);

    return () => {
      if (selectedProjectId) {
        socket.emit("project:leave", selectedProjectId);
      }
      socket.off("message:send:ack", onMessageSendAck);
      socket.off("message:updated", onMessageUpdated);
      socket.off("message:part:delta", onPartDelta);
      socket.off("session:created", onSessionCreated);
      socket.off("session:idle", onSessionIdle);
      socket.off("session:status", onSessionStatus);
      socket.off("permission:asked", onPermissionAsked);
      socket.off("question:asked", onQuestionAsked);
      socket.off("error", onError);
      socket.off("opencode:event", onOpenCodeEvent);
    };
  }, [selectedProjectId, selectedSessionId]);

  const handleSend = async () => {
    if (!inputText.trim() || !selectedProjectId) return;
    const content = inputText.trim();
    setInputText("");
    setAgentBusy(true);

    try {
      const socket = getSocket();
      socket.emit("message:send", {
        projectId: selectedProjectId,
        sessionId: selectedSessionId || undefined,
        content,
      });

      // Optimistically add user message
      const userMsg: Message = {
        id: `tmp_${Date.now()}`,
        sessionID: selectedSessionId || "",
        role: "user",
        parts: [{ type: "text", text: content }],
        time: { created: Date.now() / 1000 },
      };
      setMessages((prev) => [...prev, userMsg]);
    } catch (err) {
      toast.error("Failed to send message");
      setAgentBusy(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewSession = async () => {
    if (!selectedProjectId) return;
    try {
      const session = await createSession(selectedProjectId);
      setSessions((prev) => [session, ...prev]);
      setSelectedSessionId(session.id);
    } catch {
      toast.error("Failed to create session");
    }
  };

  const handleAbort = async () => {
    if (!selectedProjectId || !selectedSessionId) return;
    try {
      await abortSession(selectedProjectId, selectedSessionId);
      setAgentBusy(false);
      toast.success("Session aborted");
    } catch {
      toast.error("Failed to abort session");
    }
  };

  const handlePermissionReply = (reply: string) => {
    if (!permissionRequest) return;
    const socket = getSocket();
    socket.emit("permission:reply", {
      requestId: permissionRequest.requestId,
      reply,
      projectId: permissionRequest.projectId,
    });
    setPermissionRequest(null);
  };

  const handleQuestionReply = (answers: string[][]) => {
    if (!questionRequest) return;
    const socket = getSocket();
    socket.emit("question:reply", {
      requestId: questionRequest.requestId,
      answers,
      projectId: questionRequest.projectId,
    });
    setQuestionRequest(null);
  };

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    setSelectedSessionId("");
    setMessages([]);
    setSearchParams({ project: projectId });
  };

  const handleSessionSelect = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setSearchParams({
      project: selectedProjectId,
      session: sessionId,
    });
  };

  const formatTime = (ts: number) => {
    return new Date(ts * 1000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getMessageText = (msg: Message): string => {
    return (msg.parts || [])
      .filter((p) => p.type === "text")
      .map((p) => p.text || "")
      .join("");
  };

  return (
    <div className="flex h-[calc(100vh-3rem)] overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 border-r border-[#333] bg-[#0A0A0A] flex flex-col shrink-0">
        {/* Project selector */}
        <div className="p-3 border-b border-[#333]">
          <label className="text-xs font-bold uppercase tracking-widest text-[#777] mb-1 block">
            Project
          </label>
          <select
            value={selectedProjectId}
            onChange={(e) => handleProjectChange(e.target.value)}
            className="w-full bg-[#111] border border-[#333] text-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#FF4400]"
          >
            <option value="">Select project...</option>
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* New session button */}
        {selectedProjectId && (
          <div className="p-3 border-b border-[#333]">
            <button
              onClick={handleNewSession}
              className="w-full flex items-center justify-center gap-2 py-2 bg-[#FF4400] text-black font-bold text-xs uppercase tracking-widest hover:bg-[#FF6633] transition-colors"
            >
              <Plus size={14} /> New Session
            </button>
          </div>
        )}

        {/* Session list */}
        <div className="flex-1 overflow-y-auto">
          {sessionsLoading ? (
            <div className="p-4 text-center text-[#777]">
              <Loader2 className="animate-spin mx-auto mb-2" size={20} />
              <span className="text-xs font-mono">Loading sessions...</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-4 text-center text-[#555]">
              <FolderKanban size={24} className="mx-auto mb-2" />
              <span className="text-xs font-mono">
                {selectedProjectId ? "No sessions yet" : "Select a project"}
              </span>
            </div>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => handleSessionSelect(session.id)}
                className={`w-full text-left p-3 border-b border-[#222] hover:bg-[#151515] transition-colors ${
                  selectedSessionId === session.id
                    ? "bg-[#151515] border-l-2 border-l-[#FF4400]"
                    : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare size={14} className="text-[#777] shrink-0" />
                  <span className="text-sm text-white truncate">
                    {session.title || session.slug || session.id?.slice(0, 12)}
                  </span>
                </div>
                <div className="text-xs text-[#555] font-mono mt-1 ml-6">
                  {new Date(session.time?.updated * 1000).toLocaleDateString()}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-12 border-b border-[#333] bg-[#0D0D0D] flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-[#FF4400]" />
            <span className="text-sm font-bold uppercase tracking-wider text-white">
              {selectedSessionId
                ? sessions.find((s) => s.id === selectedSessionId)?.title ||
                  "Session"
                : "No session selected"}
            </span>
            {agentBusy && (
              <span className="flex items-center gap-1 text-xs text-[#FF4400] font-mono">
                <Loader2 size={12} className="animate-spin" />
                Working...
              </span>
            )}
          </div>
          {selectedSessionId && agentBusy && (
            <button
              onClick={handleAbort}
              className="flex items-center gap-1 px-2 py-1 text-xs text-[#FF4400] border border-[#FF4400]/30 hover:bg-[#FF4400]/10 transition-colors"
            >
              <Square size={12} /> Abort
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!selectedProjectId ? (
            <div className="flex items-center justify-center h-full text-[#555]">
              <div className="text-center">
                <FolderKanban size={48} className="mx-auto mb-4" />
                <p className="font-mono text-sm">Select a project to start</p>
              </div>
            </div>
          ) : !selectedSessionId ? (
            <div className="flex items-center justify-center h-full text-[#555]">
              <div className="text-center">
                <MessageSquare size={48} className="mx-auto mb-4" />
                <p className="font-mono text-sm">Select or create a session</p>
                <button
                  onClick={handleNewSession}
                  className="mt-4 px-4 py-2 bg-[#FF4400] text-black font-bold text-xs uppercase tracking-widest hover:bg-[#FF6633]"
                >
                  <Plus size={14} className="inline mr-1" /> New Session
                </button>
              </div>
            </div>
          ) : loadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="animate-spin text-[#777]" size={24} />
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 bg-[#FF4400] flex items-center justify-center shrink-0">
                    <Bot size={16} className="text-black" />
                  </div>
                )}
                <div
                  className={`max-w-[70%] rounded px-4 py-2 ${
                    msg.role === "user"
                      ? "bg-[#222] text-white"
                      : "bg-[#111] text-[#E0E0E0] border border-[#333]"
                  }`}
                >
                  <pre className="whitespace-pre-wrap font-mono text-sm break-words">
                    {getMessageText(msg)}
                  </pre>
                  <div className="text-xs text-[#555] mt-1 font-mono">
                    {formatTime(msg.time.created)}
                  </div>
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 bg-[#333] flex items-center justify-center shrink-0">
                    <User size={16} className="text-[#777]" />
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Permission dialog */}
        {permissionRequest && (
          <div className="border-t border-[#FF4400]/30 bg-[#1a0a00] p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle
                size={20}
                className="text-[#FF4400] shrink-0 mt-0.5"
              />
              <div className="flex-1">
                <p className="text-sm font-bold text-[#FF4400] mb-1">
                  Permission Required
                </p>
                <p className="text-sm text-[#CCC] font-mono mb-2">
                  {permissionRequest.permission}
                </p>
                {permissionRequest.patterns.length > 0 && (
                  <div className="text-xs text-[#777] font-mono mb-3">
                    Patterns: {permissionRequest.patterns.join(", ")}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePermissionReply("once")}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#00FF41]/10 border border-[#00FF41]/30 text-[#00FF41] text-xs font-bold uppercase hover:bg-[#00FF41]/20"
                  >
                    <CheckCircle2 size={12} /> Allow Once
                  </button>
                  <button
                    onClick={() => handlePermissionReply("always")}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#222] border border-[#333] text-[#CCC] text-xs font-bold uppercase hover:bg-[#333]"
                  >
                    Always Allow
                  </button>
                  <button
                    onClick={() => handlePermissionReply("reject")}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#FF4400]/10 border border-[#FF4400]/30 text-[#FF4400] text-xs font-bold uppercase hover:bg-[#FF4400]/20"
                  >
                    <XCircle size={12} /> Deny
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Question dialog */}
        {questionRequest && (
          <div className="border-t border-[#333] bg-[#0D0D0D] p-4">
            <div className="flex items-start gap-3">
              <MessageSquare
                size={20}
                className="text-[#FF4400] shrink-0 mt-0.5"
              />
              <div className="flex-1">
                <p className="text-sm font-bold text-[#FF4400] mb-2">
                  Input Required
                </p>
                {questionRequest.questions.map((q, i) => (
                  <div key={i} className="mb-3">
                    <p className="text-sm text-[#CCC] font-bold mb-1">
                      {q.header}
                    </p>
                    <p className="text-sm text-[#777] font-mono mb-2">
                      {q.question}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {q.options.map((opt, j) => (
                        <button
                          key={j}
                          onClick={() => handleQuestionReply([[opt.label]])}
                          className="px-3 py-1.5 bg-[#222] border border-[#333] text-[#CCC] text-xs font-mono hover:border-[#FF4400] hover:text-white transition-colors"
                          title={opt.description}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setQuestionRequest(null)}
                  className="text-xs text-[#555] hover:text-[#FF4400] font-mono"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Input */}
        {selectedSessionId && (
          <div className="border-t border-[#333] p-4 bg-[#0D0D0D]">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                rows={1}
                className="flex-1 bg-[#111] border border-[#333] text-white px-4 py-2 text-sm font-mono focus:outline-none focus:border-[#FF4400] resize-none"
                style={{ minHeight: "40px", maxHeight: "120px" }}
                disabled={agentBusy}
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || agentBusy}
                className="px-4 bg-[#FF4400] text-black font-bold hover:bg-[#FF6633] disabled:opacity-30 transition-colors"
              >
                <Play size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
