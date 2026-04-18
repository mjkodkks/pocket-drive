import { Elysia, t } from "elysia";
import * as line from "@line/bot-sdk";
import { google } from "googleapis";
import { db } from "./db";
import { users, googleTokens } from "./db/schema";
import { eq } from "drizzle-orm";
import { oauth2Client, getAuthenticatedClient, getOrCreateFolder } from "./google-drive";
import { config } from "./config";
import logixlysia from "logixlysia";

const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.line.channelAccessToken,
});
const lineBlobClient = new line.messagingApi.MessagingApiBlobClient({
  channelAccessToken: config.line.channelAccessToken,
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
  .post("/webhook", async ({ request, body, headers, set, store }) => {
    const { logger, pino } = store;
    const rawBody = JSON.stringify(body);
    const signature = headers["x-line-signature"] ?? "";

    if (!line.validateSignature(rawBody, config.line.channelSecret, signature)) {
      logger.error(request, "Invalid LINE webhook signature");
      set.status = 401;
      return "Unauthorized";
    }

    const { events } = body as { events: line.webhook.Event[] };
    logger.info(request, `count: ${events.length}, Received webhook events`);

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
            break;
          }

          const drive = google.drive({ version: "v3", auth });
          const folderId = await getOrCreateFolder(drive, userId);
          const stream = await lineBlobClient.getMessageContent(event.message.id);

          const fileName =
            event.message.type === "file" && "fileName" in event.message
              ? (event.message as { fileName: string }).fileName
              : `LINE_Image_${Date.now()}.jpg`;

          let startTime = Date.now();
          const fileRes = await drive.files.create({
            requestBody: { name: fileName, parents: [folderId] },
            media: { body: stream as unknown as import("stream").Readable },
            fields: "id, name, size",
          });
          const endTime = Date.now();
          const uploadTime = endTime - startTime;

          logger.info(request, "File uploaded to Drive");

          const fileId = fileRes.data.id;
          const fileUrl = fileId
            ? `https://drive.google.com/file/d/${fileId}/view`
            : `https://drive.google.com/drive/folders/${folderId}`;

          // Optionally reply to the user
          console.log("before reply");
          await lineClient.replyMessage({
            replyToken: event.replyToken ?? "",
            messages: [
              {
                type: "text",
                text: `อัปโหลดไฟล์ "${fileName}" เรียบร้อยแล้ว! ดูไฟล์ได้ที่: ${fileUrl} \nโฟลเดอร์ทั้งหมด: https://drive.google.com/drive/folders/${folderId}`,
              },
              {
                type: "text",
                text: `เวลาที่ใช้ในการอัปโหลด: ${uploadTime}ms \nขนาดไฟล์: ${fileRes.data.size} bytes`,
              },
            ],
          });
        } catch (error) {
          const err = error as any;
          console.error(error);
          logger.error(
            request,
            JSON.stringify({ userId, replyToken: event.replyToken, error: err || "" }),
          );
          set.status = 500;
          return "Internal Server Error";
        }
      }
    }

    set.status = 200;
    return "ok";
  })
  .get("/auth/callback", async ({ query, set, store, request }) => {
    const { logger, pino } = store;
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

      logger.info(request, `Google OAuth connected for LINE user ${lineId}`);
      set.headers["content-type"] = "text/html; charset=utf-8";
      return `<html><body style="font-family: sans-serif; text-align: center; padding-top: 3.125rem;">
              <h1>เชื่อมต่อสำเร็จ!</h1><p>กลับไปที่แอป LINE เพื่อส่งไฟล์ได้เลยครับ</p>
              </body></html>`;
    } catch (error) {
      logger.error(request, `Google OAuth error for LINE user ${lineId}: ${error}`);
      set.status = 500;
      return "เกิดข้อผิดพลาดในการเชื่อมต่อ";
    }
  })
  .listen(config.port);

console.info({ port: config.port, env: config.nodeEnv }, "Server started");

function shutdown(): void {
  console.info("Shutting down gracefully...");
  app.stop();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
