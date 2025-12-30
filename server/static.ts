import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // Try multiple paths to find the public directory
  const possiblePaths = [
    path.resolve(__dirname, "public"),
    path.resolve(process.cwd(), "dist", "public"),
    path.resolve(process.cwd(), "dist/public"),
  ];
  
  let distPath = possiblePaths[0];
  for (const p of possiblePaths) {
    console.log(`[Static] Checking path: ${p}, exists: ${fs.existsSync(p)}`);
    if (fs.existsSync(p)) {
      distPath = p;
      break;
    }
  }
  
  if (!fs.existsSync(distPath)) {
    console.error(`[Static] Could not find build directory. Tried: ${possiblePaths.join(", ")}`);
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }
  
  console.log(`[Static] Serving static files from: ${distPath}`);

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
