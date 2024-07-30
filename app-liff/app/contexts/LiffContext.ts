import type { Liff } from "@line/liff";
import { useContext, createContext } from "react";

type LiffContext = {
    liffObject: Liff | null,
    setLiffObject: (liff: Liff | null) => void
}

export const liffContext = createContext<LiffContext>({
    liffObject: null,
    setLiffObject: () => { }
});

export const useLiff = () => useContext(liffContext)