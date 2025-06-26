"use client"

import { useEffect, useState } from "react";
import { FeedEvent } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

export default function ActivityFeed() {
  const [feeds, setFeeds] = useState<FeedEvent[]>([]);

  useEffect(() => {
    async function fetchFeeds() {
      try {
        const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
        const res = await fetch(`${api}/feeds?limit=10`);
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        
        const data = await res.json();
        setFeeds(data);
      } catch (e) {
        console.error("feed fetch error", e);
        // Fallback to empty array if server is not available
        setFeeds([]);
      }
    }
    fetchFeeds();
    const id = setInterval(fetchFeeds, 5000);
    return () => clearInterval(id);
  }, []);

  const items = feeds.map((f) => {
    const who = f.nickname ?? f.wallet.substring(0, 6) + "…";
    return `${who} fed ${Number(f.amount_sol).toFixed(2)} GOR`;
  });

  // Duplicate items only when there is more than one event to create seamless marquee
  const displayItems = items.length > 1 ? items.concat(items) : items;

  if (!items.length) return null;

  return (
    <div className="w-full bg-gray-900/40 border-y border-gray-700 overflow-hidden py-2">
      <div className="animate-marquee whitespace-nowrap text-sm">
        {displayItems.map((txt, idx) => (
          <span key={idx} className="mx-8 text-gray-300">
            {txt}
          </span>
        ))}
      </div>
    </div>
  );
} 