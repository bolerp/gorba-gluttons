"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

export default function NetworkBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("netBannerDismissed");
    if (!dismissed) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem("netBannerDismissed", "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="bg-yellow-900/80 text-yellow-100 border border-yellow-600 p-4 rounded-lg mb-6 relative max-w-2xl mx-auto">
      <button
        onClick={dismiss}
        aria-label="Dismiss banner"
        className="absolute top-2 right-2 text-yellow-300 hover:text-white"
      >
        <X className="w-4 h-4" />
      </button>
      <p className="font-semibold mb-2">
        Backpack wallet &amp; Gorbagana network required
      </p>
      <p className="text-sm mb-1">
        Gorba-Gluttons currently works <span className="font-bold">only</span> with the
        Backpack wallet connected to the custom <span className="font-mono">Gorbagana</span> network.
      </p>
      <p className="text-sm leading-relaxed">
        1. Install Backpack (<a href="https://backpack.app" target="_blank" rel="noreferrer" className="underline">download</a>)<br/>
        2. In Backpack, open <span className="italic">Settings → Networks → Add Network</span> and enter:<br/>
        &nbsp;&nbsp;• <span className="font-mono">Name:</span> Gorbagana<br/>
        &nbsp;&nbsp;• <span className="font-mono">RPC URL:</span> https://rpc.gorbagana.xyz<br/>
        3. Switch to the Gorbagana network and refresh this page.
      </p>
    </div>
  );
} 