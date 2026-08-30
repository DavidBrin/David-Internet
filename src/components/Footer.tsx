import Link from "next/link";

interface FooterProps {
  /** The SERP footer gets a top border; the homepage footer does not. */
  variant?: "home" | "serp";
  /** Location line shown in the upper bar. */
  location?: string;
}

export default function Footer({ variant = "home", location = "San Diego, California" }: FooterProps) {
  return (
    <footer className={variant === "serp" ? "footer footer--serp" : "footer"}>
      <div className="footer-top">{location}</div>
      <div className="footer-bottom">
        <div className="footer-group">
          <Link className="footer-link" href="/about">
            About
          </Link>
          <Link className="footer-link" href="/path">
            The Path
          </Link>
          <Link className="footer-link" href="/how-this-works">
            How this works
          </Link>
        </div>
        <div className="footer-tagline">
          David&apos;s Internet — making the web smaller since 2025
        </div>
      </div>
    </footer>
  );
}
