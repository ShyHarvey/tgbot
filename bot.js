const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

// Configuration
const config = require('./config');

// Create bot instance
const bot = new TelegramBot(config.BOT_TOKEN, { polling: true });

// Store for target chat IDs
let targetChats = new Set();

// Store for authorized user IDs (whitelist) - loaded from config
let authorizedUsers = new Set();

// Load target chats from file
function loadTargetChats() {
    try {
        if (fs.existsSync(config.TARGET_CHATS_FILE)) {
            const data = fs.readFileSync(config.TARGET_CHATS_FILE, 'utf8');
            const chats = JSON.parse(data);
            targetChats = new Set(chats);
            console.log(`Loaded ${targetChats.size} target chats`);
        }
    } catch (error) {
        console.error('Error loading target chats:', error);
    }
}

// Load authorized users from config
function loadAuthorizedUsers() {
    try {
        authorizedUsers = new Set(config.AUTHORIZED_USERS);
        console.log(`Loaded ${authorizedUsers.size} authorized users from config`);
    } catch (error) {
        console.error('Error loading authorized users:', error);
    }
}

// Save target chats to file
function saveTargetChats() {
    try {
        const chats = Array.from(targetChats);
        fs.writeFileSync(config.TARGET_CHATS_FILE, JSON.stringify(chats, null, 2));
        console.log(`Saved ${targetChats.size} target chats`);
    } catch (error) {
        console.error('Error saving target chats:', error);
    }
}



// Check if user is authorized
function isUserAuthorized(userId) {
    // If no authorized users are set, allow all users (backward compatibility)
    if (authorizedUsers.size === 0) {
        return true;
    }
    return authorizedUsers.has(userId);
}

// Set notification channel
async function setNotificationChannel(channelId, channelTitle) {
    try {
        // Update .env file
        const envPath = '.env';
        let envContent = '';
        
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }
        
        // Replace or add NOTIFICATION_CHANNEL_ID
        const channelIdLine = `NOTIFICATION_CHANNEL_ID=${channelId}`;
        if (envContent.includes('NOTIFICATION_CHANNEL_ID=')) {
            envContent = envContent.replace(/NOTIFICATION_CHANNEL_ID=.*/g, channelIdLine);
        } else {
            envContent += `\n${channelIdLine}`;
        }
        
        fs.writeFileSync(envPath, envContent);
        
        // Update config
        config.NOTIFICATION_CHANNEL_ID = channelId.toString();
        
        console.log(`✅ Notification channel set to: ${channelId} (${channelTitle})`);
        console.log(`📝 Updated .env file`);
        
        return true;
    } catch (error) {
        console.error('Error setting notification channel:', error);
        return false;
    }
}

// Forward message to all target chats
async function forwardMessage(message) {
    console.log(`\n🔄 forwardMessage called with:`, {
        chatId: message.chat.id,
        messageId: message.message_id,
        text: message.text ? message.text.substring(0, 50) + '...' : '[No text]'
    });
    
    if (targetChats.size === 0) {
        console.log('❌ No target chats configured');
        return;
    }

    const forwardedCount = { success: 0, failed: 0 };

    console.log(`\n📤 Starting to forward message to ${targetChats.size} target chats...`);
    console.log(`📋 Target chats: ${Array.from(targetChats).join(', ')}`);

    for (const chatId of targetChats) {
        try {
            console.log(`Attempting to forward to chat ${chatId}...`);
            await bot.forwardMessage(chatId, message.chat.id, message.message_id);
            forwardedCount.success++;
            console.log(`✅ Successfully forwarded message to chat ${chatId}`);
        } catch (error) {
            forwardedCount.failed++;
            console.error(`❌ Failed to forward message to chat ${chatId}:`, error.message);
            
            // Remove invalid chat IDs
            if (error.response && error.response.statusCode === 403) {
                targetChats.delete(chatId);
                console.log(`🗑️ Removed invalid chat ID: ${chatId} (403 Forbidden)`);
            } else if (error.response && error.response.statusCode === 400) {
                console.log(`⚠️ Bad request for chat ${chatId}: ${error.message}`);
            } else {
                console.log(`⚠️ Other error for chat ${chatId}: ${error.message}`);
            }
        }
    }

    console.log(`\n📊 Forwarding complete: ${forwardedCount.success} successful, ${forwardedCount.failed} failed`);
    
    // Save updated chat list if any were removed
    if (forwardedCount.failed > 0) {
        saveTargetChats();
    }
}

// Handle incoming messages
bot.on('message', async (message) => {
    const chatId = message.chat.id;
    const chatType = message.chat.type;
    const fromUser = message.from;

    console.log(`Received message from ${chatType} ${chatId} (${fromUser?.username || fromUser?.first_name || 'Unknown'})`);

    // Check if message is from the notification channel
    if (chatId.toString() === config.NOTIFICATION_CHANNEL_ID.toString()) {
        console.log('Message from notification channel, forwarding...');
        await forwardMessage(message);
        return;
    }

    // Handle commands from private chats and groups
    if (chatType === 'private' || chatType === 'group' || chatType === 'supergroup') {
        const text = message.text || '';
        const userId = message.from.id;
        
        // Check if user is authorized for admin commands
        const isAuthorized = isUserAuthorized(userId);
        
        if (text.startsWith('/start')) {
            const welcomeMessage = `
🤖 Welcome to the Message Forwarding Bot!

This bot forwards messages from a notification channel to multiple target chats.

Commands:
/add - Add this chat as a target for forwarded messages
/remove - Remove this chat from target list
/list - Show all target chats
/status - Show bot status
/help - Show this help message

To add this chat as a target, send /add
            `;
            await bot.sendMessage(chatId, welcomeMessage);
        }
        else if (text === '/add') {
            if (!isAuthorized) {
                await bot.sendMessage(chatId, '❌ You are not authorized to use this command.');
                return;
            }
            
            if (targetChats.has(chatId)) {
                await bot.sendMessage(chatId, '❌ This chat is already in the target list.');
            } else {
                targetChats.add(chatId);
                saveTargetChats();
                const chatName = message.chat.title || message.chat.username || 'this chat';
                await bot.sendMessage(chatId, `✅ ${chatName} has been added to the target list.`);
            }
        }
        else if (text === '/remove') {
            if (!isAuthorized) {
                await bot.sendMessage(chatId, '❌ You are not authorized to use this command.');
                return;
            }
            
            if (targetChats.has(chatId)) {
                targetChats.delete(chatId);
                saveTargetChats();
                const chatName = message.chat.title || message.chat.username || 'this chat';
                await bot.sendMessage(chatId, `✅ ${chatName} has been removed from the target list.`);
            } else {
                await bot.sendMessage(chatId, '❌ This chat is not in the target list.');
            }
        }
        else if (text === '/list') {
            if (!isAuthorized) {
                await bot.sendMessage(chatId, '❌ You are not authorized to use this command.');
                return;
            }
            
            if (targetChats.size === 0) {
                await bot.sendMessage(chatId, '📝 No target chats configured.');
            } else {
                const chatListPromises = Array.from(targetChats).map(async (id) => {
                    try {
                        const chatInfo = await bot.getChat(id);
                        const chatName = chatInfo.title || chatInfo.username || chatInfo.first_name || 'Unknown';
                        return `• ${chatName} (${id})`;
                    } catch (error) {
                        return `• Unknown chat (${id})`;
                    }
                });
                
                const chatList = await Promise.all(chatListPromises);
                await bot.sendMessage(chatId, `📝 Target chats (${targetChats.size}):\n${chatList.join('\n')}`);
            }
        }
        else if (text === '/status') {
            let channelInfo = 'Not set';
            
            if (config.NOTIFICATION_CHANNEL_ID) {
                try {
                    const chatInfo = await bot.getChat(config.NOTIFICATION_CHANNEL_ID);
                    channelInfo = `${chatInfo.title || 'Unknown'} (${config.NOTIFICATION_CHANNEL_ID})`;
                } catch (error) {
                    channelInfo = `${config.NOTIFICATION_CHANNEL_ID} (Error getting info)`;
                }
            }
            
            const status = `
📊 Bot Status:
• Target chats: ${targetChats.size}
• Notification channel: ${channelInfo}
• Bot is running: ✅

Auto-detection: ${config.NOTIFICATION_CHANNEL_ID ? '✅ Active' : '❌ No channel set'}
            `;
            await bot.sendMessage(chatId, status);
        }
        else if (text === '/test') {
            try {
                await bot.sendMessage(chatId, '🧪 Test message: Bot can send messages to this chat!');
                await bot.sendMessage(chatId, `📊 This chat ID: ${chatId}`);
                await bot.sendMessage(chatId, `📊 Chat type: ${chatType}`);
                await bot.sendMessage(chatId, `📊 Chat title: ${message.chat.title || 'Private Chat'}`);
            } catch (error) {
                await bot.sendMessage(chatId, `❌ Test failed: ${error.message}`);
            }
        }

        else if (text.startsWith('/auth')) {
            if (!isAuthorized) {
                await bot.sendMessage(chatId, '❌ You are not authorized to use this command.');
                return;
            }
            
            const parts = text.split(' ');
            if (parts.length === 2) {
                const action = parts[1];
                if (action === 'list') {
                    if (authorizedUsers.size === 0) {
                        await bot.sendMessage(chatId, '📝 No authorized users configured.');
                        await bot.sendMessage(chatId, '💡 To add authorized users, edit the AUTHORIZED_USERS variable in your .env file.');
                    } else {
                        const userList = Array.from(authorizedUsers).map(id => `• ${id}`).join('\n');
                        await bot.sendMessage(chatId, `📝 Authorized users (${authorizedUsers.size}):\n${userList}`);
                        await bot.sendMessage(chatId, '💡 To modify authorized users, edit the AUTHORIZED_USERS variable in your .env file and restart the bot.');
                    }
                } else {
                    await bot.sendMessage(chatId, 'Usage: /auth list');
                }
            } else {
                await bot.sendMessage(chatId, 'Usage: /auth list');
            }
        }
        else if (text === '/help') {
            const helpMessage = `
🤖 Message Forwarding Bot Help

Commands:
/start - Welcome message and instructions
/test - Test if bot can send messages to this chat
/help - Show this help message

Admin Commands (Authorized users only):
/add - Add this chat as a target for forwarded messages
/remove - Remove this chat from target list
/list - Show all target chats with names
/status - Show bot status and statistics
/auth list - Show authorized users

How it works:
1. Add this bot to your notification channel as an admin
2. The bot will automatically set this channel as the notification source
3. Use /add in any chat (private, group, or channel) to add it as a target
4. Messages from the notification channel will be automatically forwarded to all target chats

Auto-detection:
- The last channel where you add the bot as admin becomes the notification channel
- Each time you add the bot to a new channel as admin, it becomes the new notification channel
- Simply add the bot to any channel as admin to make it the notification source

Security:
- Only authorized users can use admin commands
- Authorized users are configured via AUTHORIZED_USERS in .env file
- If no authorized users are set, all users can use commands (backward compatibility)
- To modify authorized users, edit .env file and restart the bot

Note: You can use these commands in private chats, groups, or channels where the bot is present.
            `;
            await bot.sendMessage(chatId, helpMessage);
        }
        else {
            await bot.sendMessage(chatId, 'Unknown command. Send /help for available commands.');
        }
    }
});

// Handle channel posts (messages posted in channels)
bot.on('channel_post', async (post) => {
    const chatId = post.chat.id;
    const chatType = post.chat.type;

    console.log(`Received channel post from ${chatType} ${chatId} (${post.chat.title || 'Unknown Channel'})`);

    // Check if post is from the notification channel
    console.log(`🔍 Comparing: chatId=${chatId} (${typeof chatId}) vs config=${config.NOTIFICATION_CHANNEL_ID} (${typeof config.NOTIFICATION_CHANNEL_ID})`);
    
    if (chatId.toString() === config.NOTIFICATION_CHANNEL_ID.toString()) {
        console.log('🎯 Channel post from notification channel, forwarding...');
        console.log(`📝 Post content: ${post.text || '[No text]'}`);
        console.log(`📝 Post ID: ${post.message_id}`);
        await forwardMessage(post);
        return;
    } else {
        console.log(`⚠️ Channel post from different channel: ${chatId} (expected: ${config.NOTIFICATION_CHANNEL_ID})`);
    }
});

// Handle bot status updates (when bot is added/removed from chats)
bot.on('my_chat_member', async (chatMember) => {
    const chatId = chatMember.chat.id;
    const chatType = chatMember.chat.type;
    const newStatus = chatMember.new_chat_member.status;
    const oldStatus = chatMember.old_chat_member?.status || 'none';

    console.log(`🤖 Bot status changed in ${chatType} ${chatId} (${chatMember.chat.title || 'Unknown'})`);
    console.log(`   Status: ${oldStatus} → ${newStatus}`);

    // If bot was added as admin to a channel
    if (chatType === 'channel' && newStatus === 'administrator') {
        console.log('🎯 Bot added as admin to channel - setting as notification channel...');
        
        try {
            await setNotificationChannel(chatId, chatMember.chat.title);
        } catch (error) {
            console.error('Error handling channel admin addition:', error);
        }
    }
    
    // If bot was removed from a channel
    if (chatType === 'channel' && oldStatus === 'administrator' && newStatus !== 'administrator') {
        console.log('❌ Bot removed from channel admin');
        
        // If this was the notification channel, clear it
        if (chatId.toString() === config.NOTIFICATION_CHANNEL_ID.toString()) {
            console.log('⚠️ Bot was removed from notification channel!');
            console.log('   Please add bot to another channel as admin or set notification channel manually');
        }
    }
});

// Handle errors
bot.on('error', (error) => {
    console.error('Bot error:', error);
});

bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

// Initialize bot
async function startBot() {
    try {
        console.log('🤖 Starting Telegram Message Forwarding Bot...');
        
        // Load existing target chats
        loadTargetChats();
        
        // Load authorized users
        loadAuthorizedUsers();
        
        // Get bot info
        const botInfo = await bot.getMe();
        console.log(`Bot started: @${botInfo.username} (${botInfo.first_name})`);
        console.log(`Notification channel ID: ${config.NOTIFICATION_CHANNEL_ID}`);
        console.log(`Target chats loaded: ${targetChats.size}`);
        
        console.log('✅ Bot is running and ready to forward messages!');
    } catch (error) {
        console.error('Failed to start bot:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down bot...');
    bot.stopPolling();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down bot...');
    bot.stopPolling();
    process.exit(0);
});

// Start the bot
startBot();
