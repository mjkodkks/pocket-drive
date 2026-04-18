function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  isDev: process.env.NODE_ENV !== "production",

  line: {
    channelAccessToken: requireEnv("LINE_CHANNEL_ACCESS_TOKEN"),
    channelSecret: requireEnv("LINE_CHANNEL_SECRET"),
  },

  google: {
    clientId: requireEnv("GOOGLE_CLIENT_ID"),
    clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
    redirectUri: requireEnv("GOOGLE_REDIRECT_URI"),
  },

  database: {
    url: requireEnv("DATABASE_URL"),
  },

  bot: {
    line: {
      id: requireEnv("BOT_LINE_ID"),
      link: requireEnv("BOT_LINK"),
    }
  }
} as const;
