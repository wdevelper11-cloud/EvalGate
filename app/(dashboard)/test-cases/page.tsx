import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function TestCasesPage() { return <><PageHeader eyebrow="Registry" title="Test cases" description="Define repeatable scenarios using name, input, expected_keywords, forbidden_keywords, category, priority, and status." action={{ href: "/test-cases/new", label: "New test case" }} /><div className="mt-7"><EmptyState title="No test cases yet" description="Create the first scenario to start building repeatable quality, safety, format, latency, and cost coverage." href="/test-cases/new" action="Create test case" /></div></>; }
