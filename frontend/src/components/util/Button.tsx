import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export default function Button({
  text, onClick, disabled = false, fit = false, black = false
}: {
  text: string;
  onClick: () => void;
  disabled?: boolean;
  fit?: boolean;
  black?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      className={`
         rounded-sm text-sm cursor-pointer transition-colors font-semibold
        ${fit ? 'px-6 py-3 w-full' : 'px-6 py-1.5 w-auto'}
        ${disabled ? 'opacity-30 pointer-events-none' : 'opacity-100 pointer-events-auto'}
        ${black ? 'text-neutral-200 bg-neutral-900 hover:bg-neutral-200 hover:text-neutral-900 border border-transparent hover:border-neutral-300' : 'text-neutral-800 bg-neutral-100 hover:bg-neutral-800 hover:text-neutral-100 border border-neutral-300 hover:border-transparent'}
        ${text.toLowerCase().includes('delete') && 'bg-red-600'}
      `}
      onClick={() => onClick()}
    >
      <span>{text}</span>
    </button>
  )
}

export function LinkButton({
  text, link, disabled = false
}: {
  text: string;
  link: string;
  disabled?: boolean;
}) {
  return (
    <Link
      to={link}
      className={`
        hover:opacity-100 cursor-pointer transition-opacity
        ${disabled ? 'opacity-40 pointer-events-none' : 'opacity-70 pointer-events-auto'}
      `}
    >
      <span>{text}</span>
    </Link>
  )
}

export function IconButton({
  icon, onClick, disabled = false, title, active = false
}: {
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  active?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      className={`
        aspect-square p-1 rounded transition-colors cursor-pointer flex items-center justify-center
        ${disabled ? 'opacity-40 pointer-events-none' : 'opacity-100 pointer-events-auto'}
        ${active ? 'bg-neutral-400/40' : 'bg-transparent hover:bg-neutral-400/20'}
      `}
      onClick={() => onClick()}
      title={title}
    >
      {icon}
    </button>
  )
}

export function IconButtonEvent({
  icon, onClick, disabled = false, title
}: {
  icon: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  title?: string
}) {
  return (
    <button
      disabled={disabled}
      className={`
        aspect-square p-1 rounded transition-colors cursor-pointer flex items-center justify-center
        bg-transparent hover:bg-neutral-400/20
        ${disabled ? 'opacity-40 pointer-events-none' : 'opacity-100 pointer-events-auto'}
      `}
      onClick={onClick}
      title={title}
    >
      {icon}
    </button>
  );
}
