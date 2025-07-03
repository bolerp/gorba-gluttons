# 🗑️ Gorba-Gluttons - Multiplayer Trash Racing Game

**The First Multiplayer Racing Game on Gorbagana Testnet**

A fast-paced, competitive multiplayer game built specifically for the Gorbagana testnet, showcasing zero-MEV execution and instant finality through exciting trash-themed racing mechanics.

🌐 **Live Demo**: [https://gorba.xyz](https://gorba.xyz)

## 🎮 Game Overview

Gorba-Gluttons is a real-time multiplayer game where players compete in thrilling races using native Gorbagana test tokens (GOR). The game combines:

- **Real-time Multiplayer Racing**: Up to 4 players race simultaneously
- **Blockchain-powered Prizes**: Winners receive GOR token rewards instantly
- **Progressive Monster Evolution**: Feed your Gorba-Glutton with different trash types
- **Achievement System**: Unlock rewards based on racing performance
- **Social Competition**: Climb leaderboards and build referral networks

### Game Modes
1. **Multiplayer Racing**: Real-time competitive races with entry fees and prizes
2. **Monster Feeding**: Interactive feeding system with transaction-based scoring

## 🔗 Gorbagana Integration Details

### Native Blockchain Features
- **Native GOR Token Usage**: Entry fees (0.05+ GOR) and prize distribution
- **Instant Finality**: Races conclude with immediate prize payouts
- **Zero-MEV Environment**: Fair racing mechanics guaranteed by Gorbagana's architecture
- **Web2-like Speed**: Real-time gameplay enabled by fast block times

### Smart Contract Integration
- **Automated Prize Distribution**: Winners receive payouts automatically via blockchain transactions
- **Transparent Racing**: All race results and prize distributions are on-chain
- **Wallet Integration**: Full support for Backpack wallet

### Technical Implementation
- **RPC Integration**: Direct connection to Gorbagana testnet via custom RPC proxy
- **Transaction Processing**: Real-time transaction signing and broadcasting
- **Balance Management**: Live GOR balance tracking and updates

## 🚀 How to Access the Demo

### Live Demo (Recommended)
1. Visit **[https://gorba.xyz](https://gorba.xyz)**
2. Connect your Backpack wallet
3. Ensure your wallet is connected to the Gorbagana testnet
4. Start playing immediately!

### Getting Test Tokens
- Join the Gorbagana Discord for test GOR tokens
- Or visit the official Gorbagana faucet https://faucet.gorbagana.wtf/

## 🛠️ Local Development Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Backpack wallet with Gorbagana testnet configured

### Frontend Setup
```bash
# Clone the repository
git clone https://github.com/bolerp/gorba-gluttons.git
cd gorba-gluttons

# Install dependencies
npm install

# Set environment variables
echo "NEXT_PUBLIC_API_URL=http://localhost:3001/api" > .env.local

# Start development server
npm run dev
```

### Backend Setup (Optional - for full local testing)
```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Configure environment variables
cp env.example .env
# Edit .env with your Gorbagana RPC URL and wallet keys

# Start the server
npm run dev
```

### Local Access
- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend API: [http://localhost:3001](http://localhost:3001)

## 🎯 Key Features Showcasing Gorbagana

### 1. Real-time Multiplayer (30-second races)
- Demonstrates Gorbagana's speed and low latency
- WebSocket connections for live race updates
- Instant result processing

### 2. Micro-transactions
- Small entry fees (0.05+ GOR) showcase practical token usage
- Instant prize distribution demonstrates network efficiency
- Gas-free user experience

### 3. Creative Token Utilization
- **Entry Fees**: Players pay GOR to join races
- **Prize Pools**: Automated distribution to winners
- **Achievement Rewards**: Bonus tokens for milestones
- **Referral System**: Network effect rewards

## 🏆 Competitive Elements

- **Leaderboards**: Daily, weekly, and all-time rankings
- **Achievement System**: 12+ unlockable achievements
- **Referral Network**: Build your "Garbage Patch" of referred players
- **Seasonal Competition**: Season 1: Slime Season currently active

## 🔧 Technical Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Backend**: Node.js, Express, Socket.IO
- **Blockchain**: Gorbagana testnet integration
- **Database**: Supabase (race results and leaderboards)
- **Deployment**: Vercel (frontend) + VPS (backend)

## 🎮 Wallet Support

- **Primary**: Backpack wallet (recommended)
- **Features**: Auto-connect, balance display, transaction signing

## 📱 Supported Platforms

- **Desktop**: Full experience with all features

## 🌟 What Makes This Special

1. **First Real Multiplayer Game** on Gorbagana testnet
2. **Practical Token Economics** - not just speculation
3. **Community Building** through referrals and competition
4. **Technical Innovation** - showcases Gorbagana's speed advantages
5. **Engaging Gameplay** - replayable and addictive racing mechanics

---

**Built for #GorbaganaTestnet** | **Follow**: @Gorbagana_chain @sarv_shaktimaan @lex_node
