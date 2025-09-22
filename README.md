# XRP Transaction Playground

A playground application for creating and signing XRP Ledger transactions using the XAMAN (formerly XUMM) wallet. This tool is designed to help developers understand and work with XRP transactions, including features for cross-chain communication with the XRPL EVM sidechain.

## Features

### 🔐 XAMAN Wallet Integration
- Create and sign XRP transactions using your XAMAN wallet
- API key management with local storage (Ideally securely managed on a server)
- Real-time transaction status monitoring
- QR code generation for easy mobile signing

### 🔄 Cross-Chain Communication
- **Axelar GMP Payload Creator**: Generate ABI-encoded payloads for Axelar General Message Passing
- **String to Hex Converter**: Convert text to hexadecimal format for memo fields
- Built-in documentation and examples for interchain transfers

### 📝 Transaction Builder
- Monaco Editor with JSON syntax highlighting
- Real-time validation and formatting
- Support for all XRP Ledger transaction types
- Automatic transaction JSON saving

## Getting Started

### Prerequisites
- Node.js 18+ and pnpm
- XAMAN Developer API credentials
- XAMAN wallet app on your mobile device

### Installation

1. Clone the repository:
```bash
git clone https://github.com/FinHubSA/xrp-transaction-playground.git
cd xrp-transaction-playground
```

2. Install dependencies:
```bash
pnpm install
```

3. Run the development server:
```bash
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### XAMAN API Setup

1. Visit the [XAMAN Developer Console](https://apps.xaman.dev/)
2. Create a new application and obtain your API Key and API Secret
3. Enter these credentials in the app's API credentials section
4. Credentials are stored locally in your browser

## Usage

### Basic Transaction Creation

1. **Enter API Credentials**: Input your XAMAN API Key and Secret
2. **Create Transaction JSON**: Use the Monaco editor to write your XRP transaction
3. **Sign with XAMAN**: Click "Sign with Xumm" to generate a QR code
4. **Scan and Sign**: Use your XAMAN mobile app to scan the QR code and sign

### Cross-Chain Transactions (XRPL to XRPL EVM)

This app supports creating transactions for Axelar General Message Passing (GMP) to send messages from XRPL to the XRPL EVM sidechain.

#### Required Memos for Interchain Transfers:

1. **MemoType**: `type`  
   **MemoData**: `interchain_transfer`

2. **MemoType**: `destination_address`  
   **MemoData**: `9bEb991eDdF92528E6342Ec5f7B0846C24cbaB58` (Squid router contract)

3. **MemoType**: `destination_chain`  
   **MemoData**: `xrpl-evm`

4. **MemoType**: `gas_fee_amount`  
   **MemoData**: `100000`

5. **MemoType**: `payload`  
   **MemoData**: `[encoded payload from Axelar GMP section]`

#### Creating the Payload:

1. Use the **Axelar GMP Payload Creator** section
2. Enter the destination contract address on XRPL EVM
3. Generate a random salt (or use the provided generator)
4. Copy the ABI-encoded payload
5. Use the **String to Hex Converter** to convert memo data to hex format

### Example Transaction JSON

```json
{
  "TransactionType": "Payment",
  "Account": "rYourAccount...",
  "Destination": "rGatewayAddress...",
  "Amount": "4000000",
  "Fee": "12",
  "Memos": [
    {
      "Memo": {
        "MemoType": "74797065",
        "MemoData": "696E746572636861696E5F7472616E73666572"
      }
    },
    {
      "Memo": {
        "MemoType": "64657374696E6174696F6E5F61646472657373",
        "MemoData": "39624562393931654464463932353238453633343245633566374230383436433234636261423538"
      }
    },
    {
      "Memo": {
        "MemoType": "64657374696E6174696F6E5F636861696E",
        "MemoData": "7872706C2D65766D"
      }
    },
    {
      "Memo": {
        "MemoType": "7061796C6F6164",
        "MemoData": "0x000000000000000000000000[your-encoded-payload]"
      }
    }
  ]
}
```

## Tools

### String to Hex Converter
Converts text strings to hexadecimal format required for memo fields in XRP transactions. Essential for creating properly formatted interchain transfer memos.

### Axelar GMP Payload Creator
- Generates ABI-encoded payloads for Axelar General Message Passing
- Encodes destination addresses and random salts
- Creates the data needed for cross-chain smart contract calls

## Documentation Links

- [XRPL EVM Cross-Chain Documentation](https://docs.xrplevm.org/pages/developers/making-a-cross-chain-dapp/send-messages)
- [XAMAN Developer Documentation](https://xaman.io/)
- [XRP Ledger Documentation](https://xrpl.org/)

## Technology Stack

- **Frontend**: Next.js 14, React, TypeScript
- **UI Components**: shadcn/ui, Tailwind CSS
- **Code Editor**: Monaco Editor
- **Blockchain**: XRP Ledger, XRPL EVM, Axelar
- **Wallet Integration**: XAMAN (XUMM) API

## Development

### Project Structure
```
├── app/                    # Next.js app directory
│   ├── api/               # API routes for XAMAN integration
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main application page
├── components/            # Reusable UI components
│   └── ui/               # shadcn/ui components
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions
└── public/               # Static assets
```

### Key Features Implementation
- **XAMAN Integration**: API routes handle payload creation and status polling
- **Real-time Updates**: WebSocket-like polling for transaction status
- **Local Storage**: API credentials and transaction JSON persistence
- **Error Handling**: Comprehensive error states and user feedback

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

**Note**: This is a development playground. Always test transactions on the XRP Ledger testnet before using on mainnet.
