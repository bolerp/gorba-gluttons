import { LAMPORTS_PER_SOL, PublicKey } from '@gorbagana/web3.js'
import { NextRequest, NextResponse } from 'next/server'

const endpoint = 'https://rpc.gorbagana.wtf'

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const address = searchParams.get('address')

  if (!address) {
    return NextResponse.json({ error: 'Missing address param' }, { status: 400 })
  }

  try {
    // Ручной fetch-запрос с отключенным кэшем
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [address, { commitment: 'confirmed' }]
      }),
      cache: 'no-store' // Отключаем кэширование
    })

    if (!response.ok) {
      throw new Error(`RPC request failed with status ${response.status}`)
    }
    
    const data = await response.json()
    if (data.error) {
      throw new Error(data.error.message)
    }

    const lamports = data.result.value
    const balance = lamports / LAMPORTS_PER_SOL
    return NextResponse.json({ lamports, balance })

  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to fetch balance from RPC.', fullError: e.toString() }, { status: 500 })
  }
} 