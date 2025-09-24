require("dotenv").config();
const app = require("./app");
const connection = require("./config/db");

const PORT = process.env.PORT || 5000

connection()


const server = app.listen(PORT, () => {
    console.log(`🎉 Pool Party Ticketing API server started \n 📡 Port: ${PORT}\n🌐 Environment: ${process.env.NODE_ENV}\n🕧 Started at: ${new Date().toLocaleString()}`)
})

process.on('unhandledRejection', (err, promise)=> {
    console.log('Unhandled Rejection at:', promise, 'reason:'. err)
    server.close(() => {
        process.exit(1)
    })
})

process.on('uncaughtException', (err) => {
    console.log('Uncaught exception thrown:', err)
    process.exit(1)
})

process.on('SIGTERM', () => {
    console.log("👋 SIGTERM received. Shutting down gracefully...")
    server.close(()=>{
        console.log('💤 Process terminated')
    })
})