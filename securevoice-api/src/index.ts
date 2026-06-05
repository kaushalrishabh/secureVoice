import dotenv from 'dotenv';
import app from './app';
import { connectDB } from './db/connection';

dotenv.config();
const PORT = process.env.PORT || 3000

app.listen(PORT, async() => {
    try{
        await connectDB()
        console.log(`Server is Running on Port ${PORT}...`)
    }
    catch(err: any){
        console.error('Database Connection Failed! ', err.message)
        process.exit(1)
    }
})