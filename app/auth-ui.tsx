'use client';

import { useState, type ChangeEvent } from 'react';
import { useFormStatus } from 'react-dom';
import { Check, Circle, Eye, EyeOff, Loader2 } from 'lucide-react';

const passwordRules: { label: string; test: (value: string) => boolean }[] = [
  { label: '12–128 characters', test: (value) => value.length >= 12 && value.length <= 128 },
  { label: 'An uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { label: 'A lowercase letter', test: (value) => /[a-z]/.test(value) },
  { label: 'A number', test: (value) => /\d/.test(value) },
  { label: 'A symbol', test: (value) => /[^A-Za-z0-9]/.test(value) },
];

export function PasswordField({
  id,
  name,
  label,
  autoComplete,
  minLength,
  maxLength,
  placeholder,
  showRules = false,
}: {
  id?: string;
  name: string;
  label: string;
  autoComplete?: string;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  showRules?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState('');
  return (
    <label className="grid gap-2 text-sm font-semibold" htmlFor={id}>{label}
      <span className="relative block">
        <input
          id={id}
          className="auth-control pr-14 font-normal"
          name={name}
          type={visible ? 'text' : 'password'}
          required
          autoComplete={autoComplete}
          minLength={minLength}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setValue(event.target.value)}
        />
        <button
          type="button"
          aria-pressed={visible}
          aria-label={visible ? 'Hide password' : 'Show password'}
          onClick={() => setVisible((current) => !current)}
          className="absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-lg text-[#52645f] transition hover:text-[#20312d]"
        >
          {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
        </button>
      </span>
      {showRules && (
        <ul aria-live="polite" className="mt-1 grid gap-1 text-xs">
          {passwordRules.map((rule) => {
            const met = rule.test(value);
            return (
              <li key={rule.label} className={`flex items-center gap-1.5 ${met ? 'text-[#216b61]' : 'text-[#687873]'}`}>
                {met ? <Check className="size-3.5" aria-hidden="true" /> : <Circle className="size-3.5" aria-hidden="true" />}
                {rule.label}
              </li>
            );
          })}
        </ul>
      )}
    </label>
  );
}

export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  className = '',
}: {
  children: React.ReactNode;
  pendingLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`auth-submit flex items-center justify-center gap-2 p-3 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {pending ? <><Loader2 className="size-4 animate-spin" aria-hidden="true" />{pendingLabel}</> : children}
    </button>
  );
}
