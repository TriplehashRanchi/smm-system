import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { HttpError } from "./access.js";
import { createApiRoutes } from "./routes/index.js";
import { requestContext } from "./middleware/request-context.middleware.js";
import { notFound, errorHandler } from "./middleware/error.middleware.js";

export function createApp({
  db,
  verifyToken,
  identity,
  origin = "http://localhost:3000",
  enableRateLimit = true,
  trustProxy = 0,
}) {
  const app = express();
  const allowedOrigins = [].concat(origin);
  app.disable("x-powered-by");
  if (trustProxy) app.set("trust proxy", trustProxy); // real visitor IPs for the rate limiter when a host's proxy is in front
  app.use(helmet());
  app.use(requestContext);
  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        if (!requestOrigin || allowedOrigins.includes(requestOrigin)) callback(null, true);
        else
          callback(
            new HttpError(
              403,
              "This website is not allowed to access the application.",
            ),
          );
      },
    }),
  );
  app.use('/api/content', express.json({ limit: '512kb' }));
  app.use(express.json({ limit: "64kb" }));
  if (enableRateLimit)
    app.use(
      "/api",
      rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 300,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: { error: "Too many requests. Please try again shortly." },
      }),
    );
  app.use("/api", createApiRoutes({ db, verifyToken, identity }));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
