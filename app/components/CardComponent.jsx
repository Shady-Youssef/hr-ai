export function Card({ children }) {
  return (
    <div className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-xl shadow-sm p-6 transition-colors duration-300">
      {children}
    </div>
  );
}