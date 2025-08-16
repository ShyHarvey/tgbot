#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🤖 Telegram Bot Setup Utility');
console.log('=============================\n');

// Check if .env file already exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    console.log('⚠️  .env file already exists!');
    console.log('   This utility will overwrite it.');
    console.log('   Press Ctrl+C to cancel, or any key to continue...');
    
    // Wait for user input
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', () => {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        createEnvFile();
    });
} else {
    createEnvFile();
}

function createEnvFile() {
    console.log('\n📝 Creating .env file...\n');
    
    const envContent = `# Required: Your Telegram bot token from @BotFather
BOT_TOKEN=your_bot_token_here

# Required: Channel ID to forward messages from
# Get this by forwarding a message from your channel to @userinfobot
NOTIFICATION_CHANNEL_ID=-1001234567890

# Optional: Comma-separated list of authorized user IDs
# If not set, all users can use commands (backward compatibility)
# Get your user ID by sending /test to the bot
AUTHORIZED_USERS=659506887

# Optional: File to store target chat IDs
TARGET_CHATS_FILE=target_chats.json

# Optional: Logging level (debug, info, warn, error)
LOG_LEVEL=info

# Optional: Maximum number of target chats
MAX_TARGET_CHATS=100

# Optional: HTTP server port (default: 3000)
PORT=3000
`;

    try {
        fs.writeFileSync(envPath, envContent);
        console.log('✅ .env file created successfully!');
        console.log('\n📋 Next steps:');
        console.log('1. Edit .env file and set your BOT_TOKEN');
        console.log('2. Set NOTIFICATION_CHANNEL_ID to your channel ID');
        console.log('3. Add your user ID to AUTHORIZED_USERS (optional)');
        console.log('4. Run: npm start');
        console.log('\n💡 Get your user ID by sending /test to the bot after starting it');
    } catch (error) {
        console.error('❌ Failed to create .env file:', error.message);
        process.exit(1);
    }
}
