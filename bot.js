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
                    await bot.sendMessage(chatId, '⚠️ This chat is already in the target list.');
                } catch (error) {
                    console.error('❌ Failed to send already added message:', error.message);
                }
                return;
            }
            
            if (targetChats.size >= config.MAX_TARGET_CHATS) {
                console.log('❌ Maximum target chats limit reached');
                try {
                    await bot.sendMessage(chatId, `❌ Maximum number of target chats (${config.MAX_TARGET_CHATS}) reached. Please remove some chats first.`);
                } catch (error) {
                    console.error('❌ Failed to send limit reached message:', error.message);
                }
                return;
            }
            
            targetChats.add(chatId);
            saveTargetChats();
            console.log(`✅ Chat ${chatId} added to target list. Total: ${targetChats.size}`);
            
            try {
                await bot.sendMessage(chatId, `✅ This chat has been added to the target list!\n\n📊 Total target chats: ${targetChats.size}/${config.MAX_TARGET_CHATS}\n\n💡 Messages from the notification channel will now be forwarded here.`);
            } catch (error) {
                console.error('❌ Failed to send success message:', error.message);
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
            
            if (!targetChats.has(chatId)) {
                console.log('⚠️ Chat not in target list');
                try {
                    await bot.sendMessage(chatId, '⚠️ This chat is not in the target list.');
                } catch (error) {
                    console.error('❌ Failed to send not in list message:', error.message);
                }
                return;
            }
            
            targetChats.delete(chatId);
            saveTargetChats();
            console.log(`✅ Chat ${chatId} removed from target list. Total: ${targetChats.size}`);
            
            try {
                await bot.sendMessage(chatId, `✅ This chat has been removed from the target list.\n\n📊 Total target chats: ${targetChats.size}/${config.MAX_TARGET_CHATS}\n\n💡 Messages from the notification channel will no longer be forwarded here.`);
            } catch (error) {
                console.error('❌ Failed to send removal success message:', error.message);
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
                console.log('📋 No target chats configured');
                try {
                    await bot.sendMessage(chatId, '📋 No target chats configured yet.\n\n💡 Use /add in other chats to add them as targets.');
                } catch (error) {
                    console.error('❌ Failed to send no chats message:', error.message);
                }
                return;
            }
            
            const chatList = Array.from(targetChats).map(id => `• Chat ID: ${id}`).join('\n');
            const message = `📋 Target chats (${targetChats.size}/${config.MAX_TARGET_CHATS}):\n\n${chatList}`;
            
            try {
                await bot.sendMessage(chatId, message);
                console.log('✅ Target chats list sent successfully');
            } catch (error) {
                console.error('❌ Failed to send target chats list:', error.message);
            }
        }
        else if (text === '/status') {
            console.log('📊 Processing /status command...');
            if (!isAuthorized) {
                console.log('❌ User not authorized for /status command');
                try {
                    await bot.sendMessage(chatId, '❌ You are not authorized to use this command.');
                } catch (error) {
                    console.error('❌ Failed to send authorization error:', error.message);
                }
                return;
            }
            
            const statusMessage = `🤖 Bot Status:\n\n📊 Target chats: ${targetChats.size}/${config.MAX_TARGET_CHATS}\n📢 Notification channel: ${config.NOTIFICATION_CHANNEL_ID || 'Not configured'}\n👥 Authorized users: ${authorizedUsers.size}\n🔄 Bot is running and ready!`;
            
            try {
                await bot.sendMessage(chatId, statusMessage);
                console.log('✅ Status message sent successfully');
            } catch (error) {
                console.error('❌ Failed to send status message:', error.message);
            }
        }
        else if (text === '/test') {
            console.log('🧪 Processing /test command...');
            const testMessage = `🧪 Test message from bot!\n\n👤 Your user ID: ${userId}\n🔐 Authorized: ${isAuthorized ? '✅ Yes' : '❌ No'}\n💬 Chat ID: ${chatId}\n💬 Chat type: ${chatType}`;
            
            try {
                await bot.sendMessage(chatId, testMessage);
                console.log('✅ Test message sent successfully');
            } catch (error) {
                console.error('❌ Failed to send test message:', error.message);
            }
        }
        else if (text === '/help') {
            console.log('❓ Processing /help command...');
            const helpMessage = `🤖 Message Forwarding Bot - Help\n\nCommands:\n\n/start - Show welcome message\n/add - Add this chat as target\n/remove - Remove this chat from targets\n/list - Show all target chats\n/status - Show bot status\n/test - Test bot functionality\n/help - Show this help message\n\n💡 Admin commands require authorization.`;
            
            try {
                await bot.sendMessage(chatId, helpMessage);
                console.log('✅ Help message sent successfully');
            } catch (error) {
                console.error('❌ Failed to send help message:', error.message);
            }
        }
    }
});

// Handle bot being added to new chats
bot.on('new_chat_members', async (message) => {
    const chatId = message.chat.id;
    const chatType = message.chat.type;
    const newMembers = message.new_chat_members;
    const fromUser = message.from;
    
    console.log(`👥 Bot added to new ${chatType} ${chatId}`);
    console.log(`👤 Added by user: ${fromUser?.username || fromUser?.first_name || 'Unknown'} (ID: ${fromUser?.id})`);
    console.log(`👥 New members: ${newMembers.map(m => m.username || m.first_name || 'Unknown').join(', ')}`);
    
    // Check if bot is among new members
    const botInfo = await bot.getMe();
    const botAdded = newMembers.some(member => member.id === botInfo.id);
    
    if (botAdded) {
        console.log('🤖 Bot was added to this chat');
        
        // Check if the user who added the bot is authorized
        const isAuthorized = isUserAuthorized(fromUser.id);
        
        if (!isAuthorized) {
            console.log('❌ Bot added by unauthorized user - leaving chat');
            
            try {
                // Send warning message before leaving
                await bot.sendMessage(chatId, `⚠️ Warning: This bot was added by an unauthorized user.\n\n❌ Only authorized users can add this bot to chats.\n\n👤 User who added: ${fromUser?.username || fromUser?.first_name || 'Unknown'}\n🆔 User ID: ${fromUser?.id}\n\n🚫 Bot will leave this chat in 10 seconds.`);
                
                // Wait 10 seconds then leave
                setTimeout(async () => {
                    try {
                        await bot.leaveChat(chatId);
                        console.log(`✅ Bot left unauthorized chat ${chatId}`);
                    } catch (error) {
                        console.error(`❌ Failed to leave chat ${chatId}:`, error.message);
                    }
                }, 10000);
                
            } catch (error) {
                console.error('❌ Failed to send warning message:', error.message);
                // Try to leave immediately if can't send message
                try {
                    await bot.leaveChat(chatId);
                    console.log(`✅ Bot left unauthorized chat ${chatId} immediately`);
                } catch (leaveError) {
                    console.error(`❌ Failed to leave chat ${chatId}:`, leaveError.message);
                }
            }
        } else {
            console.log('✅ Bot added by authorized user - staying in chat');
            try {
                await bot.sendMessage(chatId, `🤖 Bot added successfully!\n\n👤 Added by: ${fromUser?.username || fromUser?.first_name || 'Unknown'}\n✅ User is authorized\n\n💡 Use /add to add this chat as a target for message forwarding.`);
            } catch (error) {
                console.error('❌ Failed to send welcome message:', error.message);
            }
        }
    }
});

// Handle bot being removed from chats
bot.on('left_chat_member', async (message) => {
    const chatId = message.chat.id;
    const chatType = message.chat.type;
    const leftMember = message.left_chat_member;
    const fromUser = message.from;
    
    console.log(`👋 Member left ${chatType} ${chatId}`);
    console.log(`👤 Left by: ${fromUser?.username || fromUser?.first_name || 'Unknown'} (ID: ${fromUser?.id})`);
    console.log(`👤 Left member: ${leftMember.username || leftMember.first_name || 'Unknown'} (ID: ${leftMember.id})`);
    
    // Check if bot was removed
    const botInfo = await bot.getMe();
    if (leftMember.id === botInfo.id) {
        console.log('🤖 Bot was removed from this chat');
        
        // Remove chat from target list if it was there
        if (targetChats.has(chatId)) {
            targetChats.delete(chatId);
            saveTargetChats();
            console.log(`🗑️ Chat ${chatId} removed from target list (bot was removed)`);
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
