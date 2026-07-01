import { LiveCommandCenter } from "@/command-center/components/LiveCommandCenter";

// Home = Cosmic Command Center, its Today view fed live from the real task
// board (Redis via /api/tasks) with write-back. Chief of Staff + Knowledge are
// wired to real backends; the rest of the modules run on mock until wired.
export default function Home() {
  return <LiveCommandCenter />;
}
