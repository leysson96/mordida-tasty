"use client";

import { Eye, EyeOff } from "lucide-react";
import { InputHTMLAttributes, useId, useState } from "react";

interface PasswordFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  className?: string;
}

export function PasswordField({
  label,
  className,
  id,
  disabled,
  ...inputProps
}: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <label className={className}>
      {label}
      <span className="password-field">
        <input
          {...inputProps}
          id={inputId}
          disabled={disabled}
          type={visible ? "text" : "password"}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Ocultar contrasena" : "Mostrar contrasena"}
          aria-pressed={visible}
          disabled={disabled}
        >
          {visible ? (
            <EyeOff aria-hidden="true" size={20} />
          ) : (
            <Eye aria-hidden="true" size={20} />
          )}
        </button>
      </span>
    </label>
  );
}
