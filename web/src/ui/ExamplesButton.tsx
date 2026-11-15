"use client";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EXAMPLES, type Example } from "@/model/examples";
import "./share-button.css"; // the menu reuses Share's paper/ink menu look

/** sidebar "Examples" button: a menu of ready-made patches, simplest first; picking one calls onPick */
export default function ExamplesButton({ roomId, disabled, onPick }: {
  roomId: string | null;
  disabled?: boolean;
  onPick: (example: Example) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="btn examples-btn" disabled={disabled}
          title={roomId ? "Open an example as a new room" : "Replace this graph with an example"}>
          Examples
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="share-menu">
        <DropdownMenuLabel className="share-menu__label">
          {roomId ? "Open as a new room" : "Replace the canvas with"}
        </DropdownMenuLabel>
        {EXAMPLES.map((ex) => (
          <DropdownMenuItem key={ex.id} className="share-menu__item" onSelect={() => onPick(ex)}>
            <span className="share-menu__name">{ex.name}</span>
            <span className="share-menu__hint">{ex.hint}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
