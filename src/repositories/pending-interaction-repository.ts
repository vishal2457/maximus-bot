import { and, eq, lt } from "drizzle-orm";
import { getDb } from "../db";
import {
  pendingInteractions,
  type PendingInteraction,
  type NewPendingInteraction,
  type InteractionType,
  type InteractionStatus,
} from "../db/pending-interaction.schema";

export interface PermissionPayload {
  permission: string;
  patterns: string[];
  metadata: Record<string, unknown>;
}

export interface QuestionPayload {
  questions: Array<{
    header: string;
    question: string;
    options: Array<{ label: string; description: string }>;
    multiple?: boolean;
    custom?: boolean;
  }>;
}

export interface PendingPermissionInteraction {
  id: string;
  jobId: string;
  threadId: string;
  sessionId: string | null;
  payload: PermissionPayload;
  status: InteractionStatus;
  reply: "once" | "always" | "reject" | null;
  createdAt: Date;
  expiresAt: Date;
  resolvedAt: Date | null;
}

export interface PendingQuestionInteraction {
  id: string;
  jobId: string;
  threadId: string;
  sessionId: string | null;
  payload: QuestionPayload;
  status: InteractionStatus;
  reply: string[][] | null;
  createdAt: Date;
  expiresAt: Date;
  resolvedAt: Date | null;
}

export class PendingInteractionRepository {
  private db = getDb();

  create(
    interaction: Omit<NewPendingInteraction, "id" | "createdAt" | "status"> & {
      type: InteractionType;
    },
  ): PendingInteraction {
    const id = `pi_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    this.db
      .insert(pendingInteractions)
      .values({
        id,
        jobId: interaction.jobId,
        threadId: interaction.threadId,
        sessionId: interaction.sessionId || null,
        type: interaction.type,
        payload: interaction.payload,
        status: "pending",
        createdAt: new Date(),
        expiresAt: interaction.expiresAt,
      })
      .run();

    return this.getById(id)!;
  }

  getById(id: string): PendingInteraction | undefined {
    return this.db
      .select()
      .from(pendingInteractions)
      .where(eq(pendingInteractions.id, id))
      .get();
  }

  getPendingByThreadId(threadId: string): PendingInteraction | undefined {
    return this.db
      .select()
      .from(pendingInteractions)
      .where(
        and(
          eq(pendingInteractions.threadId, threadId),
          eq(pendingInteractions.status, "pending"),
        ),
      )
      .get();
  }

  getPendingByJobId(jobId: string): PendingInteraction | undefined {
    return this.db
      .select()
      .from(pendingInteractions)
      .where(
        and(
          eq(pendingInteractions.jobId, jobId),
          eq(pendingInteractions.status, "pending"),
        ),
      )
      .get();
  }

  resolve(id: string, reply: string): PendingInteraction | undefined {
    this.db
      .update(pendingInteractions)
      .set({
        status: "resolved",
        reply,
        resolvedAt: new Date(),
      })
      .where(eq(pendingInteractions.id, id))
      .run();

    return this.getById(id);
  }

  markExpired(id: string): PendingInteraction | undefined {
    this.db
      .update(pendingInteractions)
      .set({
        status: "expired",
      })
      .where(eq(pendingInteractions.id, id))
      .run();

    return this.getById(id);
  }

  cleanupExpired(): number {
    const now = new Date();
    const expired = this.db
      .select()
      .from(pendingInteractions)
      .where(
        and(
          eq(pendingInteractions.status, "pending"),
          lt(pendingInteractions.expiresAt, now),
        ),
      )
      .all();

    for (const interaction of expired) {
      this.markExpired(interaction.id);
    }

    return expired.length;
  }

  delete(id: string): void {
    this.db
      .delete(pendingInteractions)
      .where(eq(pendingInteractions.id, id))
      .run();
  }

  parsePermissionPayload(payload: string): PermissionPayload {
    return JSON.parse(payload) as PermissionPayload;
  }

  parseQuestionPayload(payload: string): QuestionPayload {
    return JSON.parse(payload) as QuestionPayload;
  }

  toPendingPermission(
    interaction: PendingInteraction,
  ): PendingPermissionInteraction {
    return {
      id: interaction.id,
      jobId: interaction.jobId,
      threadId: interaction.threadId,
      sessionId: interaction.sessionId,
      payload: this.parsePermissionPayload(interaction.payload),
      status: interaction.status as InteractionStatus,
      reply: interaction.reply as "once" | "always" | "reject" | null,
      createdAt: interaction.createdAt,
      expiresAt: interaction.expiresAt,
      resolvedAt: interaction.resolvedAt,
    };
  }

  toPendingQuestion(
    interaction: PendingInteraction,
  ): PendingQuestionInteraction {
    return {
      id: interaction.id,
      jobId: interaction.jobId,
      threadId: interaction.threadId,
      sessionId: interaction.sessionId,
      payload: this.parseQuestionPayload(interaction.payload),
      status: interaction.status as InteractionStatus,
      reply: interaction.reply ? JSON.parse(interaction.reply) : null,
      createdAt: interaction.createdAt,
      expiresAt: interaction.expiresAt,
      resolvedAt: interaction.resolvedAt,
    };
  }
}

export const pendingInteractionRepository = new PendingInteractionRepository();
