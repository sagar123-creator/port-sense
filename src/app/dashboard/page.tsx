import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { Container } from "@/components/ui/Container";
import { BRAND } from "@/lib/brand";

export const metadata = {
  title: "Dashboard",
  description: `Compare Indian ports for your destination — ${BRAND.name}`,
};

export default function DashboardPage() {
  return (
    <div className="relative isolate overflow-x-hidden bg-surface-1 pt-20 pb-24 sm:pt-28 sm:pb-20">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_80%_at_80%_0%,rgba(228,77,14,0.16),transparent_70%)]" />
      <Container width="wide" className="relative min-w-0 px-4 sm:px-6">
        <DashboardClient />
      </Container>
    </div>
  );
}
