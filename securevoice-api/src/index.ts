import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

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

app.listen(PORT, () => {
  console.log(`Server Running on Port ${PORT}`)
})