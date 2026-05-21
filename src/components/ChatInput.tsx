import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/settings/preferences";

type ChatInputProps = {
  onSubmit: (content: string) => void;
  onVoiceSubmit: () => void;
};

const LONG_PRESS_MS = 500;

export default function ChatInput({ onSubmit, onVoiceSubmit }: ChatInputProps) {
  const { t } = usePreferences();
  const [value, setValue] = useState("");
  const [readOnly, setReadOnly] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const submitGuardRef = useRef(false);
  const hasContent = value.trim().length > 0;

  const submit = () => {
    if (submitGuardRef.current) return;
    submitGuardRef.current = true;

    const content = value.trim();
    if (!content) {
      submitGuardRef.current = false;
      return;
    }
    onSubmit(content);
    setValue("");
    setReadOnly(true);

    setTimeout(() => {
      submitGuardRef.current = false;
    }, 300);
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const enableTextModeAndFocus = () => {
    setIsRecording(false);
    setReadOnly(false);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  const handleFieldPointerDown = () => {
    longPressTriggeredRef.current = false;
    clearLongPressTimer();

    if (!readOnly || hasContent) return;

    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setIsRecording(true);
    }, LONG_PRESS_MS);
  };

  const handleFieldPointerUp = () => {
    clearLongPressTimer();

    if (longPressTriggeredRef.current) {
      onVoiceSubmit();
      setIsRecording(false);
      setReadOnly(true);
      longPressTriggeredRef.current = false;
      return;
    }

    if (readOnly) {
      enableTextModeAndFocus();
    }
  };

  const handleFieldPointerCancel = () => {
    clearLongPressTimer();
    setIsRecording(false);
    longPressTriggeredRef.current = false;
  };

  return (
    <div className="shrink-0 bg-bg px-[10px] py-2">
      <div
        className={cn(
          "relative rounded-[12px] border border-transparent bg-surface transition-all duration-300 ease-out",
          isRecording
            ? "shadow-[0_0_0_1px_var(--primary-ring),0_0_18px_var(--primary-ring)]"
            : !readOnly
              ? "shadow-[0_0_0_1px_var(--primary-ring),0_0_10px_var(--primary-ring)]"
              : "shadow-soft"
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          readOnly={readOnly}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          onFocus={() => setReadOnly(false)}
          onBlur={() => {
            if (!value.trim()) {
              setReadOnly(true);
            }
          }}
          onPointerDown={handleFieldPointerDown}
          onPointerUp={handleFieldPointerUp}
          onPointerLeave={handleFieldPointerCancel}
          onPointerCancel={handleFieldPointerCancel}
          onClick={() => {
            if (readOnly) {
              enableTextModeAndFocus();
            }
          }}
          placeholder={readOnly || hasContent ? "" : t("composer.textPlaceholder")}
          className={cn(
            "block w-full resize-none rounded-[12px] bg-surface py-4 pl-4 text-base leading-6 text-text placeholder:text-input-placeholder",
            "focus:outline-none focus-visible:shadow-none",
            "max-h-[168px] min-h-[54px]",
            hasContent ? "pr-[64px]" : "pr-4"
          )}
          rows={1}
          aria-label={t("composer.placeholder")}
        />

        {readOnly && !hasContent && (
          <div className="pointer-events-none absolute inset-x-[50px] top-0 flex h-[54px] items-center justify-center">
            <span
              className={cn(
                "truncate text-center text-base font-medium",
                isRecording
                  ? "text-primary"
                  : "text-text-tertiary/65"
              )}
            >
              {isRecording ? t("composer.recording") : t("composer.placeholder")}
            </span>
          </div>
        )}

        {hasContent && (
          <div className="absolute bottom-0 right-0 top-0 flex items-end pr-4">
            <div className="mb-[7px] flex h-10 items-center">
              <button
                type="button"
                onClick={submit}
                className="flex h-10 w-10 items-center justify-center rounded-full text-primary transition active:scale-[0.9]"
                title={t("composer.send")}
                aria-label={t("composer.send")}
              >
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <circle cx="20" cy="20" r="20" fill="currentColor" />
                  <path
                    d="M13 20.5 25.8 14.2c.5-.25 1 .25.77.76l-5.92 13.08c-.22.5-.95.42-1.06-.11l-1.12-5.4a1.1 1.1 0 0 0-.86-.85l-4.5-.88c-.54-.1-.62-.83-.11-1.08Z"
                    fill="var(--on-primary)"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
