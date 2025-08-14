const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Configuration
const config = require('./config');

console.log('🔍 Debugging Bot Configuration\n');

// Check configuration
console.log('📋 Configuration Check:');
console.log(`Bot Token: ${config.BOT_TOKEN ? '✅ Set' : '❌ Missing'}`);
console.log(`Channel ID: ${config.NOTIFICATION_CHANNEL_ID ? '✅ Set' : '❌ Missing'}`);
console.log(`Channel ID Value: ${config.NOTIFICATION_CHANNEL_ID}`);

if (!config.BOT_TOKEN) {
    console.log('\n❌ Bot token is missing! Please run: npm run setup');
    process.exit(1);
}

if (!config.NOTIFICATION_CHANNEL_ID) {
    console.log('\n❌ Channel ID is missing! Please run: npm run setup');
    process.exit(1);
}

// Create bot instance
const bot = new TelegramBot(config.BOT_TOKEN, { polling: false });

async function debugBot() {
    try {
        console.log('\n🤖 Testing Bot Connection...');
        
        // Get bot info
        const botInfo = await bot.getMe();
        console.log(`✅ Bot connected: @${botInfo.username} (${botInfo.first_name})`);
        
        console.log('\n📡 Testing Channel Access...');
        
        // Try to get channel info
        try {
            const chatInfo = await bot.getChat(config.NOTIFICATION_CHANNEL_ID);
            console.log(`✅ Channel accessible: ${chatInfo.title || chatInfo.username || 'Unknown'}`);
            console.log(`   Type: ${chatInfo.type}`);
            console.log(`   ID: ${chatInfo.id}`);
            
            // Check if bot is admin
            try {
                const botMember = await bot.getChatMember(config.NOTIFICATION_CHANNEL_ID, botInfo.id);
                console.log(`✅ Bot is ${botMember.status} in channel`);
                
                if (botMember.status === 'administrator') {
                    console.log(`   Permissions: ${JSON.stringify(botMember.permissions, null, 2)}`);
                } else {
                    console.log('❌ Bot is not an administrator!');
                    console.log('   Please add the bot as an admin with "Post Messages" permission');
                }
            } catch (memberError) {
                console.log('❌ Cannot check bot membership:', memberError.message);
                console.log('   This usually means the bot is not in the channel');
            }
            
        } catch (chatError) {
            console.log('❌ Cannot access channel:', chatError.message);
            console.log('   Possible reasons:');
            console.log('   - Bot is not added to the channel');
            console.log('   - Channel ID is incorrect');
            console.log('   - Bot was removed from the channel');
        }
        
        console.log('\n📝 Next Steps:');
        console.log('1. Make sure the bot is an ADMIN in your notification channel');
        console.log('2. Give the bot "Post Messages" permission');
        console.log('3. Post a message in the channel');
        console.log('4. Start the bot with: npm start');
        console.log('5. Check the console for message reception logs');
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
        
        if (error.message.includes('Unauthorized')) {
            console.log('\n💡 The bot token is invalid. Please:');
            console.log('1. Get a new token from @BotFather');
            console.log('2. Run: npm run setup');
        }
    }
}

debugBot();
