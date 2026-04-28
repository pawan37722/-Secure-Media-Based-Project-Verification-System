import pkg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root .env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const required = (name, defaultValue) => {
    const value = process.env[name] ?? defaultValue;
    if (value === undefined) throw new Error(`Missing environment variable: ${name}`);
    return value;
};

const CONFIG = {
    DB: {
        connectionString: required("DB_CONNECTION_STRING")
    }
};

const { Pool } = pkg;

export const pool = new Pool({
    connectionString: CONFIG.DB.connectionString,
    ssl: { rejectUnauthorized: false }
});