import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function ResultsPage() { return <><PageHeader eyebrow="Evidence" title="Evaluation results" description="Inspect per-test responses, dimension scores, failure reasons, and pass or fail status." /><div className="mt-7"><EmptyState title="No results available" description="Complete an evaluation in a later phase to populate per-test release evidence." href="/evaluations" action="Open runner preview" /></div></>; }
