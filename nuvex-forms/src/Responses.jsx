import { useMemo, useState } from "react";
import { answersAsText, download, loadInbox, removeFromInbox, toCSV } from "./store.js";
import { InterviewReport } from "./Interview.jsx";
import { CopyButton, timeAgo } from "./ui.jsx";
import { IDownload, ITrash } from "./icons.jsx";

export function AnswerList({ answers }) {
  return (
    <dl className="answers">
      {answers.map(([q, a], i) => (
        <div className="answers-row" key={i}>
          <dt>{q}</dt>
          <dd className={a ? "" : "muted"}>{a || "No answer"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ResponseDetail({ r }) {
  return (
    <>
      <AnswerList answers={r.answers} />
      {r.interview && (
        <>
          <h3 className="detail-h">Interview</h3>
          <InterviewReport response={r} />
        </>
      )}
    </>
  );
}

/** All responses for one form, like the Responses tab in Google Forms. */
export default function FormResponses({ formId, title }) {
  const [inbox, setInbox] = useState(loadInbox);
  const [open, setOpen] = useState(null);
  const items = useMemo(() => inbox.filter((r) => r.formId === formId), [inbox, formId]);

  if (!items.length) {
    return (
      <div className="empty-box">
        <h2>No responses yet</h2>
        <p>Share your form. When someone applies, they send you their answers on WhatsApp or by email with a link — open that link and the response appears here.</p>
      </div>
    );
  }
  return (
    <>
      <div className="section-head">
        <h2>{items.length} response{items.length > 1 ? "s" : ""}</h2>
        <button className="btn btn-sm" onClick={() => download(`${title} - responses.csv`, toCSV(items), "text/csv")}>
          <IDownload size={15} /><span>Download spreadsheet</span>
        </button>
      </div>
      <div className="table">
        {items.map((r) => (
          <div key={r.id} className={`table-item ${open === r.id ? "is-open" : ""}`}>
            <button className="table-row is-button" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
              <span className="table-title">{r.from || "Applicant"}{r.interview && <span className="tag">Interview</span>}</span>
              <span className="muted table-preview">{r.email}</span>
              <span className="muted">{timeAgo(r.at)}</span>
            </button>
            {open === r.id && (
              <div className="table-detail">
                <ResponseDetail r={r} />
                <div className="row-start">
                  <CopyButton text={answersAsText(r.title, r.answers)} label="Copy" className="btn btn-sm" />
                  <button className="btn btn-sm is-danger" onClick={() => { removeFromInbox(r.id); setInbox(loadInbox()); }}>
                    <ITrash size={15} /><span>Delete</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
