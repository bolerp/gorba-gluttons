"use client";

import { useEffect } from "react";

export default function WalletModalEnhancer() {
  useEffect(() => {
    const RPC_URL = "https://gorchain.wstf.io";

    const inject = () => {
      const list = document.querySelector<HTMLElement>(
        ".wallet-adapter-modal-list"
      );
      if (!list) return;
      if (list.previousElementSibling?.classList.contains("gorba-steps")) return;

      const steps = document.createElement("div");
      steps.className =
        "gorba-steps text-xs text-gray-400 space-y-1 px-4 pb-3 leading-relaxed";
      steps.innerHTML = `
        <p><strong>Step 1)</strong> <a href="https://backpack.app" target="_blank" rel="noopener" class="underline text-lime-400">Download Backpack</a></p>
        <p><strong>Step 2)</strong> Settings → Solana</p>
        <p><strong>Step 3)</strong> Select RPC connection</p>
        <p><strong>Step 4)</strong> Copy RPC:<button type="button" class="gorba-copy underline text-lime-400">${RPC_URL}</button></p>
      `;
      list.parentElement?.insertBefore(steps, list);

      const copyBtn = steps.querySelector<HTMLButtonElement>(".gorba-copy");
      if (copyBtn) {
        const width = copyBtn.getBoundingClientRect().width;
        copyBtn.style.width = `${width}px`;
        copyBtn.addEventListener("click", () => {
          navigator.clipboard.writeText(RPC_URL).catch(() => {});
          copyBtn.textContent = "Copied!";
          setTimeout(() => (copyBtn.textContent = RPC_URL), 2000);
        });
      }
    };

    const observer = new MutationObserver(inject);
    observer.observe(document.body, { childList: true, subtree: true });
    inject();
    return () => observer.disconnect();
  }, []);

  return null;
} 