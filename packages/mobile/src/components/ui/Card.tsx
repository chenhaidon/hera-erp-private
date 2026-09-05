import { Text, View, type ViewProps } from "react-native";
import { cn } from "@/lib/utils";

export function Card({ className, children, ...props }: ViewProps) {
  return (
    <View
      className={cn(
        "bg-card rounded-2xl border border-border p-4",
        className,
      )}
      {...props}
    >
      {children}
    </View>
  );
}

export function CardTitle({ className, children, ...props }: ViewProps) {
  return (
    <View className={cn("mb-2", className)} {...props}>
      {typeof children === "string" ? (
        <Text className="text-base font-semibold text-foreground">{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}
