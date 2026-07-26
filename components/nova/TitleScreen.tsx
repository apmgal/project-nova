"use client";

interface TitleScreenProps {
  hasSave: boolean;
  onNewGame: () => void;
  onContinue: () => void;
}

/** Welcome screen: muted solid backdrop (no photo for now), centered title
 * and menu actions. Continue only shows once a save exists. */
export default function TitleScreen({ hasSave, onNewGame, onContinue }: TitleScreenProps) {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-900">
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-lg font-medium tracking-wide text-amber-200">PROJECT NOVA</h1>

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onNewGame}
            className="border-b-2 border-amber-200 pb-1 text-sm font-medium tracking-wide text-zinc-50 hover:text-amber-200"
          >
            START NOW
          </button>
          {hasSave && (
            <p className="text-[10px] text-zinc-500">Overwrites your saved progress</p>
          )}
        </div>

        {hasSave && (
          <button
            onClick={onContinue}
            className="text-xs tracking-wide text-zinc-400 hover:text-zinc-200"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}
