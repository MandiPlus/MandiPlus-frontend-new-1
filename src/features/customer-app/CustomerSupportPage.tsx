"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileClock,
  LoaderCircle,
  Send,
  ShieldAlert,
  Truck,
  WalletCards,
} from "lucide-react";

import { askCustomerAssistant } from "./api";
import { CustomerAppShell } from "./CustomerAppShell";
import styles from "./customer-app.module.css";

type Message = { text: string; mine: boolean };

export default function CustomerSupportPage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const hasAsked = messages.some((message) => message.mine);

  const send = async (override?: string) => {
    const text = (override || input).trim();
    if (!text || loading) return;
    const nextMessages = [...messages, { mine: true, text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const response = await askCustomerAssistant({
        message: text,
        history: nextMessages.slice(-8).map((message) => ({
          role: message.mine ? "user" : "assistant",
          text: message.text,
        })),
      });
      setMessages((current) => [
        ...current,
        {
          mine: false,
          text: response.answer || "Help abhi available nahi hai. Thodi der baad try karein.",
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          mine: false,
          text: "Help abhi available nahi hai. Thodi der baad try karein.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = useMemo(
    () => [
      {
        label: "Wallet balance",
        sub: "Available credit check karein",
        icon: WalletCards,
        action: () => void send("Mera wallet balance kitna hai?"),
      },
      {
        label: "Pending invoices",
        sub: "Kaunse payments due hain",
        icon: FileClock,
        action: () => void send("Kaunse invoices par action chahiye?"),
      },
      {
        label: "Claim documents",
        sub: "Kaunse documents chahiye",
        icon: ShieldAlert,
        action: () => void send("Kaunse claim documents pending hain?"),
      },
      {
        label: "Vehicle track karein",
        sub: "Live trip status dekhein",
        icon: Truck,
        action: () => router.push("/tracking"),
      },
    ],
    [loading, messages, router],
  );

  return (
    <CustomerAppShell activeTab="partner" showBottomNav={false}>
      <header className={styles.secondaryHeader}>
        <button
          type="button"
          className={styles.secondaryBack}
          onClick={() => router.push("/home")}
          aria-label="Back to home"
        >
          <ArrowLeft size={24} strokeWidth={2.4} />
        </button>
        <h1 className={styles.secondaryHeading}>Help</h1>
        <span />
      </header>

      <div className={styles.assistantWrap}>
        <main className={styles.assistantContent}>
          {messages.map((message, index) => (
            <div
              key={`${message.text}-${index}`}
              className={`${styles.chatBubble} ${
                message.mine ? styles.chatBubbleMine : styles.chatBubbleBot
              }`}
            >
              {message.text}
            </div>
          ))}

          {loading ? (
            <div className={styles.assistantThinking}>
              <LoaderCircle className="animate-spin" size={16} />
              Answer dhoondh rahe hain...
            </div>
          ) : null}

          {!hasAsked ? (
            <section className={styles.assistantStarter}>
              <h2>Aapko kis cheez mein help chahiye?</h2>
              <div className={styles.assistantGrid}>
                {suggestions.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      className={styles.assistantCard}
                      onClick={item.action}
                    >
                      <span><Icon size={21} /></span>
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.sub}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
        </main>

        <form
          className={styles.assistantInputBar}
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Invoice, wallet ya claim poochhein"
            disabled={loading}
          />
          <button type="submit" disabled={loading} aria-label="Send">
            {loading ? (
              <LoaderCircle className="animate-spin" size={17} />
            ) : (
              <Send size={18} />
            )}
          </button>
        </form>
      </div>
    </CustomerAppShell>
  );
}
