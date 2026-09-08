require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const runSeed = require('./config/seed');

const PORT = process.env.PORT || 5000;
let server;

const start = async () => {
  await connectDB();
  await runSeed();
  server = app.listen(PORT, () => {
    console.log('🎉 Pool Party Ticketing API server started');
    console.log(`📡 Port: ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV}`);
    console.log(`🕧 Started at: ${new Date().toLocaleString()}`);
  });
};

start();

process.on('unhandledRejection', (err) => {
  console.log('Unhandled Rejection:', err);
  if (server) server.close(() => process.exit(1));
  else process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.log('Uncaught exception thrown:', err);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  if (server) server.close(() => console.log('💤 Process terminated'));
});
