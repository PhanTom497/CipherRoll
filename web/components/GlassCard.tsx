import { cn } from "@/lib/utils";
import { ReactNode, HTMLAttributes } from "react";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

const GlassCard = ({ children, className, hover = true, ...props }: GlassCardProps) => {
  return (
    <div
      className={cn(
        "glass-card p-6 transition-all duration-500",
        hover && "hover:scale-[1.02] hover:border-white/20 hover:shadow-[0_0_40px_-10px_rgba(255,255,255,0.1)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export default GlassCard;
