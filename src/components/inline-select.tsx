'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface InlineSelectProps {
  value: string;
  options: string[];
  onSave: (value: string) => Promise<void>;
  className?: string;
}

export function InlineSelect({ value, options, onSave, className }: InlineSelectProps) {
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(value);
  const [custom, setCustom] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => { setCurrent(value); }, [value]);

  useEffect(() => {
    if (editing && custom) inputRef.current?.focus();
    if (editing && !custom) selectRef.current?.focus();
  }, [editing, custom]);

  async function handleSave(newVal: string) {
    const trimmed = newVal.trim();
    setEditing(false);
    setCustom(false);
    if (trimmed && trimmed !== value) {
      setCurrent(trimmed);
      await onSave(trimmed);
    } else {
      setCurrent(value);
    }
  }

  if (editing && custom) {
    return (
      <input
        ref={inputRef}
        className="bg-background border rounded px-1 py-0.5 text-sm w-full"
        defaultValue={current}
        onKeyDown={e => {
          if (e.key === 'Enter') handleSave((e.target as HTMLInputElement).value);
          if (e.key === 'Escape') { setEditing(false); setCustom(false); }
        }}
        onBlur={e => handleSave(e.target.value)}
      />
    );
  }

  if (editing) {
    return (
      <select
        ref={selectRef}
        className="bg-background border rounded px-1 py-0.5 text-sm w-full"
        value={current}
        onChange={e => {
          if (e.target.value === '__custom__') {
            setCustom(true);
          } else {
            handleSave(e.target.value);
          }
        }}
        onBlur={() => { setEditing(false); setCustom(false); }}
      >
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
        <option value="__custom__">+ New value...</option>
      </select>
    );
  }

  return (
    <span
      className={cn('cursor-pointer hover:underline decoration-dashed underline-offset-4', className)}
      onClick={() => setEditing(true)}
      title="Click to edit"
    >
      {current || '—'}
    </span>
  );
}
