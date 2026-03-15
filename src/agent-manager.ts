import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { type SdkType } from "./db/job.schema";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

let activeAgent: SdkType | null = null;

export function getActiveAgent(): SdkType {
  if (activeAgent !== null) {
    return activeAgent;
  }

  const db = getDb();
  const result = db
    .select()
    .from(settings)
    .where(eq(settings.key, "active_agent"))
    .get();

  activeAgent = (result?.value as SdkType) || "opencode";
  return activeAgent;
}

export function setActiveAgent(agent: SdkType): void {
  if (agent !== "opencode" && agent !== "codex") {
    throw new Error(
      `Invalid agent type: ${agent}. Must be "opencode" or "codex".`,
    );
  }

  const db = getDb();
  const existing = db
    .select()
    .from(settings)
    .where(eq(settings.key, "active_agent"))
    .get();

  if (existing) {
    db.update(settings)
      .set({ value: agent })
      .where(eq(settings.key, "active_agent"))
      .run();
  } else {
    db.insert(settings).values({ key: "active_agent", value: agent }).run();
  }

  activeAgent = agent;
}

export function toggleActiveAgent(): SdkType {
  const current = getActiveAgent();
  const newAgent = current === "opencode" ? "codex" : "opencode";
  setActiveAgent(newAgent);
  return newAgent;
}
