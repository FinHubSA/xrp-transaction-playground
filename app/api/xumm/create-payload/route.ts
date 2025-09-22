import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const { apiKey, apiSecret, ...payload } = body

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        {
          error: "XUMM API credentials are required. Please provide both apiKey and apiSecret.",
        },
        { status: 400 },
      )
    }

    const response = await fetch("https://xumm.app/api/v1/platform/payload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        "X-API-Secret": apiSecret,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error("Xumm API error:", errorData)
      return NextResponse.json(
        { error: `Xumm API error: ${response.status} ${response.statusText}` },
        { status: response.status },
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error creating Xumm payload:", error)
    return NextResponse.json({ error: "Failed to create Xumm payload" }, { status: 500 })
  }
}
