import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: { uuid: string } }) {
  try {
    const { searchParams } = new URL(request.url)
    const apiKey = searchParams.get("apiKey")
    const apiSecret = searchParams.get("apiSecret")

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: "XUMM API credentials are required" }, { status: 400 })
    }

    const { uuid } = params

    const response = await fetch(`https://xumm.app/api/v1/platform/payload/${uuid}`, {
      method: "GET",
      headers: {
        "X-API-Key": apiKey,
        "X-API-Secret": apiSecret,
      },
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
    console.error("Error getting Xumm payload:", error)
    return NextResponse.json({ error: "Failed to get Xumm payload status" }, { status: 500 })
  }
}
