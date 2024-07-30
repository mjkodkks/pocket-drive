import { Elysia } from "elysia";

const app = new Elysia()
app.get("/", () => "Hello Elysia")
app.post("webhook", async ({ body }) => {
  console.log(body)
}) 

app.listen(3002);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
