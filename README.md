# Telegram Message Forwarding Bot

A Node.js Telegram bot that automatically forwards messages from a notification channel to multiple target chats with advanced security features and HTTP health monitoring.

## Features

### 🔐 **Authorization System**
- **Whitelist Protection**: Only users listed in `AUTHORIZED_USERS` can add the bot to chats
- **Automatic Chat Removal**: Bot automatically leaves chats if added by unauthorized users
- **Admin Commands**: Restricted commands require authorization
- **Backward Compatibility**: If no `AUTHORIZED_USERS` set, all users can use commands

### 🚫 **Anti-Spam Protection**
- **Unauthorized User Detection**: Bot detects when added by non-authorized users
- **Automatic Exit**: Leaves unauthorized chats after 10-second warning
- **Audit Logging**: Logs all addition/removal attempts with user details

### 📱 **Message Forwarding**
- **Multi-Chat Support**: Forward messages to multiple target chats simultaneously
- **Automatic Cleanup**: Removes invalid/forbidden chat IDs automatically
- **Error Handling**: Graceful handling of API errors and chat restrictions

## Prerequisites

- Node.js (v14 or higher)
- A Telegram bot token (get from [@BotFather](https://t.me/BotFather))
- A Telegram channel where the bot will be an admin

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment template:
   ```bash
   cp env.example .env
   ```

4. Edit `.env` file with your configuration:
   ```env
   BOT_TOKEN=your_bot_token_here
   NOTIFICATION_CHANNEL_ID=-1001234567890
   AUTHORIZED_USERS=659506887,659506888,659506889
   PORT=3000
   ```

## Setup Instructions

### 1. Create a Telegram Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` command
3. Follow the instructions to create your bot
4. Copy the bot token and add it to your `.env` file

### 2. Configure Authorized Users

1. Start a private chat with your bot
2. Send `/test` to get your user ID
3. Add your user ID to the `AUTHORIZED_USERS` variable in `.env`:
   ```env
   AUTHORIZED_USERS=659506887
   ```
4. For multiple users, separate IDs with commas:
   ```env
   AUTHORIZED_USERS=659506887,659506888,659506889
   ```

### 3. Configure Notification Channel

1. Get your channel ID by forwarding a message from the channel to [@userinfobot](https://t.me/userinfobot)
2. Add the channel ID to your `.env` file:
   ```env
   NOTIFICATION_CHANNEL_ID=-1001234567890
   ```
3. Add your bot as an administrator to the channel with "Post Messages" permission

### 4. Start the Bot

```bash
npm start
```

The bot will start both an HTTP server (for health monitoring) and the Telegram bot in separate processes.

## Security Note

**Important**: The bot's authorization system is designed for security:
- Only users listed in `AUTHORIZED_USERS` can add the bot to chats or use admin commands
- Authorization can **ONLY** be managed by editing the `.env` file
- No bot commands exist to view or modify authorization status
- If an unauthorized user tries to add the bot to a chat, it will automatically leave after a warning

## Architecture

### Dual Process Design
- **HTTP Server**: Express server running on port 3000 (or `PORT` env variable)
- **Bot Process**: Telegram bot running in a separate Node.js process
- **Health Monitoring**: Built-in endpoints for deployment platform health checks

### How It Works
- **Telegram Bot**: Uses polling mode to receive updates from Telegram API
- **HTTP Server**: Provides health check endpoints for deployment platforms
- **Message Forwarding**: Bot forwards messages from notification channel to target chats
- **Process Separation**: Bot runs independently from HTTP server for stability

### HTTP Endpoints
- `GET /` - Main status page with bot information
- `GET /health` - Simple health check endpoint for deployment platforms

## Usage

### Adding Target Chats

1. **Get your User ID**: Start a private chat with your bot and send `/test` to get your user ID
2. **Add to AUTHORIZED_USERS**: Add your user ID to `AUTHORIZED_USERS` in `.env` file and restart the bot
3. **Add bot to target chat**: Add the bot to the chat you want as a target
4. **Use /add command**: Send `/add` in the target chat to add it to the forwarding list

**Note**: Only authorized users can add chats as targets. If you're not authorized, the bot will not respond to `/add` commands.

## Bot Commands

### 🔓 **Public Commands** (Available to all users)
- `/start` - Show welcome message and instructions
- `/test` - Test bot functionality and get your user ID
- `/help` - Show available commands

### 🔐 **Admin Commands** (Require authorization)
- `/add` - Add current chat as target for message forwarding
- `/remove` - Remove current chat from target list
- `/list` - Show all target chats
- `/status` - Show bot status and statistics

### 📋 **Command Details**
- **Authorization Required**: Admin commands check `AUTHORIZED_USERS` from `.env`
- **User ID Discovery**: Use `/test` command to get your user ID for authorization
- **Chat Management**: Add/remove chats from target list for message forwarding
- **Status Monitoring**: Check bot health, target count, and configuration
- **Security**: Authorization can only be managed via `.env` file, not through bot commands

### How It Works

1. **Configuration**: The notification channel is specified via `NOTIFICATION_CHANNEL_ID` in `.env` file
2. **Message forwarding**: Messages posted in the notification channel are automatically forwarded to all target chats
3. **Persistent storage**: Target chats are stored in `target_chats.json`
4. **Error handling**: Invalid chat IDs are automatically removed when forwarding fails
5. **Security**: Only authorized users can manage the bot
6. **Health monitoring**: HTTP server provides health check endpoints for deployment platforms

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `BOT_TOKEN` | Your Telegram bot token | - | ✅ |
| `NOTIFICATION_CHANNEL_ID` | Channel ID to forward from | - | ✅ |
| `AUTHORIZED_USERS` | Comma-separated list of authorized user IDs | - | ⚠️ |
| `PORT` | HTTP server port | `3000` | ❌ |
| `TARGET_CHATS_FILE` | File to store target chats | `target_chats.json` | ❌ |
| `LOG_LEVEL` | Logging level | `info` | ❌ |
| `MAX_TARGET_CHATS` | Maximum target chats | `100` | ❌ |

### Security Configuration

#### Authorized Users
- Set `AUTHORIZED_USERS` in your `.env` file with comma-separated user IDs
- If not set, all users can use commands (backward compatibility)
- Example: `AUTHORIZED_USERS=659506887,659506888,659506889`

#### Notification Channel
- The notification channel must be manually configured via `NOTIFICATION_CHANNEL_ID` in `.env` file
- The bot will no longer automatically change the notification channel
- To change the notification channel, update `.env` file and restart the bot

### File Structure

```
tgbot/
├── server.js           # HTTP server and bot process manager
├── bot.js              # Main bot logic
├── config.js           # Configuration
├── package.json        # Dependencies
├── env.example         # Environment template
├── .env               # Your environment variables (create this)
├── target_chats.json  # Target chats storage (auto-created)
├── setup.js           # Setup utility
├── debug.js           # Debug utilities
├── test_channel.js    # Channel testing utilities
└── README.md          # This file
```

## Deployment

### Platform Compatibility
This bot is designed to work with deployment platforms that require HTTP endpoints:
- **Heroku**: Automatically uses `PORT` environment variable
- **Railway**: Health check endpoint at `/health`
- **Render**: HTTP server prevents timeout issues
- **DigitalOcean App Platform**: Compatible with health checks

### Health Monitoring
- **Main endpoint**: `GET /` - Returns JSON with bot status
- **Health check**: `GET /health` - Returns simple "OK" response
- **Automatic cleanup**: Invalid chat IDs are automatically removed
- **Process management**: Bot runs in separate process for stability

## Troubleshooting

### Common Issues

1. **Bot not receiving messages from channel**
   - Make sure the bot is an admin in the channel
   - Check that the bot has "Post Messages" permission
   - Verify the channel ID in `/status` command

2. **Forwarding fails**
   - Ensure target chats haven't blocked the bot
   - Check that the bot has permission to send messages
   - Use `/test` command to verify bot permissions
   - Invalid chats are automatically removed from target list

3. **Bot not starting**
   - Verify your bot token is correct
   - Check that `NOTIFICATION_CHANNEL_ID` is properly set
   - Ensure all required environment variables are set
   - Check HTTP server logs for detailed error information

4. **Commands not working**
   - Check if you're in the authorized users list
   - Verify your user ID with `/test` command
   - Ensure `AUTHORIZED_USERS` is properly configured in `.env`

5. **HTTP server issues**
   - Check if port 3000 (or your custom PORT) is available
   - Verify Express dependency is installed
   - Check server logs for connection errors

### Debugging Commands

- `/test` - Test bot functionality and get chat information
- `/status` - Show detailed bot status including channel name
- `/list` - Show all target chats with their names

### Logs

The bot provides detailed console logs for debugging:
- **HTTP Server**: Port binding, health check requests
- **Bot Process**: Message reception, channel detection, forwarding
- **Error Handling**: Detailed error messages with status codes
- **Chat Management**: Authorization checks, chat operations

## Security Features

- **User Authorization**: Only authorized users can manage the bot
- **Environment-based Configuration**: Sensitive data stored in environment variables
- **Static Configuration**: Notification channel configured once via environment variables
- **Error Handling**: Automatic cleanup of invalid chat IDs
- **No Message Storage**: Bot only forwards messages, doesn't store content
- **Process Isolation**: Bot runs in separate process from HTTP server

## Advanced Features

### Robust Error Handling
- **Automatic cleanup**: Invalid chat IDs are automatically removed
- **HTTP status codes**: Proper error handling for different failure types
- **Graceful degradation**: Bot continues running even if some operations fail
- **Detailed logging**: Comprehensive error information for debugging

### Enhanced Status Display
- **Channel information**: Shows channel names instead of just IDs
- **Target chat names**: Displays readable names in lists
- **Authorization status**: Clear indication of user permissions
- **Process health**: HTTP server and bot process status

### Deployment Optimizations
- **Health check endpoints**: Compatible with deployment platforms
- **Port configuration**: Flexible port assignment via environment variables
- **Process management**: Stable bot operation in containerized environments
- **Graceful shutdown**: Proper cleanup on process termination

## Contributing

Feel free to submit issues and enhancement requests!

## License

ISC License

## Security & Protection

### 🛡️ **Authorization System**
The bot implements a comprehensive authorization system to prevent unauthorized access:

- **Whitelist Protection**: Only users listed in `AUTHORIZED_USERS` environment variable can:
  - Add the bot to new chats
  - Use admin commands (`/add`, `/remove`, `/list`, `/status`)
  - Manage target chat lists

- **Automatic Protection**: If an unauthorized user tries to add the bot to a chat:
  - Bot sends a 10-second warning message
  - Automatically leaves the chat after warning
  - Logs the attempt with user details for audit

- **Configuration Only**: Authorization can only be managed by editing the `.env` file
- **No Command Access**: Users cannot view or modify authorization status through bot commands

### 🚫 **Anti-Spam Measures**
- **Unauthorized User Detection**: Bot identifies when added by non-authorized users
- **Immediate Response**: Leaves unauthorized chats to prevent abuse
- **Audit Logging**: Comprehensive logging of all addition/removal attempts
- **User Verification**: Checks user authorization before allowing any admin actions

### 🔒 **Configuration Security**
- **Environment Variables**: Sensitive data stored in `.env` file (not in code)
- **User ID Validation**: Strict checking of user IDs against authorized list
- **Chat Validation**: Automatic removal of invalid/forbidden chat IDs
- **Error Handling**: Graceful handling of security-related errors
