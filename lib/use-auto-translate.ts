"use client";

import { useCallback, useEffect, useRef } from "react";

// ── Config ──
const LINGVA_API = "https://lingva.ml/api/v1";
const MYMEMORY_API = "https://api.mymemory.translated.net/get";
const CACHE_KEY = "pixl_translate_cache";
const LANG_KEY = "pixl_lang";
const BATCH_SIZE = 15;
const BATCH_DELAY = 80;

// Tags / selectors to SKIP (inputs, code, scripts, style, etc.)
const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT", "CODE", "PRE",
  "SVG", "MATH", "NOSCRIPT", "IFRAME", "CANVAS", "VIDEO", "AUDIO",
]);
const SKIP_CLASS = "no-translate";

// ── Cache helpers ──
function loadCache(): Record<string, Record<string, string>> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, Record<string, string>>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch { /* quota exceeded — silently ignore */ }
}

// ── Translation API calls ──
async function translateLingva(text: string, from: string, to: string): Promise<string | null> {
  try {
    const res = await fetch(`${LINGVA_API}/${from}/${to}/${encodeURIComponent(text)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.translation || null;
  } catch {
    return null;
  }
}

async function translateMyMemory(text: string, from: string, to: string): Promise<string | null> {
  try {
    const res = await fetch(`${MYMEMORY_API}?q=${encodeURIComponent(text)}&langpair=${from}|${to}`);
    if (!res.ok) return null;
    const data = await res.json();
    const match = data?.responseData?.translatedText;
    if (!match || match.toUpperCase() === text.toUpperCase()) return null;
    return match;
  } catch {
    return null;
  }
}

async function translateText(text: string, from: string, to: string): Promise<string> {
  const result = await translateLingva(text, from, to);
  if (result) return result;
  const fallback = await translateMyMemory(text, from, to);
  return fallback || text;
}

// ── DOM helpers ──
function shouldSkipNode(node: Node): boolean {
  let el: Node | null = node;
  while (el && el !== document.body) {
    if (el.nodeType === Node.ELEMENT_NODE) {
      const element = el as HTMLElement;
      if (SKIP_TAGS.has(element.tagName)) return true;
      if (element.classList?.contains(SKIP_CLASS)) return true;
      if (element.getAttribute("contenteditable") === "true") return true;
      if (element.closest("[data-no-translate]")) return true;
    }
    el = el.parentNode;
  }
  return false;
}

function getTextNodes(root: Node): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
      if (shouldSkipNode(node)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n: Node | null;
  while ((n = walker.nextNode())) nodes.push(n as Text);
  return nodes;
}

// ── Core translate engine ──
class AutoTranslateEngine {
  private cache: Record<string, Record<string, string>> = {};
  private observer: MutationObserver | null = null;
  private originals = new WeakMap<Text, string>();
  private translating = false;
  private targetLang: string = "en";
  private pendingNodes: Set<Text> = new Set();
  private batchTimer: ReturnType<typeof setTimeout> | null = null;

  init() {
    this.cache = loadCache();
  }

  getLanguage(): string {
    if (typeof window === "undefined") return "en";
    return localStorage.getItem(LANG_KEY) || "en";
  }

  setLanguage(lang: string) {
    localStorage.setItem(LANG_KEY, lang);
  }

  async enableTranslation(lang: string) {
    if (lang === "en") {
      this.disableTranslation();
      return;
    }

    this.targetLang = lang;
    this.setLanguage(lang);
    this.translating = true;

    // Translate current DOM
    await this.translateDOM(document.body);

    // Start observing for new content
    this.startObserver();
  }

  disableTranslation() {
    this.translating = false;
    this.stopObserver();
    this.setLanguage("en");
    // Restore originals — easiest is reload
    window.location.reload();
  }

  private startObserver() {
    this.stopObserver();
    this.observer = new MutationObserver((mutations) => {
      if (!this.translating) return;
      for (const mutation of mutations) {
        // New nodes added
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            if (node.textContent?.trim() && !shouldSkipNode(node)) {
              this.pendingNodes.add(node as Text);
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const textNodes = getTextNodes(node);
            for (const tn of textNodes) this.pendingNodes.add(tn);
          }
        }
        // characterData changes (text content updates)
        if (mutation.type === "characterData" && mutation.target.nodeType === Node.TEXT_NODE) {
          const tn = mutation.target as Text;
          if (tn.textContent?.trim() && !shouldSkipNode(tn)) {
            this.pendingNodes.add(tn);
          }
        }
      }
      this.scheduleBatch();
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  private stopObserver() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  private scheduleBatch() {
    if (this.batchTimer) return;
    this.batchTimer = setTimeout(() => {
      this.batchTimer = null;
      const nodes = Array.from(this.pendingNodes);
      this.pendingNodes.clear();
      if (nodes.length > 0) {
        this.translateNodes(nodes);
      }
    }, BATCH_DELAY);
  }

  private async translateDOM(root: Node) {
    const textNodes = getTextNodes(root);
    if (textNodes.length === 0) return;

    // Process in batches
    for (let i = 0; i < textNodes.length; i += BATCH_SIZE) {
      const batch = textNodes.slice(i, i + BATCH_SIZE);
      await this.translateNodes(batch);
    }
  }

  private async translateNodes(nodes: Text[]) {
    const lang = this.targetLang;
    const langCache = this.cache[lang] || {};
    this.cache[lang] = langCache;

    const toTranslate: { node: Text; text: string }[] = [];

    for (const node of nodes) {
      const text = node.textContent?.trim();
      if (!text || text.length < 2) continue;

      // Store original
      if (!this.originals.has(node)) {
        this.originals.set(node, node.textContent!);
      }

      const originalText = this.originals.get(node) || text;

      // Check cache
      if (langCache[originalText]) {
        // Temporarily disconnect observer to avoid loop
        this.observer?.disconnect();
        node.textContent = node.textContent!.replace(
          node.textContent!.trim(),
          langCache[originalText]
        );
        if (this.observer) {
          this.observer.observe(document.body, {
            childList: true, subtree: true, characterData: true,
          });
        }
        continue;
      }

      toTranslate.push({ node, text: originalText });
    }

    if (toTranslate.length === 0) return;

    // Translate in parallel (small batches)
    const promises = toTranslate.map(async ({ node, text }) => {
      try {
        const translated = await translateText(text, "en", lang);
        if (translated && translated !== text) {
          langCache[text] = translated;

          // Apply translation — disconnect observer temporarily
          this.observer?.disconnect();
          if (node.textContent) {
            node.textContent = node.textContent.replace(
              node.textContent.trim(),
              translated
            );
          }
          if (this.observer) {
            this.observer.observe(document.body, {
              childList: true, subtree: true, characterData: true,
            });
          }
        }
      } catch { /* skip failed translations */ }
    });

    await Promise.all(promises);

    // Persist cache
    saveCache(this.cache);
  }

  cleanup() {
    this.stopObserver();
    this.translating = false;
  }
}

// ── Singleton engine ──
let engineInstance: AutoTranslateEngine | null = null;

function getEngine(): AutoTranslateEngine {
  if (!engineInstance) {
    engineInstance = new AutoTranslateEngine();
    engineInstance.init();
  }
  return engineInstance;
}

// ── React Hook ──
export function useAutoTranslate() {
  const engineRef = useRef<AutoTranslateEngine | null>(null);

  useEffect(() => {
    engineRef.current = getEngine();

    // Auto-resume translation if language was set
    const lang = engineRef.current.getLanguage();
    if (lang !== "en") {
      // Small delay to let DOM render
      const timer = setTimeout(() => {
        engineRef.current?.enableTranslation(lang);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const enableTranslation = useCallback((lang: string) => {
    getEngine().enableTranslation(lang);
  }, []);

  const disableTranslation = useCallback(() => {
    getEngine().disableTranslation();
  }, []);

  const getLanguage = useCallback((): string => {
    return getEngine().getLanguage();
  }, []);

  return { enableTranslation, disableTranslation, getLanguage };
}

// ── Available languages ──
export const LANGUAGES = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "tr", label: "Türkçe", flag: "🇹🇷" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "nl", label: "Nederlands", flag: "🇳🇱" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
];
