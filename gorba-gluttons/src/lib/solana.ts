import { PublicKey } from "@solana/web3.js";

/**
 * Returns the public key of the Gorba-Glutton "trash can" wallet taken
 * from NEXT_PUBLIC_TRASH_CAN_ADDRESS. Throws if the env variable is empty.
 */
export function getTrashCanPubkey(): PublicKey {
  const address = process.env.NEXT_PUBLIC_TRASH_CAN_ADDRESS;
  if (!address) {
    throw new Error("NEXT_PUBLIC_TRASH_CAN_ADDRESS env variable is not set");
  }
  return new PublicKey(address);
} 