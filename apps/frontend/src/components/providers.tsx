"use client";

import { SWRConfig } from "swr";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        dedupingInterval: 5000,
        errorRetryCount: 1,
        shouldRetryOnError: (err: unknown) => {
          if (!(err instanceof Error)) return false;
          return !err.message.includes("401") && !err.message.includes("403");
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
