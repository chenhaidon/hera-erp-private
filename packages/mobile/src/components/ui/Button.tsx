import { forwardRef } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { cn } from "@/lib/utils";

interface ButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: "default" | "secondary" | "outline" | "destructive" | "ghost";
  size?: "default" | "sm" | "lg";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  textClassName?: string;
}

export const Button = forwardRef<View, ButtonProps>(
  (
    {
      children,
      onPress,
      variant = "default",
      size = "default",
      disabled,
      loading,
      className,
      textClassName,
    },
    ref,
  ) => {
    return (
      <Pressable
        ref={ref}
        onPress={onPress}
        disabled={disabled || loading}
        className={cn(
          "flex-row items-center justify-center rounded-xl active:opacity-90",
          size === "default" && "py-3.5 px-4",
          size === "sm" && "py-2 px-3",
          size === "lg" && "py-4 px-6",
          variant === "default" && "bg-primary",
          variant === "secondary" && "bg-secondary",
          variant === "outline" && "border border-border bg-background",
          variant === "destructive" && "bg-destructive",
          variant === "ghost" && "bg-transparent",
          (disabled || loading) && "opacity-50",
          className,
        )}
      >
        {loading && (
          <View className="mr-2">
            <ActivityIndicator
              size="small"
              color={variant === "default" || variant === "destructive" ? "white" : "#000"}
            />
          </View>
        )}
        <Text
          className={cn(
            "font-semibold text-base",
            variant === "default" && "text-primary-foreground",
            variant === "secondary" && "text-secondary-foreground",
            variant === "outline" && "text-foreground",
            variant === "destructive" && "text-destructive-foreground",
            variant === "ghost" && "text-foreground",
            textClassName,
          )}
        >
          {children}
        </Text>
      </Pressable>
    );
  },
);
