"use client";

import { User, Linkedin as LinkedinIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProspectAvatar({
  name,
  photoUrl,
  colorIndex,
  size = "size-10",
}: {
  name: string;
  photoUrl?: string | null;
  colorIndex: number;
  size?: string;
}) {
  if (photoUrl) {
    return (
      <div
        className={cn(size, "rounded-full border border-white/10 overflow-hidden shrink-0 shadow-xl")}
      >
        <img
          src={photoUrl}
          alt={name}
          className="size-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
    );
  }

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const colors = [
    "bg-blue-500/20 text-blue-400 border-blue-500/30",
    "bg-purple-500/20 text-purple-400 border-purple-500/30",
    "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    "bg-amber-500/20 text-amber-400 border-amber-500/30",
    "bg-rose-500/20 text-rose-400 border-rose-500/30",
  ];

  const colorClass = colors[colorIndex % colors.length];

  return (
    <div
      className={cn(size, "rounded-full border flex items-center justify-center font-bold text-xs shrink-0 shadow-xl", colorClass)}
    >
      {initials || <User className="size-4" />}
    </div>
  );
}

export const getTitleAndCompany = (role: string, companyName?: string | null) => {
  if (!role || role === "Décideur") {
    return { title: "Décideur", company: companyName || "" };
  }

  const parts = role.split(/\s+(?:at|chez)\s+|[@|•]|\s[-–—]\s/i);
  let title = parts[0].trim();
  let company = (companyName || "").trim();

  if (!company && parts.length > 1) {
    company = parts[1].trim();
  }

  if (company && title.toLowerCase().endsWith(company.toLowerCase())) {
    const stripped = title.substring(0, title.length - company.length).trim();
    const cleaned = stripped.replace(/[@|•\-–·\s,:]+$/, "").trim();
    if (cleaned.length >= 2) {
      title = cleaned;
    }
  }

  if (title.toLowerCase() === company.toLowerCase()) {
    return { title, company: "" };
  }

  return { title, company };
};

export const firstText = (...values: any[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
};

const getOrganizationData = (prospect: any) => {
  return prospect.company || {};
};

export const getProspectIndustry = (prospect: any) => {
  const organization = getOrganizationData(prospect);
  return firstText(
    prospect.company?.industry,
    prospect.extra_data?.industry,
    prospect.raw_data?.industry,
    organization.industry,
  );
};

export const getProspectCompanySize = (prospect: any) => {
  const organization = getOrganizationData(prospect);
  return firstText(
    prospect.company?.size_range,
    prospect.extra_data?.company_size,
    prospect.raw_data?.companySize,
    prospect.raw_data?.company_size,
    organization.companySize,
    organization.company_size,
    organization.size_range,
  );
};

export const getProspectLocation = (prospect: any) => {
  const organization = getOrganizationData(prospect);
  return firstText(
    prospect.location,
    prospect.company?.location,
    prospect.extra_data?.location,
    prospect.raw_data?.profileLocation,
    prospect.raw_data?.location,
    organization.location,
  );
};

export const getProspectWebsite = (prospect: any) => {
  const organization = getOrganizationData(prospect);
  return firstText(
    prospect.website,
    prospect.website_url,
    prospect.company?.website,
    prospect.extra_data?.website_url,
    prospect.raw_data?.companyWebsite,
    prospect.raw_data?.website_url,
    organization.website,
    organization.website_url,
  );
};

export const getProspectCompanyLinkedin = (prospect: any) => {
  const organization = getOrganizationData(prospect);
  return firstText(
    prospect.company?.linkedin_url,
    prospect.extra_data?.company_linkedin_url,
    prospect.raw_data?.companyLinkedinUrl,
    prospect.raw_data?.organizationLinkedinUrl,
    organization.linkedin_url,
    organization.linkedinUrl,
  );
};

export const getProspectCompanyDescription = (prospect: any) => {
  const organization = getOrganizationData(prospect);
  return firstText(
    prospect.company_description,
    prospect.company?.description,
    prospect.extra_data?.company_description,
    prospect.raw_data?.companyDescription,
    prospect.raw_data?.organizationDescription,
    organization.description,
    organization.mission,
  );
};

export const getIcpMeta = (p: any) => {
  const score = p.pre_score || p.fit_score || 0;
  if (score >= 80) return { shortLabel: "HIGH", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
  if (score >= 50) return { shortLabel: "MED", className: "bg-orange-500/10 text-orange-400 border-orange-500/20" };
  return { shortLabel: "LOW", className: "bg-red-500/10 text-red-400 border-red-500/20" };
};

export const isProspectQualificationDone = (p: any) => {
  return p.qualification_status === "qualified" || p.qualification_status === "contacted" || p.qualification_status === "engaged";
};

export const getStepLabel = (status: string) => {
  if (!status || status === "to_qualify" || status === "collected")
    return "Step 1";
  if (status === "pre_scored" || status === "contacted") return "Step 2";
  if (status === "engaged" || status === "follow_up") return "Step 3";
  if (status === "converted" || status === "rejected") return "End";
  return "Step 1";
};
