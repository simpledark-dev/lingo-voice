import { AccountShell } from "@/web/account/AccountShell";
import { CreateRoomForm } from "@/web/lobby/CreateRoomForm";

export default function CreatePage() {
  return (
    <AccountShell>
      <CreateRoomForm />
    </AccountShell>
  );
}
