// server/routes.ts
import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";

import { storage } from "./storage.js";
import { put } from "@vercel/blob";

import { insertContactSchema, insertProjectSchema } from "@shared/schema.js";
import {
  generateToken,
  authenticateToken,
  type AuthRequest,
} from "./auth.js";

// ---------------------------------------------------------------------
// 1. Multer – memory storage (no disk in prod)
// ---------------------------------------------------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype);

    if (extOk && mimeOk) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (jpeg, jpg, png, gif, webp) are allowed"));
    }
  },
});

// ---------------------------------------------------------------------
// 2. Upload helper – Vercel Blob (prod) | local disk (dev only)
// ---------------------------------------------------------------------
async function getImageUrl(file: Express.Multer.File): Promise<string> {
  const isProduction = process.env.NODE_ENV === "production";
  
  // Production: Require Vercel Blob
  if (isProduction) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error(
        "BLOB_READ_WRITE_TOKEN is required for file uploads in production. " +
        "Please configure blob storage before uploading files."
      );
    }
    
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    const { url } = await put(`uploads/${filename}`, file.buffer, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return url;
  }
  
  // Development: Use Blob if available, otherwise local disk
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
      const { url } = await put(`uploads/${filename}`, file.buffer, {
        access: "public",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      return url;
    } catch (err) {
      console.warn("Blob upload failed in development, using local disk:", err);
    }
  }

  // Development fallback only: write to client/public/uploads
  const fs = await import("fs");
  const uploadDir = path.resolve(import.meta.dirname, "..", "client", "public", "uploads");
  await fs.promises.mkdir(uploadDir, { recursive: true });

  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
  const filePath = path.join(uploadDir, filename);
  await fs.promises.writeFile(filePath, file.buffer);

  return `/uploads/${filename}`;
}

// ---------------------------------------------------------------------
// 3. Routes
// ---------------------------------------------------------------------
export async function registerRoutes(app: Express): Promise<Server> {
  // Contact form
  app.post("/api/contact", async (req: Request, res) => {
    try {
      const data = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(data);
      res.json({ success: true, contact });
    } catch {
      res.status(400).json({ error: "Invalid contact data" });
    }
  });

  // Get all projects
  app.get("/api/projects", async (_req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch {
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  // Admin login
  app.post("/api/admin/login", async (req: Request, res) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const user = await storage.getUserByUsername(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const bcrypt = await import("bcryptjs");
      const validPassword = await bcrypt.compare(password, user.password);
      
      if (!validPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = generateToken(user.id);
      res.json({ success: true, token });
    } catch {
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Create project with image
  app.post(
    "/api/projects",
    authenticateToken,
    upload.single("image"),
    async (req: AuthRequest, res) => {
      try {
        const { title, description } = req.body;
        if (!req.file) {
          return res.status(400).json({ error: "Image is required" });
        }

        const imageUrl = await getImageUrl(req.file);
        const data = insertProjectSchema.parse({ title, description, imageUrl });
        const project = await storage.createProject(data);

        res.json({ success: true, project });
      } catch (err: any) {
        res.status(400).json({ error: err.message ?? "Invalid project data" });
      }
    }
  );

  // Delete project
  app.delete("/api/projects/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteProject(id);
      deleted
        ? res.json({ success: true })
        : res.status(404).json({ error: "Project not found" });
    } catch {
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  return createServer(app);
}