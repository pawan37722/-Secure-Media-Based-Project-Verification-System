import pkg from "pg";
import { CONFIG } from "./config.js";

const { Pool } = pkg;

export const pool = new Pool({
    connectionString: CONFIG.DB.connectionString,
    ssl: { rejectUnauthorized: false }
});