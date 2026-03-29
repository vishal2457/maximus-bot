import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { users, type User, type NewUser } from "../db/user.schema";

export class UserRepository {
  getById(id: string): User | undefined {
    return getDb().select().from(users).where(eq(users.id, id)).get();
  }

  getByUsername(username: string): User | undefined {
    return getDb()
      .select()
      .from(users)
      .where(eq(users.username, username))
      .get();
  }

  getAll(): User[] {
    return getDb().select().from(users).all();
  }

  create(data: NewUser): User {
    getDb().insert(users).values(data).run();
    return this.getById(data.id)!;
  }

  update(
    id: string,
    data: Partial<Pick<NewUser, "username" | "passwordHash" | "displayName">>,
  ): User | undefined {
    const existing = this.getById(id);
    if (!existing) {
      return undefined;
    }

    getDb().update(users).set(data).where(eq(users.id, id)).run();
    return this.getById(id);
  }

  delete(id: string): boolean {
    const existing = this.getById(id);
    if (!existing) {
      return false;
    }

    getDb().delete(users).where(eq(users.id, id)).run();
    return true;
  }

  count(): number {
    const result = getDb().select().from(users).all();
    return result.length;
  }
}

export const userRepository = new UserRepository();
