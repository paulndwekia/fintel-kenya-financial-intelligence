import "dotenv/config";

import { createFintelServer, initialiseFintelSources } from "./app";
import { setupVite } from "./vite";

async function startDevelopmentServer() {
  const { app, server } = createFintelServer();

  await setupVite(app, server);

  const port = Number.parseInt(
    process.env.PORT || "3000",
    10,
  );

  initialiseFintelSources();

  server.listen(port, "0.0.0.0", () => {
    console.log(`FINTEL development server running on port ${port}`);
  });
}

startDevelopmentServer().catch((error) => {
  console.error("FINTEL development startup failed:", error);
  process.exit(1);
});
