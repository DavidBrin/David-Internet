"use client";

/**
 * Zones 1+2 of the servers panel: a mini browser replaying requests against
 * TS ports of ChatServer's and DocSearchServer's Handlers (two "server
 * tabs"), with a small dot animation for the request/response round trip and
 * the matching handler branch highlighted while it's "running".
 */
import { useEffect, useRef, useState } from "react";
import {
  chatHandle,
  docSearchHandle,
  initialChatState,
  type ChatBranch,
  type ChatState,
  type CorpusDoc,
  type SearchBranch,
} from "./logic";

type Phase = "idle" | "toServer" | "atServer" | "toBrowser";
type Tab = "chat" | "search";

const TRAVEL_MS = 350;
const HIGHLIGHT_MS = 600;

const CHAT_EXAMPLES = ["/", "/add-message?s=hello&user=david", "/add-message?s=missing-user"];
const SEARCH_EXAMPLES = ["/", "/search?q=cache", "/search?q=Aho-Corasick", "/search?q=zebra"];

const CHAT_BRANCHES: { id: ChatBranch; label: string }[] = [
  { id: "root", label: 'path === "/"  ->  chat = ""; return "Number of chats: " + num++' },
  { id: "add-message-ok", label: 'path contains "/add-message", s & user present  ->  chat += "user: message\\n"' },
  { id: "add-message-404", label: 'path contains "/add-message" but query is not s=...&user=...  ->  "404 Not Found!"' },
  { id: "unknown-404", label: 'else  ->  "404 Not Found!"' },
];

const SEARCH_BRANCHES: { id: SearchBranch; label: string }[] = [
  { id: "root", label: 'path === "/"  ->  "There are N total files to search."' },
  { id: "search-ok", label: 'path === "/search", q present  ->  substring match every doc, sorted paths' },
  { id: "search-no-q", label: 'path === "/search", no q param  ->  "Couldn\'t find query parameter q"' },
  { id: "unknown-path", label: 'else  ->  "Don\'t know how to handle that path!"' },
];

interface ReplayZoneProps {
  docs: CorpusDoc[];
  corpusNote: string | null;
  reducedMotion: boolean;
}

export default function ReplayZone({ docs, corpusNote, reducedMotion }: ReplayZoneProps) {
  const [tab, setTab] = useState<Tab>("chat");

  // --- chat tab state ---
  const [chatState, setChatState] = useState<ChatState>(initialChatState);
  const [chatUrl, setChatUrl] = useState(CHAT_EXAMPLES[0]);
  const [chatPhase, setChatPhase] = useState<Phase>("idle");
  const [chatBranch, setChatBranch] = useState<ChatBranch | null>(null);
  const [chatResponse, setChatResponse] = useState<string | null>(null);
  const [chatJustReset, setChatJustReset] = useState(false);
  const chatTimers = useRef<number[]>([]);
  const chatGen = useRef(0);

  // --- search tab state ---
  const [searchUrl, setSearchUrl] = useState(SEARCH_EXAMPLES[1]);
  const [searchPhase, setSearchPhase] = useState<Phase>("idle");
  const [searchBranch, setSearchBranch] = useState<SearchBranch | null>(null);
  const [searchResponse, setSearchResponse] = useState<string | null>(null);
  const [foundPaths, setFoundPaths] = useState<string[]>([]);
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const searchTimers = useRef<number[]>([]);
  const searchGen = useRef(0);

  useEffect(() => {
    return () => {
      chatTimers.current.forEach((id) => window.clearTimeout(id));
      searchTimers.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  function runChat(url: string) {
    chatGen.current += 1;
    const gen = chatGen.current;
    chatTimers.current.forEach((id) => window.clearTimeout(id));
    chatTimers.current = [];

    const outcome = chatHandle(url, chatState);

    if (reducedMotion) {
      setChatState(outcome.nextState);
      setChatBranch(outcome.branch);
      setChatResponse(outcome.response);
      setChatJustReset(outcome.branch === "root");
      setChatPhase("idle");
      return;
    }

    setChatPhase("toServer");
    setChatBranch(null);
    setChatJustReset(false);

    const t1 = window.setTimeout(() => {
      if (gen !== chatGen.current) return;
      setChatPhase("atServer");
      setChatBranch(outcome.branch);
    }, TRAVEL_MS);

    const t2 = window.setTimeout(() => {
      if (gen !== chatGen.current) return;
      setChatPhase("toBrowser");
    }, TRAVEL_MS + HIGHLIGHT_MS);

    const t3 = window.setTimeout(() => {
      if (gen !== chatGen.current) return;
      setChatState(outcome.nextState);
      setChatResponse(outcome.response);
      setChatJustReset(outcome.branch === "root");
      setChatPhase("idle");
    }, TRAVEL_MS * 2 + HIGHLIGHT_MS);

    chatTimers.current = [t1, t2, t3];
  }

  function runSearch(url: string) {
    searchGen.current += 1;
    const gen = searchGen.current;
    searchTimers.current.forEach((id) => window.clearTimeout(id));
    searchTimers.current = [];

    const outcome = docSearchHandle(url, docs);

    if (reducedMotion) {
      setSearchBranch(outcome.branch);
      setSearchResponse(outcome.response);
      setFoundPaths(outcome.foundPaths);
      setExpandedPath(null);
      setSearchPhase("idle");
      return;
    }

    setSearchPhase("toServer");
    setSearchBranch(null);

    const t1 = window.setTimeout(() => {
      if (gen !== searchGen.current) return;
      setSearchPhase("atServer");
      setSearchBranch(outcome.branch);
    }, TRAVEL_MS);

    const t2 = window.setTimeout(() => {
      if (gen !== searchGen.current) return;
      setSearchPhase("toBrowser");
    }, TRAVEL_MS + HIGHLIGHT_MS);

    const t3 = window.setTimeout(() => {
      if (gen !== searchGen.current) return;
      setSearchResponse(outcome.response);
      setFoundPaths(outcome.foundPaths);
      setExpandedPath(null);
      setSearchPhase("idle");
    }, TRAVEL_MS * 2 + HIGHLIGHT_MS);

    searchTimers.current = [t1, t2, t3];
  }

  const isChat = tab === "chat";
  const url = isChat ? chatUrl : searchUrl;
  const setUrl = isChat ? setChatUrl : setSearchUrl;
  const phase = isChat ? chatPhase : searchPhase;
  const pending = phase !== "idle";
  const branches = isChat ? CHAT_BRANCHES : SEARCH_BRANCHES;
  const activeBranch: string | null = isChat ? chatBranch : searchBranch;
  const response = isChat ? chatResponse : searchResponse;

  function go() {
    if (pending) return;
    if (isChat) runChat(chatUrl);
    else runSearch(searchUrl);
  }

  return (
    <div>
      <p className="eSCredit">
        Server.java, the HTTP plumbing, was course-provided; the handlers are David&apos;s.
      </p>

      <div className="eSTabs" role="tablist">
        <button
          type="button"
          role="tab"
          className="eSTabBtn"
          data-active={isChat}
          aria-selected={isChat}
          onClick={() => setTab("chat")}
        >
          ChatServer :8080
        </button>
        <button
          type="button"
          role="tab"
          className="eSTabBtn"
          data-active={!isChat}
          aria-selected={!isChat}
          onClick={() => setTab("search")}
        >
          DocSearchServer :8081
        </button>
      </div>

      <div className="eSReplay">
        <div className="eSBrowser">
          <div className="eSBrowserChrome">
            <span className="eSDots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <div className="eSUrlBar">
              <span className="eSHost">localhost:{isChat ? "8080" : "8081"}</span>
              <input
                className="eSUrlInput"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") go();
                }}
                aria-label={isChat ? "Chat server URL" : "Doc search server URL"}
                spellCheck={false}
              />
              <button type="button" className="eSGoBtn" onClick={go} disabled={pending} aria-label="Go">
                {"->"}
              </button>
            </div>
          </div>
          <div className="eSExamples">
            {(isChat ? CHAT_EXAMPLES : SEARCH_EXAMPLES).map((ex) => (
              <button
                key={ex}
                type="button"
                className="eSExampleChip"
                onClick={() => setUrl(ex)}
                disabled={pending}
              >
                {ex}
              </button>
            ))}
          </div>
          <div className="eSViewport">
            {phase === "idle" && response !== null && <pre className="eSResponse">{response}</pre>}
            {phase === "idle" && response === null && (
              <p className="eSResponsePlaceholder">Press Go to send a request.</p>
            )}
            {phase !== "idle" && <p className="eSPending">waiting on the server...</p>}
            {isChat && chatJustReset && phase === "idle" && (
              <span className="eSCallout">yes, reading the chat resets it - the archived handler really does this</span>
            )}
            {!isChat && phase === "idle" && foundPaths.length > 0 && (
              <ul className="eSResultList">
                {foundPaths.map((p) => (
                  <li key={p}>
                    <button
                      type="button"
                      className="eSPathBtn"
                      onClick={() => setExpandedPath(expandedPath === p ? null : p)}
                    >
                      {p}
                    </button>
                    {expandedPath === p && (
                      <div className="eSDocPreview">{docs.find((d) => d.path === p)?.text}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {!isChat && corpusNote && <p className="eSCorpusNote">{corpusNote}</p>}
          </div>
        </div>

        <div className="eSTrack" aria-hidden="true">
          <div className="eSTrackLine" />
          {!reducedMotion && <div className="eSDot" data-phase={phase} />}
        </div>

        <div className="eSServer">
          <div className="eSServerHead">Handler.handleRequest(url)</div>
          <div className="eSBranchList">
            {branches.map((b) => (
              <div key={b.id} className="eSBranch" data-active={activeBranch === b.id}>
                {b.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
