const VARIANT_CLASS = {
  primary: "bg-[#bd8c31] text-white hover:bg-[#a67927]",
  secondary: "bg-[#2d8c86] text-white hover:bg-[#24746f]",
  outline: "border border-[#e2e4e0] bg-white text-[#343235] hover:bg-[#f1f4f2]",
  ghost: "bg-transparent text-[#747579] hover:bg-[#eef2f0]",
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
      className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#e2e4e0] bg-white text-[#343235] transition-colors hover:bg-[#f1f4f2] ${className}`}
      {...props}
    >
      <Icon size={18} />
    </button>
  );
}
