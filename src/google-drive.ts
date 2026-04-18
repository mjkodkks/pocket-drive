import { google } from "googleapis";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users, googleTokens } from "./db/schema";
import { config } from "./config";

export const oauth2Client = new google.auth.OAuth2(
  config.google.clientId,
  config.google.clientSecret,
  config.google.redirectUri,
);

export async function getAuthenticatedClient(lineId: string) {
  const tokenData = await db
    .select()
    .from(googleTokens)
    .innerJoin(users, eq(googleTokens.userId, users.id))
    .where(eq(users.lineUserId, lineId))
    .then((res) => res[0]?.google_tokens);

  if (!tokenData) return null;

  const auth = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri,
  );

  auth.setCredentials({
    access_token: tokenData.accessToken,
    refresh_token: tokenData.refreshToken,
    expiry_date: Number(tokenData.expiryDate),
  });

  const isExpired = Date.now() >= Number(tokenData.expiryDate) - 300000;

  if (isExpired) {
    const { credentials } = await auth.refreshAccessToken();
    await db
      .update(googleTokens)
      .set({
        accessToken: credentials.access_token!,
        expiryDate: credentials.expiry_date!,
        updatedAt: new Date(),
      })
      .where(eq(googleTokens.userId, tokenData.userId));
    auth.setCredentials(credentials);
  }

  return auth;
}

export async function getOrCreateFolder(drive: any, lineId: string) {
  const userData = await db.query.users.findFirst({
    where: eq(users.lineUserId, lineId),
  });

  if (userData?.googleFolderId) return userData.googleFolderId;

  const folderName = "LINE_Bot_Uploads";
  const response = await drive.files.list({
    q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)",
  });

  let folderId = response.data.files[0]?.id;

  if (!folderId) {
    const folder = await drive.files.create({
      requestBody: { name: folderName, mimeType: "application/vnd.google-apps.folder" },
      fields: "id",
    });
    folderId = folder.data.id;
  }

  if (userData) {
    await db.update(users).set({ googleFolderId: folderId }).where(eq(users.lineUserId, lineId));
  }

  return folderId;
}
