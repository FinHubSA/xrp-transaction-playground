"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Loader2, Send, CheckCircle, XCircle, AlertCircle, Key, Copy, Hash, Shuffle, Info } from "lucide-react"
import dynamic from "next/dynamic"
import { ethers } from "ethers"

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] border rounded-md flex items-center justify-center bg-muted">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  ),
})

interface XummPayload {
  txjson: any
  options?: {
    submit?: boolean
    multisign?: boolean
    expire?: number
  }
}

interface XummResponse {
  uuid: string
  next: {
    always: string
    no_push_msg_received?: string
  }
  refs: {
    qr_png: string
    qr_matrix: string
    qr_uri_quality_opts: string[]
    websocket_status: string
  }
  pushed: boolean
}

interface TransactionResult {
  meta: {
    uuid: string
    exists: boolean
    resolved: boolean
    signed: boolean
    cancelled: boolean
    expired: boolean
  }
  payload: {
    tx_type: string
    tx_destination: string
    tx_destination_tag?: number
    request_json: any
    created_at: string
    expires_at: string
  }
  response?: {
    hex: string
    txid: string
    resolved_at: string
    dispatched_to: string
    dispatched_result: string
    multisign_account?: string
    account: string
  }
}

export default function XRPTransactionApp() {
  const [apiKey, setApiKey] = useState("")
  const [apiSecret, setApiSecret] = useState("")
  const [jsonInput, setJsonInput] = useState(`{
  "TransactionType": "Payment",
  "Destination": "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH",
  "Amount": "1000000",
  "Fee": "12"
}`)
  const [stringToHex, setStringToHex] = useState("")
  const [hexResult, setHexResult] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [xummResponse, setXummResponse] = useState<XummResponse | null>(null)
  const [transactionResult, setTransactionResult] = useState<TransactionResult | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [axelarDestination, setAxelarDestination] = useState("")
  const [axelarSalt, setAxelarSalt] = useState("")
  const [axelarPayload, setAxelarPayload] = useState("")

  useEffect(() => {
    const savedApiKey = localStorage.getItem("xrp-app-api-key")
    const savedApiSecret = localStorage.getItem("xrp-app-api-secret")
    const savedJsonInput = localStorage.getItem("xrp-app-json-input")

    if (savedApiKey) setApiKey(savedApiKey)
    if (savedApiSecret) setApiSecret(savedApiSecret)
    if (savedJsonInput) setJsonInput(savedJsonInput)
  }, [])

  const saveApiKey = (key: string) => {
    setApiKey(key)
    localStorage.setItem("xrp-app-api-key", key)
  }

  const saveApiSecret = (secret: string) => {
    setApiSecret(secret)
    localStorage.setItem("xrp-app-api-secret", secret)
  }

  const saveJsonInput = (json: string) => {
    setJsonInput(json)
    localStorage.setItem("xrp-app-json-input", json)
  }

  const convertToHex = (str: string) => {
    const hex = Buffer.from(str, "utf8").toString("hex").toUpperCase()
    setHexResult(hex)
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  const generateSalt = () => {
    const randomBytes = ethers.randomBytes(32)
    const salt = ethers.hexlify(randomBytes)
    setAxelarSalt(salt)
    return salt
  }

  const encodeAxelarPayload = (destination: string, salt: string) => {
    try {
      if (!destination || !salt) {
        throw new Error("Destination address and salt are required")
      }
      
      // Validate destination address format
      if (!ethers.isAddress(destination)) {
        throw new Error("Invalid destination address format")
      }

      // Create the ABI encoder for abi.encode(address destination, bytes32 salt)
      const abiCoder = ethers.AbiCoder.defaultAbiCoder()
      const encoded = abiCoder.encode(["address", "bytes32"], [destination, salt])
      setAxelarPayload(encoded)
      return encoded
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to encode payload")
      return ""
    }
  }


  const validateJSON = (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString)
      if (!parsed.TransactionType) {
        throw new Error("TransactionType is required")
      }
      return parsed
    } catch (err) {
      throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  }

  const createXummPayload = async (txjson: any): Promise<XummResponse> => {
    const payload: XummPayload = {
      txjson,
      options: {
        submit: true,
        expire: 5, // 5 minutes
      },
    }

    const response = await fetch("/api/xumm/create-payload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        apiKey,
        apiSecret,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || "Failed to create Xumm payload")
    }

    return response.json()
  }

  const pollTransactionStatus = async (uuid: string) => {
    setIsPolling(true)
    const maxAttempts = 60 // 5 minutes with 5-second intervals
    let attempts = 0

    const poll = async (): Promise<void> => {
      try {
        const response = await fetch(
          `/api/xumm/get-payload/${uuid}?apiKey=${encodeURIComponent(apiKey)}&apiSecret=${encodeURIComponent(apiSecret)}`,
        )
        if (!response.ok) {
          throw new Error("Failed to get payload status")
        }

        const result: TransactionResult = await response.json()

        if (result.meta.resolved || result.meta.cancelled || result.meta.expired) {
          setTransactionResult(result)
          setIsPolling(false)
          return
        }

        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000) // Poll every 5 seconds
        } else {
          setError("Transaction polling timed out")
          setIsPolling(false)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Polling failed")
        setIsPolling(false)
      }
    }

    poll()
  }

  const handleSubmit = async () => {
    setError(null)
    setXummResponse(null)
    setTransactionResult(null)
    setIsLoading(true)

    try {
      if (!apiKey.trim() || !apiSecret.trim()) {
        throw new Error("Please enter both XUMM API Key and API Secret")
      }

      const txjson = validateJSON(jsonInput)
      const response = await createXummPayload(txjson)
      setXummResponse(response)

      pollTransactionStatus(response.uuid)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = () => {
    if (!transactionResult) return null

    const { meta } = transactionResult

    if (meta.signed && !meta.cancelled && !meta.expired) {
      return (
        <Badge className="bg-green-500 text-white">
          <CheckCircle className="w-3 h-3 mr-1" />
          Signed
        </Badge>
      )
    } else if (meta.cancelled) {
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" />
          Cancelled
        </Badge>
      )
    } else if (meta.expired) {
      return (
        <Badge variant="secondary">
          <AlertCircle className="w-3 h-3 mr-1" />
          Expired
        </Badge>
      )
    }

    return <Badge variant="outline">Pending</Badge>
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">XRP Ledger Transaction Creator</h1>
          <p className="text-muted-foreground">Create and sign XRP transactions using Xumm</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              XUMM API Credentials
            </CardTitle>
            <CardDescription>
              Enter your XUMM API credentials. You can get these from your XUMM Developer Console. These will be saved
              locally.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => saveApiKey(e.target.value)}
                  placeholder="Enter your XUMM API Key"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-secret">API Secret</Label>
                <Input
                  id="api-secret"
                  type="password"
                  value={apiSecret}
                  onChange={(e) => saveApiSecret(e.target.value)}
                  placeholder="Enter your XUMM API Secret"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="w-5 h-5" />
              String to Hex Converter
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                    <Info className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Interchain Transfer Memos</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      When creating XRP transactions for interchain transfers, you need to include these memos:
                    </p>
                    <div className="space-y-3">
                      <div className="flex flex-col space-y-1 p-3 bg-muted rounded-lg">
                        <span className="font-medium text-sm">1. MemoType: type</span>
                        <span className="text-muted-foreground text-sm">MemoData: interchain_transfer</span>
                      </div>
                      <div className="flex flex-col space-y-1 p-3 bg-muted rounded-lg">
                        <span className="font-medium text-sm">2. MemoType: destination_address</span>
                        <span className="text-muted-foreground text-sm font-mono">MemoData: 9bEb991eDdF92528E6342Ec5f7B0846C24cbaB58</span>
                        <span className="text-muted-foreground text-xs">(Squid router smart contract address)</span>
                      </div>
                      <div className="flex flex-col space-y-1 p-3 bg-muted rounded-lg">
                        <span className="font-medium text-sm">3. MemoType: destination_chain</span>
                        <span className="text-muted-foreground text-sm">MemoData: xrpl-evm</span>
                      </div>
                      <div className="flex flex-col space-y-1 p-3 bg-muted rounded-lg">
                        <span className="font-medium text-sm">4. MemoType: gas_fee_amount</span>
                        <span className="text-muted-foreground text-sm">MemoData: 100000</span>
                      </div>
                      <div className="flex flex-col space-y-1 p-3 bg-muted rounded-lg">
                        <span className="font-medium text-sm">5. MemoType: payload</span>
                        <span className="text-muted-foreground text-sm">MemoData: (encoded payload from Axelar GMP section)</span>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardTitle>
            <CardDescription>
              Convert strings to hex format for use in memo fields and other transaction data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="string-input">String to Convert</Label>
              <Input
                id="string-input"
                value={stringToHex}
                onChange={(e) => {
                  setStringToHex(e.target.value)
                  convertToHex(e.target.value)
                }}
                placeholder="Enter text to convert to hex"
              />
            </div>
            {hexResult && (
              <div className="space-y-2">
                <Label htmlFor="hex-result">Hex Result</Label>
                <div className="flex gap-2">
                  <Input id="hex-result" value={hexResult} readOnly className="font-mono" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(hexResult)}
                    title="Copy to clipboard"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shuffle className="w-5 h-5" />
              Axelar GMP Payload Creator
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                    <Info className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Axelar GMP Documentation</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Learn more about Axelar General Message Passing (GMP) and how to send messages from XRPL to XRPL EVM:
                    </p>
                    <div className="p-4 bg-muted rounded-lg">
                      <a
                        href="https://docs.xrplevm.org/pages/developers/making-a-cross-chain-dapp/send-messages"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline text-sm font-medium"
                      >
                        📚 XRPL EVM Cross-Chain Documentation
                      </a>
                    </div>
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        This tool helps you create the ABI-encoded payload needed for Axelar GMP transactions. The payload encodes:
                      </p>
                      <div className="space-y-2">
                        <div className="flex flex-col space-y-1 p-3 bg-muted rounded-lg">
                          <span className="font-medium text-sm">• Destination Address</span>
                          <span className="text-muted-foreground text-sm">The target contract address on the destination chain</span>
                        </div>
                        <div className="flex flex-col space-y-1 p-3 bg-muted rounded-lg">
                          <span className="font-medium text-sm">• Salt (bytes32)</span>
                          <span className="text-muted-foreground text-sm">A random 32-byte salt for transaction uniqueness</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        The encoded payload can be used in the memo field of XRP transactions for cross-chain communication.
                      </p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardTitle>
            <CardDescription>
              Create an ABI-encoded payload for Axelar General Message Passing (GMP) protocol.
              The payload encodes an address destination and a randomly generated salt.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="axelar-destination">Destination Address</Label>
              <Input
                id="axelar-destination"
                value={axelarDestination}
                onChange={(e) => {
                  setAxelarDestination(e.target.value)
                  if (axelarSalt) {
                    encodeAxelarPayload(e.target.value, axelarSalt)
                  }
                }}
                placeholder="0x..."
                className="font-mono"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="axelar-salt">Salt (bytes32)</Label>
              <div className="flex gap-2">
                <Input
                  id="axelar-salt"
                  value={axelarSalt}
                  readOnly
                  className="font-mono"
                  placeholder="Click Generate Salt to create a random salt"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    const salt = generateSalt()
                    if (axelarDestination) {
                      encodeAxelarPayload(axelarDestination, salt)
                    }
                  }}
                  title="Generate random salt"
                >
                  <Shuffle className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {axelarPayload && (
              <div className="space-y-2">
                <Label htmlFor="axelar-payload">Encoded Payload</Label>
                <div className="flex gap-2">
                  <Input
                    id="axelar-payload"
                    value={axelarPayload}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(axelarPayload)}
                    title="Copy to clipboard"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  This is the ABI-encoded payload: abi.encode(address destination, bytes32 salt)
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transaction JSON</CardTitle>
            <CardDescription>
              Enter your XRP transaction in JSON format. The editor provides syntax highlighting and validation. Your
              JSON will be saved automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="transaction-json">Transaction JSON</Label>
              <div className="border rounded-md overflow-hidden">
                <MonacoEditor
                  height="300px"
                  language="json"
                  theme="vs-dark"
                  value={jsonInput}
                  onChange={(value) => saveJsonInput(value || "")}
                  options={{
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 14,
                    lineNumbers: "on",
                    roundedSelection: false,
                    scrollbar: {
                      vertical: "auto",
                      horizontal: "auto",
                    },
                    automaticLayout: true,
                    formatOnPaste: true,
                    formatOnType: true,
                    tabSize: 2,
                    insertSpaces: true,
                    wordWrap: "on",
                    bracketPairColorization: {
                      enabled: true,
                    },
                  }}
                />
              </div>
            </div>

            <Button onClick={handleSubmit} disabled={isLoading || isPolling} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Payload...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Sign with Xumm
                </>
              )}
            </Button>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {xummResponse && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Xumm Signing Request
                {getStatusBadge()}
              </CardTitle>
              <CardDescription>Scan the QR code or open the link in Xumm to sign the transaction</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="flex-shrink-0">
                  <img
                    src={xummResponse.refs.qr_png || "/placeholder.svg"}
                    alt="Xumm QR Code"
                    className="w-48 h-48 border rounded-lg"
                  />
                </div>
                <div className="space-y-3 flex-1">
                  <div>
                    <Label className="text-sm font-medium">Signing URL</Label>
                    <div className="mt-1">
                      <a
                        href={xummResponse.next.always}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline break-all text-sm"
                      >
                        {xummResponse.next.always}
                      </a>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">UUID</Label>
                    <p className="text-sm text-muted-foreground font-mono">{xummResponse.uuid}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Push Notification</Label>
                    <p className="text-sm text-muted-foreground">{xummResponse.pushed ? "Sent" : "Not sent"}</p>
                  </div>
                </div>
              </div>

              {isPolling && (
                <Alert>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertDescription>
                    Waiting for transaction to be signed... This may take a few minutes.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {transactionResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Transaction Result
                {getStatusBadge()}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <p className="text-sm text-muted-foreground">
                    {transactionResult.meta.signed
                      ? "Successfully signed"
                      : transactionResult.meta.cancelled
                        ? "Cancelled by user"
                        : transactionResult.meta.expired
                          ? "Expired"
                          : "Pending"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Transaction Type</Label>
                  <p className="text-sm text-muted-foreground">{transactionResult.payload.tx_type}</p>
                </div>
                {transactionResult.payload.tx_destination && (
                  <div>
                    <Label className="text-sm font-medium">Destination</Label>
                    <p className="text-sm text-muted-foreground font-mono break-all">
                      {transactionResult.payload.tx_destination}
                    </p>
                  </div>
                )}
                <div>
                  <Label className="text-sm font-medium">Created At</Label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(transactionResult.payload.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {transactionResult.response && (
                <div className="space-y-3 border-t pt-4">
                  <h4 className="font-medium">Transaction Details</h4>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <Label className="text-sm font-medium">Transaction ID</Label>
                      <p className="text-sm text-muted-foreground font-mono break-all">
                        {transactionResult.response.txid}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Account</Label>
                      <p className="text-sm text-muted-foreground font-mono">{transactionResult.response.account}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Dispatch Result</Label>
                      <p className="text-sm text-muted-foreground">{transactionResult.response.dispatched_result}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Resolved At</Label>
                      <p className="text-sm text-muted-foreground">
                        {new Date(transactionResult.response.resolved_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
