const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Configuration
const config = require('./config');

console.log('🔍 Testing Channel Message Reception\n');

// Create bot instance with polling
const bot = new TelegramBot(config.BOT_TOKEN, { polling: true });

// Listen for ALL messages
bot.on('message', (message) => {
    console.log('\n📨 MESSAGE RECEIVED:');
    console.log(`From: ${message.chat.type} ${message.chat.id}`);
    console.log(`Chat Title: ${message.chat.title || 'Private Chat'}`);
    console.log(`User: ${message.from?.username || message.from?.first_name || 'Unknown'}`);
    console.log(`Text: ${message.text || '[No text]'}`);
    console.log(`Message ID: ${message.message_id}`);
    
    if (message.chat.id.toString() === config.NOTIFICATION_CHANNEL_ID.toString()) {
        console.log('🎯 THIS IS FROM YOUR NOTIFICATION CHANNEL!');
    }
});

// Listen for channel posts (sometimes channels send these instead of messages)
bot.on('channel_post', (post) => {
    console.log('\n📢 CHANNEL POST RECEIVED:');
    console.log(`From: channel ${post.chat.id}`);
    console.log(`Chat Title: ${post.chat.title || 'Unknown Channel'}`);
    console.log(`Text: ${post.text || '[No text]'}`);
    console.log(`Post ID: ${post.message_id}`);
    
    if (post.chat.id.toString() === config.NOTIFICATION_CHANNEL_ID.toString()) {
        console.log('🎯 THIS IS FROM YOUR NOTIFICATION CHANNEL!');
    }
});

// Listen for edited messages
bot.on('edited_message', (message) => {
    console.log('\n✏️ EDITED MESSAGE RECEIVED:');
    console.log(`From: ${message.chat.type} ${message.chat.id}`);
    console.log(`Text: ${message.text || '[No text]'}`);
});

// Listen for edited channel posts
bot.on('edited_channel_post', (post) => {
    console.log('\n✏️ EDITED CHANNEL POST RECEIVED:');
    console.log(`From: channel ${post.chat.id}`);
    console.log(`Text: ${post.text || '[No text]'}`);
});

async function testChannelAccess() {
    try {
        console.log('🤖 Bot Info:');
        const botInfo = await bot.getMe();
        console.log(`Username: @${botInfo.username}`);
        console.log(`Name: ${botInfo.first_name}`);
        console.log(`ID: ${botInfo.id}`);
        
        console.log('\n📡 Channel Info:');
        console.log(`Expected Channel ID: ${config.NOTIFICATION_CHANNEL_ID}`);
        
        try {
            const chatInfo = await bot.getChat(config.NOTIFICATION_CHANNEL_ID);
            console.log(`Channel Name: ${chatInfo.title}`);
            console.log(`Channel Type: ${chatInfo.type}`);
            console.log(`Channel ID: ${chatInfo.id}`);
            
            // Check bot membership
            const botMember = await bot.getChatMember(config.NOTIFICATION_CHANNEL_ID, botInfo.id);
            console.log(`Bot Status: ${botMember.status}`);
            
            if (botMember.status === 'administrator') {
                console.log('✅ Bot is admin in channel');
                console.log('Permissions:', JSON.stringify(botMember.permissions, null, 2));
                
                // Check specific permissions
                if (botMember.permissions) {
                    console.log('\n🔑 Key Permissions:');
                    console.log(`Can Post Messages: ${botMember.permissions.can_post_messages || 'N/A'}`);
                    console.log(`Can Edit Messages: ${botMember.permissions.can_edit_messages || 'N/A'}`);
                    console.log(`Can Delete Messages: ${botMember.permissions.can_delete_messages || 'N/A'}`);
                }
            } else {
                console.log('❌ Bot is NOT admin in channel');
                console.log('Please add the bot as an administrator with "Post Messages" permission');
            }
            
        } catch (error) {
            console.log('❌ Cannot access channel:', error.message);
        }
        
        console.log('\n🎯 TESTING INSTRUCTIONS:');
        console.log('1. Post a message in your notification channel');
        console.log('2. Send a message to the bot in private chat');
        console.log('3. Watch the console for message logs');
        console.log('4. Press Ctrl+C to stop the test');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Handle shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Stopping test...');
    bot.stopPolling();
    process.exit(0);
});

// Start the test
testChannelAccess();
