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
    const invalidChats = new Set();

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
                console.log(`🗑️ Chat ${chatId} is forbidden (403) - bot was removed or blocked`);
                invalidChats.add(chatId);
            } else if (error.response && error.response.statusCode === 400) {
                console.log(`⚠️ Bad request for chat ${chatId}: ${error.message}`);
                // Check if it's a "chat not found" error
                if (error.response.body && error.response.body.description && 
                    error.response.body.description.includes('chat not found')) {
                    console.log(`🗑️ Chat ${chatId} not found - removing from target list`);
                    invalidChats.add(chatId);
                }
            } else if (error.response && error.response.statusCode === 404) {
                console.log(`🗑️ Chat ${chatId} not found (404) - removing from target list`);
                invalidChats.add(chatId);
            } else {
                console.log(`⚠️ Other error for chat ${chatId}: ${error.message}`);
            }
        }
    }

    // Remove invalid chats from target list
    if (invalidChats.size > 0) {
        console.log(`🗑️ Removing ${invalidChats.size} invalid chats from target list...`);
        for (const chatId of invalidChats) {
            targetChats.delete(chatId);
            console.log(`🗑️ Removed chat ${chatId}`);
        }
        saveTargetChats();
        console.log(`💾 Updated target chats list saved to file`);
    }

    console.log(`\n📊 Forwarding complete: ${forwardedCount.success} successful, ${forwardedCount.failed} failed`);
    if (invalidChats.size > 0) {
        console.log(`🗑️ ${invalidChats.size} invalid chats were removed from target list`);
    }
}

// Handle incoming messages
bot.on('message', async (message) => {
    const chatId = message.chat.id;
    const chatType = message.chat.type;
    const fromUser = message.from;

    console.log(`📨 Received message from ${chatType} ${chatId} (${fromUser?.username || fromUser?.first_name || 'Unknown'})`);
    console.log(`📝 Message text: ${message.text || '[No text]'}`);
    console.log(`🆔 Message ID: ${message.message_id}`);

    // Check if message is from the configured notification channel
    if (chatId.toString() === config.NOTIFICATION_CHANNEL_ID.toString()) {
        console.log('🎯 Message from notification channel, forwarding...');
        await forwardMessage(message);
        return;
    }

    // Handle commands from private chats and groups
    if (chatType === 'private' || chatType === 'group' || chatType === 'supergroup') {
        const text = message.text || '';
        const userId = message.from.id;
        
        console.log(`🔐 User ID: ${userId}, Authorized: ${isUserAuthorized(userId)}`);
        
        // Check if user is authorized for admin commands
        const isAuthorized = isUserAuthorized(userId);
        
        if (text.startsWith('/start')) {
            console.log('🚀 Processing /start command...');
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

Note: The notification channel is configured via NOTIFICATION_CHANNEL_ID in .env file
            `;
            try {
                await bot.sendMessage(chatId, welcomeMessage);
                console.log('✅ Welcome message sent successfully');
            } catch (error) {
                console.error('❌ Failed to send welcome message:', error.message);
                if (error.response && error.response.statusCode === 403) {
                    console.log('⚠️  Bot was removed from this chat, skipping...');
                }
            }
        }
        else if (text === '/add') {
            console.log('➕ Processing /add command...');
            if (!isAuthorized) {
                console.log('❌ User not authorized for /add command');
                try {
                    await bot.sendMessage(chatId, '❌ You are not authorized to use this command.');
                } catch (error) {
                    console.error('❌ Failed to send authorization error:', error.message);
                }
                return;
            }
            
            if (targetChats.has(chatId)) {
                console.log('⚠️ Chat already in target list');
                try {
                    await bot.sendMessage(chatId, '❌ This chat is already in the target list.');
                } catch (error) {
                    console.error('❌ Failed to send already-added message:', error.message);
                }
            } else {
                targetChats.add(chatId);
                saveTargetChats();
                const chatName = message.chat.title || message.chat.username || 'this chat';
                console.log(`✅ Added chat ${chatName} (${chatId}) to target list`);
                try {
                    await bot.sendMessage(chatId, `✅ ${chatName} has been added to the target list.`);
                } catch (error) {
                    console.error('❌ Failed to send add confirmation:', error.message);
                }
            }
        }
        else if (text === '/remove') {
            console.log('➖ Processing /remove command...');
            if (!isAuthorized) {
                console.log('❌ User not authorized for /remove command');
                try {
                    await bot.sendMessage(chatId, '❌ You are not authorized to use this command.');
                } catch (error) {
                    console.error('❌ Failed to send authorization error:', error.message);
                }
                return;
            }
            
            if (targetChats.has(chatId)) {
                targetChats.delete(chatId);
                saveTargetChats();
                const chatName = message.chat.title || message.chat.username || 'this chat';
                console.log(`✅ Removed chat ${chatName} (${chatId}) from target list`);
                try {
                    await bot.sendMessage(chatId, `✅ ${chatName} has been removed from the target list.`);
                } catch (error) {
                    console.error('❌ Failed to send remove confirmation:', error.message);
                }
            } else {
                console.log('⚠️ Chat not in target list');
                try {
                    await bot.sendMessage(chatId, '❌ This chat is not in the target list.');
                } catch (error) {
                    console.error('❌ Failed to send not-in-list message:', error.message);
                }
            }
        }
        else if (text === '/list') {
            console.log('📋 Processing /list command...');
            if (!isAuthorized) {
                console.log('❌ User not authorized for /list command');
                try {
                    await bot.sendMessage(chatId, '❌ You are not authorized to use this command.');
                } catch (error) {
                    console.error('❌ Failed to send authorization error:', error.message);
                }
                return;
            }
            
            if (targetChats.size === 0) {
                console.log('📝 No target chats configured');
                try {
                    await bot.sendMessage(chatId, '📝 No target chats configured.');
                } catch (error) {
                    console.error('❌ Failed to send no-chats message:', error.message);
                }
            } else {
                console.log(`📝 Listing ${targetChats.size} target chats...`);
                const chatListPromises = Array.from(targetChats).map(async (id) => {
                    try {
                        const chatInfo = await bot.getChat(id);
                        const chatName = chatInfo.title || chatInfo.username || chatInfo.first_name || 'Unknown';
                        return `• ${chatName} (${id})`;
                    } catch (error) {
                        console.error(`❌ Failed to get chat info for ${id}:`, error.message);
                        // Remove invalid chat IDs
                        if (error.response && error.response.statusCode === 403) {
                            targetChats.delete(id);
                            console.log(`🗑️ Removed invalid chat ID: ${id} (403 Forbidden)`);
                        }
                        return `• Unknown chat (${id})`;
                    }
                });
                
                const chatList = await Promise.all(chatListPromises);
                const message = `📝 Target chats (${targetChats.size}):\n${chatList.join('\n')}`;
                try {
                    await bot.sendMessage(chatId, message);
                    console.log('✅ Chat list sent successfully');
                } catch (error) {
                    console.error('❌ Failed to send chat list:', error.message);
                }
                
                // Save updated chat list if any were removed
                if (targetChats.size !== Array.from(targetChats).length) {
                    saveTargetChats();
                }
            }
        }
        else if (text === '/status') {
            console.log('📊 Processing /status command...');
            let channelInfo = 'Not set';
            
            if (config.NOTIFICATION_CHANNEL_ID) {
                try {
                    const chatInfo = await bot.getChat(config.NOTIFICATION_CHANNEL_ID);
                    channelInfo = `${chatInfo.title || 'Unknown'} (${config.NOTIFICATION_CHANNEL_ID})`;
                } catch (error) {
                    console.error('❌ Failed to get notification channel info:', error.message);
                    channelInfo = `${config.NOTIFICATION_CHANNEL_ID} (Error getting info)`;
                }
            }
            
            const status = `
📊 Bot Status:
• Target chats: ${targetChats.size}
• Notification channel: ${channelInfo}
• Bot is running: ✅

Configuration: ${config.NOTIFICATION_CHANNEL_ID ? '✅ Set via .env' : '❌ Not configured'}
            `;
            try {
                await bot.sendMessage(chatId, status);
                console.log('✅ Status message sent successfully');
            } catch (error) {
                console.error('❌ Failed to send status message:', error.message);
            }
        }
        else if (text === '/test') {
            console.log('🧪 Processing /test command...');
            try {
                await bot.sendMessage(chatId, '🧪 Test message: Bot can send messages to this chat!');
                await bot.sendMessage(chatId, `📊 This chat ID: ${chatId}`);
                await bot.sendMessage(chatId, `📊 Chat type: ${chatType}`);
                await bot.sendMessage(chatId, `📊 Chat title: ${message.chat.title || 'Private Chat'}`);
                console.log('✅ Test messages sent successfully');
            } catch (error) {
                console.error('❌ Test failed:', error.message);
                try {
                    await bot.sendMessage(chatId, `❌ Test failed: ${error.message}`);
                } catch (sendError) {
                    console.error('❌ Failed to send error message:', sendError.message);
                }
            }
        }
        else if (text.startsWith('/auth')) {
            console.log('🔐 Processing /auth command...');
            if (!isAuthorized) {
                console.log('❌ User not authorized for /auth command');
                try {
                    await bot.sendMessage(chatId, '❌ You are not authorized to use this command.');
                } catch (error) {
                    console.error('❌ Failed to send authorization error:', error.message);
                }
                return;
            }
            
            const parts = text.split(' ');
            if (parts.length === 2) {
                const action = parts[1];
                if (action === 'list') {
                    if (authorizedUsers.size === 0) {
                        try {
                            await bot.sendMessage(chatId, '📝 No authorized users configured.');
                            await bot.sendMessage(chatId, '💡 To add authorized users, edit the AUTHORIZED_USERS variable in your .env file.');
                        } catch (error) {
                            console.error('❌ Failed to send auth list messages:', error.message);
                        }
                    } else {
                        const userList = Array.from(authorizedUsers).map(id => `• ${id}`).join('\n');
                        try {
                            await bot.sendMessage(chatId, `📝 Authorized users (${authorizedUsers.size}):\n${userList}`);
                            await bot.sendMessage(chatId, '💡 To modify authorized users, edit the AUTHORIZED_USERS variable in your .env file and restart the bot.');
                        } catch (error) {
                            console.error('❌ Failed to send auth list messages:', error.message);
                        }
                    }
                } else {
                    try {
                        await bot.sendMessage(chatId, 'Usage: /auth list');
                    } catch (error) {
                        console.error('❌ Failed to send auth usage message:', error.message);
                    }
                }
            } else {
                try {
                    await bot.sendMessage(chatId, 'Usage: /auth list');
                } catch (error) {
                    console.error('❌ Failed to send auth usage message:', error.message);
                }
            }
        }
        else if (text === '/help') {
            console.log('❓ Processing /help command...');
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
1. Set NOTIFICATION_CHANNEL_ID in your .env file to specify the source channel
2. Add this bot to your notification channel as an admin
3. Use /add in any chat (private, group, or channel) to add it as a target
4. Messages from the notification channel will be automatically forwarded to all target chats

Configuration:
- NOTIFICATION_CHANNEL_ID must be set manually in .env file
- The bot will no longer automatically change the notification channel
- To change the notification channel, update .env file and restart the bot

Security:
- Only authorized users can use admin commands
- Authorized users are configured via AUTHORIZED_USERS in .env file
- If no authorized users are set, all users can use commands (backward compatibility)
- To modify authorized users, edit .env file and restart the bot

Note: You can use these commands in private chats, groups, or channels where the bot is present.
            `;
            try {
                await bot.sendMessage(chatId, helpMessage);
                console.log('✅ Help message sent successfully');
            } catch (error) {
                console.error('❌ Failed to send help message:', error.message);
            }
        }
        else {
            console.log('❓ Unknown command received');
            try {
                await bot.sendMessage(chatId, 'Unknown command. Send /help for available commands.');
            } catch (error) {
                console.error('❌ Failed to send unknown command message:', error.message);
                if (error.response && error.response.statusCode === 403) {
                    console.log('⚠️  Bot was removed from this chat, skipping...');
                }
            }
        }
    }
});

// Handle channel posts (messages posted in channels)
bot.on('channel_post', async (post) => {
    const chatId = post.chat.id;
    const chatType = post.chat.type;

    console.log(`Received channel post from ${chatType} ${chatId} (${post.chat.title || 'Unknown Channel'})`);

    // Check if post is from the configured notification channel
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

// Note: NOTIFICATION_CHANNEL_ID is now set manually via .env file
// The bot will no longer automatically change the notification channel
// when added to other chats as admin

// Handle errors
bot.on('error', (error) => {
    console.error('❌ Bot error:', error);
    console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
    });
});

bot.on('polling_error', (error) => {
    console.error('❌ Polling error:', error);
    console.error('Polling error details:', {
        message: error.message,
        code: error.code,
        response: error.response ? {
            statusCode: error.response.statusCode,
            body: error.response.body
        } : 'No response'
    });
    
    // Don't exit on polling errors, just log them
    console.log('⚠️  Polling error occurred, but bot will continue running...');
});

// Initialize bot
async function startBot() {
    try {
        console.log('🤖 Starting Telegram Message Forwarding Bot...');
        console.log('🔍 Configuration check:');
        console.log(`   BOT_TOKEN: ${config.BOT_TOKEN ? '✅ Set' : '❌ Not set'}`);
        console.log(`   NOTIFICATION_CHANNEL_ID: ${config.NOTIFICATION_CHANNEL_ID || '❌ Not set'}`);
        console.log(`   TARGET_CHATS_FILE: ${config.TARGET_CHATS_FILE}`);
        
        // Load existing target chats
        console.log('📂 Loading target chats...');
        loadTargetChats();
        
        // Load authorized users
        console.log('👥 Loading authorized users...');
        loadAuthorizedUsers();
        
        // Get bot info
        console.log('🔍 Getting bot info from Telegram...');
        const botInfo = await bot.getMe();
        console.log(`✅ Bot info received: @${botInfo.username} (${botInfo.first_name})`);
        console.log(`📊 Bot ID: ${botInfo.id}`);
        console.log(`📊 Bot username: @${botInfo.username}`);
        console.log(`📊 Bot name: ${botInfo.first_name}`);
        console.log(`📊 Bot can join groups: ${botInfo.can_join_groups}`);
        console.log(`📊 Bot can read all group messages: ${botInfo.can_read_all_group_messages}`);
        
        console.log(`📋 Notification channel ID: ${config.NOTIFICATION_CHANNEL_ID || 'Not configured'}`);
        console.log(`📋 Target chats loaded: ${targetChats.size}`);
        
        if (!config.NOTIFICATION_CHANNEL_ID) {
            console.log('⚠️  Warning: NOTIFICATION_CHANNEL_ID not set in .env file');
            console.log('   Please set NOTIFICATION_CHANNEL_ID in your .env file and restart the bot');
        }
        
        console.log('🚀 Starting polling...');
        console.log('✅ Bot is running and ready to forward messages!');
        console.log('💡 Send /start to the bot to test if it\'s working');
        
    } catch (error) {
        console.error('❌ Failed to start bot:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            response: error.response ? {
                statusCode: error.response.statusCode,
                body: error.response.body
            } : 'No response'
        });
        
        // Don't exit immediately, try to continue
        console.log('⚠️  Bot failed to start, but will continue running...');
        console.log('💡 Check your configuration and restart if needed');
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
