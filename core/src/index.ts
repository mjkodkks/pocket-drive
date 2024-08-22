import { Elysia } from "elysia";
import { google } from "googleapis";
import { swagger } from "@elysiajs/swagger";
import { Client, WebhookEvent } from "@line/bot-sdk";

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URL } =
  process.env;

const scopes = ["https://www.googleapis.com/auth/drive"];

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URL
);

const authUrl = oauth2Client.generateAuthUrl({
  // 'online' (default) or 'offline' (gets refresh_token)
  access_type: "offline",
  /** Pass in the scopes array defined above.
   * Alternatively, if only one scope is needed, you can pass a scope URL as a string */
  scope: scopes,
  // Enable incremental authorization. Recommended as a best practice.
  include_granted_scopes: true,
});

const drive = google.drive({
  version: "v3",
  auth: oauth2Client,
});

const app = new Elysia();
app.use(swagger());

app.get("/", () => "Hello Elysia");
app.get("/dkks", () => "Hello DKKs");
app.post("webhook", async ({ body }) => {
  console.log(body);
  const event = body.events[0] as WebhookEvent;
  if (event.type === "message" && event.message.type === "text") {
    console.log(event.message.text);
  }

  // console.log(drive)
  const res = await drive.files.list({
    pageSize: 10,
    fields: "nextPageToken, files(id, name)",
  });
  console.log(res);

  const files = res.data.files || [];
  if (files.length === 0) {
    console.log("No files found.");
    return;
  }

  console.log("Files:");
  files.map((file) => {
    console.log(`${file.name} (${file.id})`);
  });
});

app.get("/auth/google", () => {
  return authUrl;
});

app.get("/auth/google/callback", async ({ query, set }) => {
  const code = query.code || "";

  try {
    // Exchange the authorization code for access and refresh tokens
    const { tokens } = await oauth2Client.getToken(code);
    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
      access_token: accessToken,
    });

    // Save the tokens in a database or session for future use

    // Redirect the user to a success page or perform other actions
    return "Authentication successful!";
  } catch (error) {
    console.error("Error authenticating:", error);
    set.status = 500;
    return "Authentication failed.";
    // response.status(500).send('Authentication failed.');
  }
});

app.listen(3002);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
