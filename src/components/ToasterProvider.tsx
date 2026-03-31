"use client";

import { Toaster } from "react-hot-toast";

export default function ToasterProvider() {
  return (
    <Toaster
      position="bottom-right"
      reverseOrder={false}
      toastOptions={{
        style: {
          background: "var(--platform-surface)",
          color: "var(--platform-ink)",
          border: "2px solid var(--platform-border)",
          borderRadius: "14px",
          boxShadow: "0 10px 24px rgba(120, 53, 15, 0.16)",
          fontWeight: 600,
        },
        success: {
          iconTheme: {
            primary: "var(--platform-accent)",
            secondary: "var(--platform-surface)",
          },
        },
        error: {
          iconTheme: {
            primary: "#b42318",
            secondary: "var(--platform-surface)",
          },
        },
      }}
    />
  );
}

