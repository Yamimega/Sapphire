"use client";

import { useCallback, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/lib/i18n/context";
import { extractPlainText } from "@/lib/plate-utils";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const { t } = useTranslation();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [text, setText] = useState(() => extractPlainText(value) ?? "");

  const handleChange = useCallback(
    (newValue: string) => {
      setText(newValue);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChange(newValue);
      }, 800);
    },
    [onChange]
  );

  return (
    <Textarea
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={t("notes.placeholder")}
      className="min-h-[200px] resize-y text-sm font-mono"
    />
  );
}
