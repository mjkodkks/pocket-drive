import {
  pgTable,
  text,
  varchar,
  timestamp,
  uuid,
  bigint,
  index,
  unique,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lineUserId: varchar("line_user_id", { length: 255 }).unique().notNull(),
    displayName: varchar("display_name", { length: 255 }),
    googleFolderId: varchar("google_folder_id", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_users_line_id").on(table.lineUserId),
  ],
);

export const googleTokens = pgTable(
  "google_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").notNull(),
    expiryDate: bigint("expiry_date", { mode: "number" }).notNull(),
    scope: text("scope"),
    tokenType: varchar("token_type", { length: 50 }).default("Bearer"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("unique_user_token").on(table.userId),
  ],
);
