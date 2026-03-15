import { Router, Response as ExpressResponse } from "express";
import { jobQueueRepository } from "../repositories/job-queue-repository";

export function createJobsRouter(): Router {
  const router = Router();

  router.get("/running", (_req, res) => {
    const runningJobs = jobQueueRepository.getRunningJobs();
    res.json(
      runningJobs.map((job) => ({
        id: job.id,
        projectId: job.projectId,
        status: job.status,
        prompt: job.prompt,
        authorTag: job.authorTag,
        channelId: job.channelId,
        threadId: job.threadId,
        workerId: job.workerId,
        startedAt: job.startedAt?.toISOString() || null,
        createdAt: job.createdAt.toISOString(),
        sdkType: job.sdkType,
      })),
    );
  });

  return router;
}
