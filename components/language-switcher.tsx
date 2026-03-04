"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useAutoTranslate, LANGUAGES } from "@/lib/use-auto-translate";
import { RiGlobalLine, RiCheckLine, RiTranslate2 } from "@remixicon/react";

export function LanguageSwitcher() {
    const { enableTranslation, disableTranslation, getLanguage } = useAutoTranslate();
    const [currentLang, setCurrentLang] = React.useState("en");
    const [open, setOpen] = React.useState(false);
    const [translating, setTranslating] = React.useState(false);
    const ref = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        setCurrentLang(getLanguage());
    }, [getLanguage]);

    React.useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        if (open) document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [open]);

    const current = LANGUAGES.find((l) => l.code === currentLang) || LANGUAGES[0];

    const handleSelect = async (code: string) => {
        if (code === currentLang) { setOpen(false); return; }

        setOpen(false);

        if (code === "en") {
            disableTranslation();
            return;
        }

        setCurrentLang(code);
        setTranslating(true);
        try {
            await enableTranslation(code);
        } finally {
            setTranslating(false);
        }
    };

    return (
        <div className="relative no-translate" ref={ref} data-no-translate>
            <button
                onClick={() => setOpen(!open)}
                className={cn(
                    "flex items-center gap-1.5 h-9 px-2.5 rounded-md border border-input",
                    "hover:bg-accent hover:text-accent-foreground transition-all duration-200",
                    "text-muted-foreground text-sm",
                    open && "bg-accent text-accent-foreground",
                    translating && "animate-pulse"
                )}
            >
                {translating ? (
                    <RiTranslate2 className="w-4 h-4 animate-spin" />
                ) : (
                    <span className="text-sm">{current.flag}</span>
                )}
                <span className="hidden sm:inline text-xs font-medium">{current.code.toUpperCase()}</span>
            </button>

            {open && (
                <div className="absolute right-0 top-[calc(100%+8px)] w-52 rounded-lg border border-border bg-popover shadow-xl z-50 overflow-hidden" data-no-translate>
                    <div className="px-3 py-2 border-b border-border">
                        <div className="flex items-center gap-2">
                            <RiGlobalLine className="w-3.5 h-3.5 text-muted-foreground" />
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Language</p>
                        </div>
                    </div>
                    <div className="py-1 max-h-64 overflow-y-auto">
                        {LANGUAGES.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => handleSelect(lang.code)}
                                className={cn(
                                    "flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-accent transition-colors text-sm",
                                    currentLang === lang.code && "bg-accent/50"
                                )}
                            >
                                <span className="text-base">{lang.flag}</span>
                                <span className="flex-1 text-foreground">{lang.label}</span>
                                {currentLang === lang.code && (
                                    <RiCheckLine className="w-4 h-4 text-primary" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
