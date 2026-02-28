"use client";

import { useParams } from "next/navigation";
import CandidateApplicationForm from "../../components/CandidateApplicationForm";

export default function ApplyBySlugPage() {
  const params = useParams();
  const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug;

  return <CandidateApplicationForm slug={slug || null} />;
}
