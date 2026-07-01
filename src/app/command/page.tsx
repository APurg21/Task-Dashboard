import { CommandCenter } from "@/command-center/components/CommandCenter";
import { commandCenterMock } from "@/command-center/lib/mock";

// Cosmic Command Center — 17-module personal command center. Renders on mock
// data; ai.ask + obsidian.search are wired to real backends (Sonnet 5 + the KB).
export default function CommandPage() {
  return <CommandCenter data={commandCenterMock} />;
}
