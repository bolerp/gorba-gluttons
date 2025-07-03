// @ts-ignore - external package without types
import bs58 from 'bs58';
// @ts-ignore - using Solana web3.js SDK
import { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';

// RPC endpoint (can be prod or local)
export const conn = new Connection(process.env.GOR_RPC || 'https://rpc.gorbagana.wtf', 'confirmed');

// Load treasury keypair from env secret (Base58-encoded secret key)
const secretBase58 = process.env.RACE_TREASURY_SECRET;
if (!secretBase58) throw new Error('RACE_TREASURY_SECRET env var is missing');
export const treasury = Keypair.fromSecretKey(bs58.decode(secretBase58));

export const ENTRY_FEE_LAMPORTS = Number(process.env.ENTRY_FEE_LAMPORTS || 0);
console.log(`[CONFIG] ENTRY_FEE_LAMPORTS set to: ${ENTRY_FEE_LAMPORTS}`);

/**
 * Verify that a transfer tx paid the entry fee from player to treasury.
 * @returns true if valid
 */
export async function verifyPayment(signature: string, playerPubkey: string): Promise<boolean> {
  try {
    const tx = await conn.getParsedTransaction(signature, { commitment: 'confirmed' });
    if (!tx || tx.meta?.err) return false;
    const ix: any = tx.transaction.message.instructions.find((i: any) => i.program === 'system' && i.parsed?.type === 'transfer');
    if (!ix) return false;
    return (
      ix.parsed.info.source === playerPubkey &&
      ix.parsed.info.destination === treasury.publicKey.toBase58() &&
      Number(ix.parsed.info.lamports) >= ENTRY_FEE_LAMPORTS
    );
  } catch {
    return false;
  }
}

export async function sendPrizes(payouts: { to: string; lamports: number }[]): Promise<string | null> {
  // Filter any zero-value payouts so we don't create empty transfers
  const validPayouts = payouts.filter(p => p.lamports > 0);
  if (validPayouts.length === 0) return null;

  const tx = new Transaction();
  for (const p of validPayouts) {
    tx.add(
      SystemProgram.transfer({
        fromPubkey: treasury.publicKey,
        toPubkey: new PublicKey(p.to),
        lamports: Math.floor(p.lamports)
      })
    );
  }

  // Sign & send from treasury
  const signature = await sendAndConfirmTransaction(conn, tx, [treasury]);
  return signature;
} 