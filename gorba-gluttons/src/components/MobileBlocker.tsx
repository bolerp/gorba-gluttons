"use client"

import { Smartphone } from "lucide-react"

export default function MobileBlocker() {
  return (
    <div className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-gray-900 text-white p-8 text-center">
      <Smartphone className="w-16 h-16 mb-6 text-lime-400" />
      <h1 className="text-3xl font-bold mb-4">Desktop Only</h1>
      <p className="max-w-md text-gray-400">
        To ensure the best experience and prevent accidental screen-smashing during intense feeding frenzies, Gorba-Gluttons is currently only available on desktop devices.
      </p>
      <p className="mt-6 text-sm text-gray-500">
        Please revisit from a computer. The Heap awaits! 👑
      </p>
    </div>
  )
} 