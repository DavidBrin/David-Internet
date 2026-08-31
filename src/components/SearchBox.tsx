"use client";

import Link from "next/link";

/**
 * The search pill, shared by the homepage and the SERP.
 *
 * Builds a client-side SearchEngine from the prebuilt doc corpus purely so the
 * autocomplete dropdown has something to suggest; ranking/search itself happens
 * on the results page.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createEngine, feelingLucky } from "@/lib/search";
import type { SearchDoc } from "@/lib/types";
import { CloseIcon, MagnifierIcon, MicIcon } from "./Icons";

export interface SearchBoxProps {
  /** Pre-fills the input (the SERP passes the current ?q=). */
  initialQuery?: string;
  /** Prebuilt corpus; may be empty during content bring-up. */
  docs: SearchDoc[];
  autoFocus?: boolean;
  variant: "home" | "serp";
}

const MAX_SUGGESTIONS = 10;

export default function SearchBox({
  initialQuery = "",
  docs,
  autoFocus = false,
  variant,
}: SearchBoxProps) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState(initialQuery);
  const [focused, setFocused] = useState(false);
  /** Set when the user dismisses the list (Esc, submit) until they type again. */
  const [dismissed, setDismissed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Keep the box in sync when the SERP navigates to a different query.
  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  // `autofocus` lands on the input before hydration, so React never sees the
  // focus event — adopt the browser's focus state once on mount.
  useEffect(() => {
    if (inputRef.current && document.activeElement === inputRef.current) {
      setFocused(true);
    }
  }, []);

  const engine = useMemo(() => createEngine(docs), [docs]);

  const suggestions = useMemo(() => {
    const prefix = value.trim();
    if (!prefix) return [];
    return engine.suggest(prefix).slice(0, MAX_SUGGESTIONS);
  }, [engine, value]);

  const listOpen = focused && !dismissed && suggestions.length > 0;

  function go(rawQuery: string) {
    const query = rawQuery.trim();
    if (!query) {
      inputRef.current?.focus();
      return;
    }
    setDismissed(true);
    setActiveIndex(-1);
    inputRef.current?.blur();
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    go(activeIndex >= 0 && suggestions[activeIndex] ? suggestions[activeIndex] : value);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!suggestions.length) return;
      event.preventDefault();
      if (dismissed) {
        setDismissed(false);
        setActiveIndex(event.key === "ArrowDown" ? 0 : suggestions.length - 1);
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      // -1 is "no selection" and sits between the ends of the list.
      const next = activeIndex + step;
      if (next >= suggestions.length) setActiveIndex(-1);
      else if (next < -1) setActiveIndex(suggestions.length - 1);
      else setActiveIndex(next);
      return;
    }

    if (event.key === "Escape") {
      if (listOpen) {
        event.preventDefault();
        setDismissed(true);
        setActiveIndex(-1);
      }
      return;
    }

    if (event.key === "Enter" && listOpen && activeIndex >= 0) {
      event.preventDefault();
      go(suggestions[activeIndex]);
    }
  }

  function handleLucky() {
    const href = feelingLucky(docs);
    // May be an external deployment URL, so bypass the router entirely.
    window.location.assign(href);
  }

  const boxClasses = [
    "searchbox",
    `searchbox--${variant}`,
    focused ? "searchbox--focused" : "",
    listOpen ? "searchbox--open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <form
      className="searchbox-form"
      role="search"
      action="/search"
      method="get"
      onSubmit={handleSubmit}
    >
      <div
        className="searchbox-shell"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setFocused(false);
            setActiveIndex(-1);
          }
        }}
      >
        <div className={boxClasses}>
          <span className="searchbox-icon">
            <MagnifierIcon size={20} />
          </span>

          <label className="sr-only" htmlFor={`${listId}-input`}>
            Search David&apos;s Internet
          </label>
          <input
            id={`${listId}-input`}
            ref={inputRef}
            className="searchbox-input"
            type="text"
            name="q"
            value={value}
            autoFocus={autoFocus}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={listOpen}
            aria-controls={listOpen ? listId : undefined}
            aria-activedescendant={
              listOpen && activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
            }
            onChange={(event) => {
              setValue(event.target.value);
              setDismissed(false);
              setActiveIndex(-1);
            }}
            onFocus={() => setFocused(true)}
            onKeyDown={handleKeyDown}
          />

          <div className="searchbox-actions">
            {value ? (
              <>
                <button
                  type="button"
                  className="searchbox-iconbtn"
                  onClick={() => {
                    setValue("");
                    setActiveIndex(-1);
                    setDismissed(false);
                    inputRef.current?.focus();
                  }}
                >
                  <CloseIcon size={20} />
                  <span className="sr-only">Clear search</span>
                </button>
                <span className="searchbox-divider" aria-hidden="true" />
              </>
            ) : null}

            <span className="searchbox-iconbtn" aria-hidden="true">
              <MicIcon size={24} />
            </span>

            {variant === "serp" ? (
              <button type="submit" className="searchbox-iconbtn searchbox-iconbtn--go">
                <MagnifierIcon size={24} />
                <span className="sr-only">David Search</span>
              </button>
            ) : null}
          </div>
        </div>

        {listOpen ? (
          <ul
            className="suggestions"
            id={listId}
            role="listbox"
            aria-label="Search suggestions"
            // Keep focus in the input so the blur handler does not close the
            // list out from under the click.
            onMouseDown={(event) => event.preventDefault()}
          >
            {suggestions.map((suggestion, index) => (
              <li
                key={suggestion}
                id={`${listId}-opt-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={`suggestion${index === activeIndex ? " suggestion--active" : ""}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => go(suggestion)}
              >
                <span className="suggestion-icon">
                  <MagnifierIcon size={18} />
                </span>
                <span className="suggestion-text">{suggestion}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {variant === "home" ? (
        <div className="home-buttons">
          <button type="submit" className="gbtn">
            David Search
          </button>
          <button type="button" className="gbtn" onClick={handleLucky}>
            I&apos;m Feeling Lucky
          </button>
          <Link href="/demos" className="gbtn">
            Demos
          </Link>
        </div>
      ) : null}
    </form>
  );
}
