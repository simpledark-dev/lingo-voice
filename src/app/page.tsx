import { AccountShell } from "@/web/account/AccountShell";
import { Lobby } from "@/web/lobby/Lobby";

export default function HomePage() {
  return (
    <AccountShell>
      <Lobby />
    </AccountShell>
  );
}
