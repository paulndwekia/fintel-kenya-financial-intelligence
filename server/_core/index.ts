import "dotenv/config";

import { createFintelServer, initialiseFintelSources } from "./app";
import { serveStatic } from "./static";

async function startServer() {
  const { app, server } = createFintelServer();

  // Production serves the pre-built React application.
  serveStatic(app);

  const port = Number.parseInt(
    process.env.PORT || "10000",
    10,
  );

  initialiseFintelSources();

  server.listen(port, "0.0.0.0", () => {
    console.log(
      `FINTEL running on 0.0.0.0:${port} in ${process.env.NODE_ENV ?? "production"} mode`,
    );
  });
}

startServer().catch((error) => {
  console.error("FINTEL startup failed:", error);
  process.exit(1);
});
