import { Router, type Response } from "express";
import { userRepository } from "../repositories/user-repository";
import {
  hashPassword,
  verifyPassword,
  generateTokenPair,
  verifyRefreshToken,
  requireAuth,
  type AuthenticatedRequest,
} from "../auth/jwt";
import { logger } from "../shared/logger";
import { success, error, StatusCodes } from "../shared/api-response";

export function createAuthRouter(): Router {
  const router = Router();

  router.post("/setup", async (req: AuthenticatedRequest, res: Response) => {
    const existingUsers = userRepository.count();
    if (existingUsers > 0) {
      error(
        res,
        "Setup already completed. Please login.",
        StatusCodes.CONFLICT,
      );
      return;
    }

    const { username, password, displayName } = req.body as {
      username?: string;
      password?: string;
      displayName?: string;
    };

    if (!username || !password) {
      error(res, "username and password are required", StatusCodes.BAD_REQUEST);
      return;
    }

    if (password.length < 6) {
      error(
        res,
        "Password must be at least 6 characters",
        StatusCodes.BAD_REQUEST,
      );
      return;
    }

    try {
      const passwordHash = await hashPassword(password);
      const user = userRepository.create({
        id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        username,
        passwordHash,
        displayName: displayName || username,
        createdAt: new Date(),
      });

      const tokens = generateTokenPair({
        userId: user.id,
        username: user.username,
      });

      logger.info("User setup completed", { userId: user.id, username });
      success(
        res,
        {
          ...tokens,
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
          },
        },
        "Setup completed",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("Setup failed", { error: msg });
      error(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  });

  router.post("/login", async (req: AuthenticatedRequest, res: Response) => {
    const { username, password } = req.body as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      error(res, "username and password are required", StatusCodes.BAD_REQUEST);
      return;
    }

    const user = userRepository.getByUsername(username);
    if (!user) {
      error(res, "Invalid credentials", StatusCodes.UNAUTHORIZED);
      return;
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      error(res, "Invalid credentials", StatusCodes.UNAUTHORIZED);
      return;
    }

    const tokens = generateTokenPair({
      userId: user.id,
      username: user.username,
    });
    success(
      res,
      {
        ...tokens,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
        },
      },
      "Login successful",
    );
  });

  router.post("/refresh", async (req: AuthenticatedRequest, res: Response) => {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      error(res, "refreshToken is required", StatusCodes.BAD_REQUEST);
      return;
    }

    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      error(res, "Invalid or expired refresh token", StatusCodes.UNAUTHORIZED);
      return;
    }

    const user = userRepository.getById(payload.userId);
    if (!user) {
      error(res, "User not found", StatusCodes.UNAUTHORIZED);
      return;
    }

    const tokens = generateTokenPair({
      userId: user.id,
      username: user.username,
    });
    success(res, tokens, "Token refreshed");
  });

  router.get("/me", requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = userRepository.getById(req.user!.userId);
    if (!user) {
      error(res, "User not found", StatusCodes.NOT_FOUND);
      return;
    }
    success(
      res,
      {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      },
      "OK",
    );
  });

  return router;
}
