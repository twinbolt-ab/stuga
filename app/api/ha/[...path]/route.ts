import { NextRequest, NextResponse } from 'next/server'

const HA_URL = process.env.HOME_ASSISTANT_URL
const HA_TOKEN = process.env.HOME_ASSISTANT_TOKEN

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const targetPath = path.join('/')

  try {
    const response = await fetch(`${HA_URL}/api/${targetPath}`, {
      headers: {
        Authorization: `Bearer ${HA_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('[HA Proxy] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch from Home Assistant' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const targetPath = path.join('/')

  try {
    const body = await request.json()

    const response = await fetch(`${HA_URL}/api/${targetPath}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HA_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('[HA Proxy] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to call Home Assistant service' },
      { status: 500 }
    )
  }
}
