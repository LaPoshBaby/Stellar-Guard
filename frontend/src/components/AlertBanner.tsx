interface Props { message: string; onDismiss: () => void; }

export function AlertBanner({ message, onDismiss }: Props) {
  return (
    <div className="flex items-center justify-between bg-stellar-danger/20 border border-stellar-danger rounded-lg px-4 py-3 text-sm">
      <span>{message}</span>
      <button onClick={onDismiss} className="ml-4 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">✕</button>
    </div>
  );
}
