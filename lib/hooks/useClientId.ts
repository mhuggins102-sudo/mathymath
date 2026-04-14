"use client";

import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";

const KEY = "mathymath:clientId";

export function useClientId(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let v = window.localStorage.getItem(KEY);
    if (!v) {
      v = uuidv4();
      window.localStorage.setItem(KEY, v);
    }
    setId(v);
  }, []);
  return id;
}
