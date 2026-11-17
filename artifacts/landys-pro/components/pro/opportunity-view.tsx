import type { ReactNode } from "react";
import { Camera, Clock, Lock, MapPin } from "lucide-react";
import { timeLeft, photoUrl, type MatchView } from "@/lib/contractor-views";
import { Chip, Facts, Perforation } from "./ui";

/**
 * The full job ticket: what, where, budget, timing, the homeowner's own words,
 * then the action area (accept / call / report / pay) passed as children.
 */
export function OpportunityView({
  view,
  viaToken,
  children,
}: {
  view: MatchView;
  /** True on the login-free page opened from a text message. */
  viaToken: boolean;
  children: ReactNode;
}) {
  const { summary } = view;
  const open = view.state === "open";
  const left = open ? timeLeft(view.expiresAt) : null;
  const unlocked = !["open", "expired", "declined", "taken"].includes(view.state);
  // Before accepting, the details come first (read, then decide). Afterwards the
  // next action (call the homeowner, report, pay) comes first.
  const actionsFirst = !open;

  return (
    <article className={`pro-ticket${view.direct && open ? " pro-ticket--direct" : ""}`}>
      <div className="pro-ticket-top">
        <div className="pro-ticket-kind">
          <span>{summary.title}</span>
          {view.direct && <Chip tone="copper">The homeowner asked for you</Chip>}
        </div>
        <h1 className="pro-ticket-place" style={{ fontSize: 32 }}>
          {summary.cityState ?? summary.place}
        </h1>
        <p className="pro-ticket-sub">
          <MapPin size={16} aria-hidden style={{ verticalAlign: "-2px", marginRight: 4 }} />
          {summary.zip ? `ZIP ${summary.zip}` : summary.place}
          {summary.landTypeName ? `, ${summary.landTypeName.toLowerCase()} property` : ""}
        </p>
        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Chip tone={view.status.tone}>{view.status.label}</Chip>
          {left && (
            <Chip>
              <Clock size={15} aria-hidden /> {left} left to answer
            </Chip>
          )}
        </div>
      </div>

      <Perforation />

      <div className="pro-ticket-body">
        {actionsFirst && <div style={{ margin: "6px 0 26px" }}>{children}</div>}
        {actionsFirst && <h2 className="pro-quote-label" style={{ marginTop: 0 }}>Job details</h2>}
        <Facts
          items={[
            { label: "Budget", value: summary.budgetLabel ?? "Not given" },
            { label: "When", value: summary.timelineLabel },
            { label: "Urgency", value: summary.urgencyLabel },
            { label: "Type of work", value: summary.workTypeName },
          ]}
        />

        {summary.description && (
          <>
            <p className="pro-quote-label">What the homeowner wrote</p>
            <blockquote className="pro-quote">{summary.description}</blockquote>
          </>
        )}

        {view.photos.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <p className="pro-quote-label" style={{ marginTop: 0 }}>
              <Camera size={18} aria-hidden style={{ verticalAlign: "-3px", marginRight: 6 }} />
              {view.photos.length} photo{view.photos.length > 1 ? "s" : ""} from the homeowner
            </p>
            {unlocked ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                {view.photos.map((photo) =>
                  photo.isImage ? (
                    <a key={photo.id} href={photoUrl(view, photo.id, viaToken)} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL via redirect */}
                      <img
                        src={photoUrl(view, photo.id, viaToken)}
                        alt={`Photo: ${photo.name}`}
                        style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 12, border: "1px solid var(--pro-line)" }}
                      />
                    </a>
                  ) : (
                    <a key={photo.id} className="pro-btn pro-btn--secondary" href={photoUrl(view, photo.id, viaToken)} target="_blank" rel="noreferrer">
                      Open {photo.name}
                    </a>
                  ),
                )}
              </div>
            ) : (
              <p className="pro-small" style={{ margin: 0 }}>
                <Lock size={15} aria-hidden style={{ verticalAlign: "-2px", marginRight: 4 }} />
                You can see them after you accept.
              </p>
            )}
          </div>
        )}

        {!actionsFirst && <div style={{ marginTop: 24 }}>{children}</div>}
      </div>
    </article>
  );
}
