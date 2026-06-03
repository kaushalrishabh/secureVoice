import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'secureVoice',
  waitForConnections: true,
  connectionLimit: 10,
});

export async function connectDB() {
  const connection = await pool.getConnection();
  connection.release();
  console.log("Database is Connected!")
}

export default pool;
