import { CommandCenter } from "@/command-center/components/CommandCenter";
import { commandCenterMock } from "@/command-center/lib/mock";

// Home = Cosmic Command Center (17-module blacklight command center). The
// original task board moved to /tasks; ai.ask + obsidian.search are wired to
// real backends (Sonnet 5 + the knowledge base).
export default function Home() {
  return <CommandCenter data={commandCenterMock} />;
}
