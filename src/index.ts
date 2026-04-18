import { Elysia, t } from "elysia";
import * as line from "@line/bot-sdk";
import { google } from "googleapis";
import { db } from "./db";
import { users, googleTokens } from "./db/schema";
import { eq } from "drizzle-orm";
import { oauth2Client, getAuthenticatedClient, getOrCreateFolder } from "./google-drive";
import { config } from "./config";
import { logger } from "./logger";
import logixlysia from "logixlysia";

const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.line.channelAccessToken,
});
const lineBlobClient = new line.messagingApi.MessagingApiBlobClient({
  channelAccessToken: config.line.channelAccessToken,
});

// Scoped sub-app that parses webhook body as raw text so we can verify
// the LINE signature against the exact bytes that were sent.
const webhookRoutes = new Elysia()
  .post("/webhook", async ({ body, headers, set }) => {
    const rawBody = body as string;
    const signature = headers["x-line-signature"] ?? "";

    if (!line.validateSignature(rawBody, config.line.channelSecret, signature)) {
      logger.warn("Invalid LINE webhook signature");
      set.status = 401;
      return "Unauthorized";
    }

    const { events } = JSON.parse(rawBody) as { events: line.webhook.Event[] };
    logger.info({ count: events.length }, "Received webhook events");

    for (const event of events) {
      const userId = (event.source as line.webhook.UserSource).userId;
      if (!userId) continue;

      if (
        event.type === "message" &&
        (event.message.type === "image" || event.message.type === "file")
      ) {
        try {
          const auth = await getAuthenticatedClient(userId);
          if (!auth) {
            const authUrl = oauth2Client.generateAuthUrl({
              access_type: "offline",
              scope: ["https://www.googleapis.com/auth/drive.file"],
              state: userId,
              prompt: "consent",
            });
            await lineClient.replyMessage({
              replyToken: event.replyToken ?? "",
              messages: [{ type: "text", text: `กรุณาเชื่อมต่อ Google Drive: ${authUrl}` }],
            });
            continue;
          }

          const drive = google.drive({ version: "v3", auth });
          const folderId = await getOrCreateFolder(drive, userId);
          const stream = await lineBlobClient.getMessageContent(event.message.id);

          const fileName =
            event.message.type === "file" && "fileName" in event.message
              ? (event.message as { fileName: string }).fileName
              : `LINE_Image_${Date.now()}.jpg`;

          await drive.files.create({
            requestBody: { name: fileName, parents: [folderId] },
            media: { body: stream as unknown as import("stream").Readable },
          });

          logger.info({ userId, fileName }, "File uploaded to Drive");
        } catch (err) {
          logger.error({ userId, err: String(err) }, "Failed to process message event");
        }
      }
    }

    set.status = 200;
    return "ok";

  });

const app = new Elysia()
  .use(
    logixlysia({
      config: {
        service: "pocket-drive",
        showStartupMessage: true,
        startupMessageFormat: "banner",
        ip: true,
        slowThreshold: 500,
        verySlowThreshold: 1000,
        timestamp: { translateTime: "yyyy-mm-dd HH:MM:ss" },
        logFilePath: "./logs/app.log",
        logRotation: { maxSize: "50m", interval: "1d", maxFiles: "14d", compress: true },
        pino: {
          level: process.env.LOG_LEVEL ?? "info",
          redact: ["req.headers.authorization", "*.accessToken", "*.refreshToken"],
        },
      },
    }),
  )
  .get("/", () => ({ status: "ok" }))
  .get("/health", () => ({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }))
  .use(webhookRoutes)
  .get("/auth/callback", async ({ query, set }) => {
    const { code, state: lineId } = query;
    if (!code || !lineId) {
      set.status = 400;
      return "Invalid Request";
    }

    try {
      const { tokens } = await oauth2Client.getToken(code as string);

      await db.transaction(async (tx) => {
        let user = await tx.query.users.findFirst({
          where: eq(users.lineUserId, lineId as string),
        });

        if (!user) {
          const [newUser] = await tx
            .insert(users)
            .values({ lineUserId: lineId as string })
            .returning();
          user = newUser;
        }

        await tx
          .insert(googleTokens)
          .values({
            userId: user!.id,
            accessToken: tokens.access_token!,
            refreshToken: tokens.refresh_token!,
            expiryDate: tokens.expiry_date!,
            scope: tokens.scope,
          })
          .onConflictDoUpdate({
            target: googleTokens.userId,
            set: {
              accessToken: tokens.access_token!,
              expiryDate: tokens.expiry_date!,
              updatedAt: new Date(),
            },
          });
      });

      logger.info({ lineId }, "Google OAuth connected");
      set.headers["content-type"] = "text/html; charset=utf-8";
      return `<html><body style="font-family: sans-serif; text-align: center; padding-top: 3.125rem;">
              <h1>เชื่อมต่อสำเร็จ!</h1><p>กลับไปที่แอป LINE เพื่อส่งไฟล์ได้เลยครับ</p>
              </body></html>`;
    } catch (error) {
      logger.error({ err: String(error) }, "OAuth callback failed");
      set.status = 500;
      return "เกิดข้อผิดพลาดในการเชื่อมต่อ";
    }
  })
  .listen(config.port);

logger.info({ port: config.port, env: config.nodeEnv }, "Server started");

function shutdown(): void {
  logger.info("Shutting down gracefully...");
  app.stop();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
