# Telegram Message Forwarding Bot

A Node.js Telegram bot that automatically forwards messages from a notification channel to multiple target chats with advanced security features.

## Features

- 🤖 **Automatic message forwarding** from a notification channel to multiple chats
- 🔄 **Auto-detection** of notification channel when bot is added as admin
- 📝 **Persistent storage** of target chat IDs
- 🔧 **Easy management commands** for adding/removing target chats
- 📊 **Status monitoring** and statistics with chat names
- 🛡️ **User authorization system** - only authorized users can manage the bot
- ⚙️ **Configurable** via environment variables
- 🧪 **Test commands** for debugging and verification
- 🔍 **Enhanced logging** for troubleshooting

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
   AUTHORIZED_USERS=659506887,659506888,659506889
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

### 3. Add Bot to Your Channel

1. Go to your notification channel
2. Add your bot as an administrator with "Post Messages" permission
3. **The bot will automatically detect this channel as the notification source**

### 4. Start the Bot

```bash
npm start
```

## Usage

### Adding Target Chats

1. Start a private chat with your bot (or add it to a group)
2. Send `/start` to see the welcome message
3. Send `/add` to add the current chat as a target for forwarded messages

### Bot Commands

#### Basic Commands
- `/start` - Welcome message and instructions
- `/help` - Show detailed help message
- `/test` - Test bot functionality and get chat information

#### Management Commands (Authorized users only)
- `/add` - Add current chat to target list
- `/remove` - Remove current chat from target list
- `/list` - Show all target chats with names
- `/status` - Show bot status and statistics
- `/auth list` - Show authorized users

### How It Works

1. **Auto-detection**: When you add the bot as admin to a channel, it automatically becomes the notification source
2. **Message forwarding**: Messages posted in the notification channel are automatically forwarded to all target chats
3. **Persistent storage**: Target chats are stored in `target_chats.json`
4. **Error handling**: Invalid chat IDs are automatically removed when forwarding fails
5. **Security**: Only authorized users can manage the bot

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `BOT_TOKEN` | Your Telegram bot token | - | ✅ |
| `AUTHORIZED_USERS` | Comma-separated list of authorized user IDs | - | ⚠️ |
| `NOTIFICATION_CHANNEL_ID` | Channel ID to forward from | Auto-detected | ❌ |
| `TARGET_CHATS_FILE` | File to store target chats | `target_chats.json` | ❌ |
| `LOG_LEVEL` | Logging level | `info` | ❌ |
| `POLLING_TIMEOUT` | Polling timeout (ms) | `30000` | ❌ |
| `MAX_TARGET_CHATS` | Maximum target chats | `100` | ❌ |

### Security Configuration

#### Authorized Users
- Set `AUTHORIZED_USERS` in your `.env` file with comma-separated user IDs
- If not set, all users can use commands (backward compatibility)
- Example: `AUTHORIZED_USERS=659506887,659506888,659506889`

#### Notification Channel
- The bot automatically detects the notification channel when added as admin
- No manual configuration required
- The last channel where the bot is added as admin becomes the notification source

### File Structure

```
tgbot/
├── bot.js              # Main bot file
├── config.js           # Configuration
├── package.json        # Dependencies
├── env.example         # Environment template
├── .env               # Your environment variables (create this)
├── target_chats.json  # Target chats storage (auto-created)
└── README.md          # This file
```

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

3. **Bot not starting**
   - Verify your bot token is correct
   - Check that `AUTHORIZED_USERS` is properly formatted
   - Ensure all required environment variables are set

4. **Commands not working**
   - Check if you're in the authorized users list
   - Use `/auth list` to see current authorized users
   - Verify your user ID with `/test` command

### Debugging Commands

- `/test` - Test bot functionality and get chat information
- `/status` - Show detailed bot status including channel name
- `/list` - Show all target chats with their names

### Logs

The bot provides detailed console logs for debugging:
- Message reception and channel detection
- Forwarding attempts and results
- Authorization checks
- Error messages and chat management operations

## Security Features

- **User Authorization**: Only authorized users can manage the bot
- **Environment-based Configuration**: Authorized users configured via environment variables
- **Auto-detection**: Secure automatic channel detection
- **Error Handling**: Automatic cleanup of invalid chat IDs
- **No Message Storage**: Bot only forwards messages, doesn't store content

## Advanced Features

### Auto-detection System
- Automatically detects notification channel when bot is added as admin
- No manual channel ID configuration required
- Supports dynamic channel switching

### Enhanced Status Display
- Shows channel names instead of just IDs
- Displays target chat names in lists
- Provides detailed authorization status

### Robust Error Handling
- Automatic removal of invalid chat IDs
- Detailed error logging
- Graceful handling of API failures

## Contributing

Feel free to submit issues and enhancement requests!

## License

ISC License
