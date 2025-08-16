require('dotenv').config();

module.exports = {
    // Bot token from BotFather
    BOT_TOKEN: process.env.BOT_TOKEN || '',
    
    // Notification channel ID (where messages will be forwarded from)
    // This should be the channel ID where your bot is an admin
    NOTIFICATION_CHANNEL_ID: process.env.NOTIFICATION_CHANNEL_ID || '',
    
    // File to store target chat IDs
    TARGET_CHATS_FILE: process.env.TARGET_CHATS_FILE || 'target_chats.json',
    
    // Logging level
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    
    // Maximum number of target chats
    MAX_TARGET_CHATS: parseInt(process.env.MAX_TARGET_CHATS) || 100,
    
    // Authorized users list (comma-separated user IDs)
    AUTHORIZED_USERS: process.env.AUTHORIZED_USERS ? 
        process.env.AUTHORIZED_USERS.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : 
        []
};
