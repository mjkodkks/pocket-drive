"use client"
import type { Liff } from "@line/liff";
import { useState, useEffect, ReactNode } from "react";
import { liffContext } from "../contexts/LiffContext";

export function LineLiff({ liffId, children }: { liffId: string | undefined, children: ReactNode }) {

    const [liffObject, setLiffObject] = useState<Liff | null>(null);
    // const [liffError, setLiffError] = useState<string | null>(null);


    // Execute liff.init() when the app is initialized
    useEffect(() => {
        // to avoid `window is not defined` error
        import("@line/liff")
            .then((liff) => liff.default)
            .then((liff) => {
                console.log("LIFF init...");
                liff
                    .init({ liffId: liffId || '' })
                    .then(() => {
                        console.log("LIFF init succeeded.");
                        setLiffObject(liff);
                    })
                    .catch((error: Error) => {
                        console.error("LIFF init failed.", error);
                        //   setLiffError(error.toString());
                    });
            });
    }, []);

    return <liffContext.Provider value={{
        liffObject,
        setLiffObject
    }}>{children}</liffContext.Provider>
}