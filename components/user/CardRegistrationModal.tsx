"use client";

import { useState, useEffect } from "react";
import { CreditCard, X } from "lucide-react";
import Link from "next/link";

export default function CardRegistrationModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem("card_modal_dismissed");
    if (!dismissed) {
      const timer = setTimeout(() => setShow(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem("card_modal_dismissed", "true");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleDismiss} />
      <div className="relative bg-white rounded-2xl mx-6 max-w-sm w-full p-6 shadow-xl">
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
            <CreditCard className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            カード登録のお願い
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed mb-6">
            サービス利用料の自動決済のために、
            <br />
            クレジットカードの登録をお願いします。
          </p>
          <Link
            href="/user/card"
            onClick={handleDismiss}
            className="block w-full bg-emerald-600 text-white text-base font-medium rounded-xl py-3.5 active:bg-emerald-700 mb-3"
          >
            カードを登録する
          </Link>
          <button
            onClick={handleDismiss}
            className="text-sm text-gray-500 py-2"
          >
            後で登録する
          </button>
        </div>
      </div>
    </div>
  );
}
