import baseApi from "../axios/base";

export type Session = {
  id: string;
  slug: string;
  title: string;
  directory: string;
  projectID: string;
  time: { created: number; updated: number };
};

export type SessionListResponse = {
  data: Session[];
};

export type MessagePart = {
  type: string;
  text?: string;
  content?: string;
  name?: string;
};

export type Message = {
  id: string;
  sessionID: string;
  role: "user" | "assistant";
  parts: MessagePart[];
  time: { created: number; completed?: number };
};

export type MessagesResponse = {
  data: Message[];
};

export async function listSessions(
  projectId: string,
  params?: { limit?: number; search?: string },
): Promise<Session[]> {
  const response = await baseApi.get<SessionListResponse>(
    `/chat/projects/${projectId}/sessions`,
    { params },
  );
  return response.data.result?.data || [];
}

export async function getSessionMessages(
  projectId: string,
  sessionId: string,
  limit?: number,
): Promise<Message[]> {
  const response = await baseApi.get<MessagesResponse>(
    `/chat/projects/${projectId}/sessions/${sessionId}/messages`,
    { params: { limit } },
  );
  return response.data.result?.data || [];
}

export async function createSession(projectId: string): Promise<Session> {
  const response = await baseApi.post<{ session: Session }>(
    `/chat/projects/${projectId}/sessions`,
  );
  return response.data.result?.session;
}

export async function abortSession(
  projectId: string,
  sessionId: string,
): Promise<void> {
  await baseApi.post(`/chat/projects/${projectId}/sessions/${sessionId}/abort`);
}

export async function deleteSession(
  projectId: string,
  sessionId: string,
): Promise<void> {
  await baseApi.delete(`/chat/projects/${projectId}/sessions/${sessionId}`);
}

export async function startProjectRuntime(projectId: string): Promise<void> {
  await baseApi.post(`/chat/projects/${projectId}/start`);
}
