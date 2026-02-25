export function Button({ children, onClick, variant = "primary" }) {
  const base =
    "px-4 py-2 rounded-lg transition font-medium";

  const styles =
    variant === "primary"
      ? "bg-primary hover:bg-primary-hover text-white"
      : "border border-border dark:border-border-dark";

  return (
    <button onClick={onClick} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}