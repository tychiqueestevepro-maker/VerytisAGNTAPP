import type { Integration } from "@/types/models";

export function IntegrationLogo({ name }: { name: Integration["name"] }) {
  return (
    <div className="flex size-11 items-center justify-center rounded-[12px] bg-[#111111] text-white/82 ring-1 ring-white/10">
      {name === "Gmail" ? <GmailMark /> : null}
      {name === "LinkedIn" ? <LinkedInMark /> : null}
      {name === "Google Sheets" ? <SheetsMark /> : null}
      {name === "CRM" ? <CrmMark /> : null}
    </div>
  );
}

function GmailMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <path d="M4.5 7.5v10h15v-10L12 13.2 4.5 7.5Z" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" />
      <path d="M4.5 7.5 12 13.2l7.5-5.7" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
    </svg>
  );
}

function LinkedInMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <path d="M6.8 10v7.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M11.1 17.5v-4.1c0-2 1.2-3.5 3.2-3.5s3 1.4 3 3.6v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M6.8 6.7h.1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function SheetsMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <path d="M8 4.8h5.7L17 8.1v11.1H8V4.8Z" stroke="currentColor" strokeWidth="1.45" strokeLinejoin="round" />
      <path d="M13.7 4.9v3.2H17" stroke="currentColor" strokeWidth="1.45" strokeLinejoin="round" />
      <path d="M10 11.2h5M10 14h5M12.5 11.2v5.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function CrmMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <path d="M6.2 15.8c1.2-2 3-3 5.8-3s4.6 1 5.8 3" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
      <path d="M8.4 8.2a2.2 2.2 0 1 0 4.4 0 2.2 2.2 0 0 0-4.4 0Z" stroke="currentColor" strokeWidth="1.45" />
      <path d="M14.2 9.6c1.5.2 2.7 1 3.6 2.2" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
    </svg>
  );
}
