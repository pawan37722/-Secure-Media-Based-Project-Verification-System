import express from "express";
import multer from "multer";
import { v4 as uuid } from "uuid";
import cors from "cors";
import path from "path";
import os from "os";
import fs from "fs";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { pool } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root .env when running locally
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const PORT = Number(process.env.PORT || 5000);
const VERCEL_URL = process.env.VERCEL_URL
    ? process.env.VERCEL_URL.startsWith("http")
        ? process.env.VERCEL_URL
        : `https://${process.env.VERCEL_URL}`
    : undefined;

const CONFIG = {
    PORT,
    BASE_URL: process.env.BASE_URL || VERCEL_URL || `http://localhost:${PORT}`,
    FRONTEND_URL: process.env.FRONTEND_URL || process.env.BASE_URL || VERCEL_URL || `http://localhost:${PORT}`,
    DB: {
        connectionString: process.env.DB_CONNECTION_STRING
    }
};

if (!CONFIG.DB.connectionString) {
    throw new Error("Missing environment variable: DB_CONNECTION_STRING");
}

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(os.tmpdir(), "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json());

app.get("/config.js", (req, res) => {
    res.type("application/javascript");
    res.send(`const ENV = { API_BASE_URL: ${JSON.stringify(CONFIG.BASE_URL)} };`);
});


// ── Multer: keep file extension and use a writable temp folder ─────────────────
const storage = multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname)
            || (file.mimetype.startsWith("image") ? ".jpg" : ".webm");
        cb(null, uuid() + ext);
    }
});
const upload = multer({ storage });

// ── POST /upload ──────────────────────────────────────────────
app.post("/upload", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const id       = uuid();
        const fileName = req.file.filename;
        const fileUrl  = `${CONFIG.BASE_URL}/media/${fileName}`;
        const type     = req.file.mimetype.startsWith("image") ? "image" : "video";
        const now      = new Date();

        const lat = parseFloat(req.body.latitude)  || null;
        const lng = parseFloat(req.body.longitude) || null;

        // Build Google Maps URL and save it to DB
        const locationUrl = (lat !== null && lng !== null)
            ? `https://www.google.com/maps?q=${lat},${lng}&z=16`
            : null;

        const verifyUrl = `${CONFIG.FRONTEND_URL}/index.html?id=${id}`;

        await pool.query(
            `INSERT INTO media
             (id, file_name, file_url, file_type, file_size,
              latitude, longitude, location_url,
              capture_date, capture_time, uploaded_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
                id, fileName, fileUrl, type, req.file.size,
                lat, lng, locationUrl,
                req.body.date || now.toISOString().split("T")[0],
                req.body.time || now.toTimeString().split(" ")[0],
                now
            ]
        );

        res.json({ success: true, id, file_url: fileUrl, location_url: locationUrl, verify_url: verifyUrl });

    } catch (err) {
        console.error("Upload error:", err);
        res.status(500).json({ error: "Upload failed: " + err.message });
    }
});

// ── Serve uploaded files ──────────────────────────────────────
app.use("/media", express.static(UPLOAD_DIR));

// ── GET /media-info/:id ───────────────────────────────────────
app.get("/media-info/:id", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM media WHERE id = $1", [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Media not found" });

        const r = result.rows[0];
        res.json({
            id:           r.id,
            file_url:     r.file_url,
            file_type:    r.file_type,
            file_size:    r.file_size,
            latitude:     r.latitude,
            longitude:    r.longitude,
            location_url: r.location_url,   // returned to frontend from DB
            capture_date: r.capture_date,
            capture_time: r.capture_time,
            uploaded_at:  r.uploaded_at
        });
    } catch (err) {
        console.error("Media info error:", err);
        res.status(500).json({ error: "Failed to fetch media info" });
    }
});

app.listen(CONFIG.PORT, "0.0.0.0",() => console.log(`✅ Server running at ${CONFIG.BASE_URL}`));