// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const { spawn } = require('child_process');
const app = express();
const PORT = process.env.PORT || 3000;

// Debug: Check environment variables
console.log('🔍 Environment variables check:');
console.log('   BOT_TOKEN:', process.env.BOT_TOKEN ? '✅ Set' : '❌ Not set');
console.log('   NOTIFICATION_CHANNEL_ID:', process.env.NOTIFICATION_CHANNEL_ID ? '✅ Set' : '❌ Not set');
console.log('   PORT:', process.env.PORT || '3000 (default)');

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Telegram Bot is running',
        timestamp: new Date().toISOString()
    });
});

// Health check for deployment platforms
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Start HTTP server first
app.listen(PORT, () => {
    console.log(`🚀 HTTP server listening on port ${PORT}`);
    console.log(`📱 Health check available at: http://localhost:${PORT}/health`);
    
    // Start the bot in a separate process
    if (process.env.BOT_TOKEN) {
        console.log('🤖 Starting Telegram Bot in separate process...');
        
        const botProcess = spawn('node', ['bot.js'], {
            stdio: 'inherit',
            detached: false
        });
        
        botProcess.on('error', (error) => {
            console.error('❌ Failed to start Telegram Bot process:', error.message);
            console.log('💡 The HTTP server is still running for health checks');
        });
        
        botProcess.on('exit', (code) => {
            if (code !== 0) {
                console.log(`⚠️  Bot process exited with code ${code}`);
                console.log('💡 The HTTP server is still running for health checks');
            }
        });
        
        // Handle process termination
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down...');
            botProcess.kill('SIGINT');
            process.exit(0);
        });
        
        process.on('SIGTERM', () => {
            console.log('\n🛑 Shutting down...');
            botProcess.kill('SIGTERM');
            process.exit(0);
        });
        
    } else {
        console.log('⚠️  Warning: BOT_TOKEN not set in environment variables');
        console.log('   The bot will not function properly without a valid token');
        console.log('   Please set BOT_TOKEN in your .env file or environment variables');
        console.log('💡 The HTTP server is running for health checks');
    }
});
