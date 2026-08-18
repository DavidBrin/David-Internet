import Link from "next/link";
import { AllIcon, ImagesIcon, VideosIcon } from "./Icons";

export type SearchTab = "all" | "images" | "videos";

interface TabsProps {
  query: string;
  active: SearchTab;
}

const TABS: ReadonlyArray<{ id: SearchTab; label: string; Icon: typeof AllIcon }> = [
  { id: "all", label: "All", Icon: AllIcon },
  { id: "images", label: "Images", Icon: ImagesIcon },
  { id: "videos", label: "Videos", Icon: VideosIcon },
];

export function tabHref(query: string, tab: SearchTab): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (tab !== "all") params.set("tab", tab);
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}

export default function Tabs({ query, active }: TabsProps) {
  return (
    <nav className="tabs" aria-label="Result type">
      {TABS.map(({ id, label, Icon }) => (
        <Link
          key={id}
          className={id === active ? "tab tab--active" : "tab"}
          href={tabHref(query, id)}
          aria-current={id === active ? "page" : undefined}
        >
          <Icon size={16} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
