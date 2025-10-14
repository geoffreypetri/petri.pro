import Server from "lume/core/server.ts"
import basicAuth from "lume/middlewares/basic_auth.ts"

const user = Deno.env.get("AUTH_USERNAME") || 'admin'
const password = Deno.env.get("AUTH_PASSWORD") || 'demo'

export const server = new Server({ root: "_site" });

server.use(basicAuth({
  users: {
    [user]: password,
  },
}))

server.start()

console.log("Listening on http://localhost:8000")