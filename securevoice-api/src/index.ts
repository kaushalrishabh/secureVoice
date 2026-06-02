import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db/connection';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  console.log("Inside GET")
  res.json({
    ok: true,
  })
})

pool.getConnection()
  .then(conn => {
    console.log('Database connected');
    conn.release();
  })
  .catch(err => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  });

app.listen(PORT, () => {
  console.log(`Server Running on Port ${PORT}`)
})