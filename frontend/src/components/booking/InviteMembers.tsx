import { useState } from "react";
import { Search, Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InviteMembersProps {
  initialMembers?: string[];
  onMembersChange?: (members: string[]) => void;
}

export function InviteMembers({ initialMembers = [], onMembersChange }: InviteMembersProps) {
  const [members, setMembers] = useState(initialMembers);
  const [memberInput, setMemberInput] = useState("");

  const addMember = () => {
    if (memberInput.trim()) {
      const next = [...members, memberInput.trim()];
      setMembers(next);
      onMembersChange?.(next);
      setMemberInput("");
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-5">
      <h3 className="font-semibold text-card-foreground mb-3">Invite Members</h3>
      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            placeholder="jane.doe@company.com"
            className="bg-transparent text-sm outline-none w-full text-foreground placeholder:text-muted-foreground"
            value={memberInput}
            onChange={(e) => setMemberInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addMember()}
          />
        </div>
        {members.map((m, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground border border-border rounded-lg px-3 py-2">
            <Users className="h-4 w-4" />
            <span className="truncate">{m}</span>
          </div>
        ))}
        <button
          className="flex items-center gap-2 text-sm text-muted-foreground border border-dashed border-border rounded-lg px-3 py-2 w-full hover:bg-secondary transition-colors"
          onClick={addMember}
        >
          <Plus className="h-4 w-4" /> Add Member
        </button>
      </div>
      <Button className="w-full rounded-full">Search</Button>
    </div>
  );
}
