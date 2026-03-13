export type PermissionReply = "once" | "always" | "reject";

export interface PermissionRequest {
  jobId: string;
  threadId: string;
  sessionId: string;
  permission: string;
  patterns: string[];
  metadata: Record<string, unknown>;
}

export interface QuestionOption {
  label: string;
  description: string;
}

export interface Question {
  header: string;
  question: string;
  options: QuestionOption[];
  multiple?: boolean;
  custom?: boolean;
}

export interface QuestionRequest {
  jobId: string;
  threadId: string;
  sessionId: string;
  questions: Question[];
}

export interface PermissionResponseMessage {
  type: "permission_response";
  jobId: string;
  reply: PermissionReply;
}

export interface QuestionResponseMessage {
  type: "question_response";
  jobId: string;
  answers: string[][];
}

export interface PermissionHandler {
  onPermissionRequest(request: PermissionRequest): Promise<PermissionReply>;
  onQuestionRequest(request: QuestionRequest): Promise<string[][]>;
}
