import { getStatusColor, getStatusText } from "@/lib/appointment-status";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({
  status,
  className = "rounded-full px-2 py-1 text-xs font-semibold",
}: StatusBadgeProps) {
  return (
    <span className={`${getStatusColor(status)} ${className}`}>
      {getStatusText(status)}
    </span>
  );
}
