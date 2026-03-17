import "dotenv/config";
import { getDb } from "../db";
import { jobs } from "../db/job.schema";
import { projects } from "../db/project.schema";
import { gte, lte, and, eq } from "drizzle-orm";

const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
yesterday.setHours(0, 0, 0, 0);
const yesterdayStart = new Date(yesterday);

yesterday.setHours(23, 59, 59, 999);
const yesterdayEnd = new Date(yesterday);

const db = getDb();

const results = db
  .select({
    projectName: projects.name,
    total: jobs.id,
    status: jobs.status,
  })
  .from(jobs)
  .innerJoin(projects, eq(jobs.projectId, projects.id))
  .where(
    and(gte(jobs.createdAt, yesterdayStart), lte(jobs.createdAt, yesterdayEnd)),
  )
  .all();

const grouped = results.reduce(
  (acc, row) => {
    if (!acc[row.projectName]) {
      acc[row.projectName] = { total: 0, completed: 0, failed: 0 };
    }
    acc[row.projectName].total++;
    if (row.status === "completed") {
      acc[row.projectName].completed++;
    } else if (row.status === "failed") {
      acc[row.projectName].failed++;
    }
    return acc;
  },
  {} as Record<string, { total: number; completed: number; failed: number }>,
);

console.log(
  "\n📊 Session Statistics for Yesterday (" +
    yesterday.toISOString().split("T")[0] +
    ")\n",
);
console.log("=".repeat(70));

Object.entries(grouped).forEach(([projectName, stats]) => {
  console.log(`\n📁 Project: ${projectName}`);
  console.log(`   Total Sessions: ${stats.total}`);
  console.log(`   ✅ Successful:   ${stats.completed}`);
  console.log(`   ❌ Failed:      ${stats.failed}`);
});

console.log("\n" + "=".repeat(70) + "\n");
