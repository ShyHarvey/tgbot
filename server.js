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
const server = app.listen(PORT, () => {
    console.log(`🚀 HTTP server listening on port ${PORT}`);
    console.log(`📱 Health check available at: http://localhost:${PORT}/health`);
    
    // Start the bot in a separate process
    if (process.env.BOT_TOKEN) {
        // Start bot process
        console.log('🤖 Starting bot process...');
        const botProcess = spawn('node', ['bot.js'], {
            stdio: 'pipe',
            env: process.env
        });

        // Log bot process info
        console.log(`📊 Bot process started with PID: ${botProcess.pid}`);

        // Handle bot process output
        botProcess.stdout.on('data', (data) => {
            console.log(`🤖 Bot: ${data.toString().trim()}`);
        });

        botProcess.stderr.on('data', (data) => {
            console.error(`🤖 Bot Error: ${data.toString().trim()}`);
        });

        // Handle bot process exit
        botProcess.on('exit', (code, signal) => {
            console.log(`�� Bot process exited with code ${code} and signal ${signal}`);
            
            if (code !== 0) {
                console.log('⚠️  Bot process exited with error, but HTTP server continues running');
                console.log('💡 Check bot logs for details. Bot will need manual restart.');
            }
        });

        // Handle bot process errors
        botProcess.on('error', (error) => {
            console.error('❌ Bot process error:', error);
            console.log('⚠️  Bot process failed, but HTTP server continues running');
            console.log('💡 Bot will need manual restart');
        });

        // Graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down...');
            
            // Stop HTTP server
            server.close(() => {
                console.log('✅ HTTP server stopped');
                
                // Kill bot process
                if (botProcess && !botProcess.killed) {
                    console.log('🛑 Stopping bot process...');
                    botProcess.kill('SIGTERM');
                    
                    // Force kill after 5 seconds if not stopped
                    setTimeout(() => {
                        if (botProcess && !botProcess.killed) {
                            console.log('💀 Force killing bot process...');
                            botProcess.kill('SIGKILL');
                        }
                        process.exit(0);
                    }, 5000);
                } else {
                    process.exit(0);
                }
            });
        });

        process.on('SIGTERM', () => {
            console.log('\n🛑 Received SIGTERM...');
            
            // Stop HTTP server
            server.close(() => {
                console.log('✅ HTTP server stopped');
                
                // Kill bot process
                if (botProcess && !botProcess.killed) {
                    console.log('🛑 Stopping bot process...');
                    botProcess.kill('SIGTERM');
                    
                    // Force kill after 5 seconds if not stopped
                    setTimeout(() => {
                        if (botProcess && !botProcess.killed) {
                            console.log('💀 Force killing bot process...');
                            botProcess.kill('SIGKILL');
                        }
                        process.exit(0);
                    }, 5000);
                } else {
                    process.exit(0);
                }
            });
        });
        
    } else {
        console.log('⚠️  Warning: BOT_TOKEN not set in environment variables');
        console.log('   The bot will not function properly without a valid token');
        console.log('   Please set BOT_TOKEN in your .env file or environment variables');
        console.log('💡 The HTTP server is running for health checks');
    }
});
