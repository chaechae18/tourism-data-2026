const VARIANT_CLASS = {
  primary: "bg-[#b8661c] text-white hover:bg-[#934b13]",
  secondary: "bg-[#287c70] text-white hover:bg-[#1d6259]",
  outline: "border border-[#d9cfc2] bg-white text-[#241b16] hover:bg-[#fff8ec]",
  ghost: "bg-transparent text-[#6f6256] hover:bg-[#f3ece3]",
  danger: "bg-[#a8463d] text-white hover:bg-[#87352e]",
};

const SIZE_CLASS = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-5 text-base",
};

export default function AppButton({
  children,
  className = "",
  icon: Icon,
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`}
      {...props}
    >
      {Icon && <Icon size={size === "sm" ? 15 : 17} />}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, label, className = "", ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#d9cfc2] bg-white text-[#241b16] transition-colors hover:bg-[#fff8ec] ${className}`}
      {...props}
    >
      <Icon size={18} />
    </button>
  );
}
