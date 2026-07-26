import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function PromptsPage() { return <><PageHeader eyebrow="Registry" title="Prompt versions" description="Keep candidate instructions traceable across releases—for example, Support Agent Prompt v1 and Support Agent Prompt v2." action={{ href: "/prompts/new", label: "New prompt version" }} /><div className="mt-7"><EmptyState title="No prompt versions yet" description="Register a prompt candidate before building an evaluation run. Each version will retain its own name, model, label, and status." href="/prompts/new" action="Create prompt version" /></div></>; }
