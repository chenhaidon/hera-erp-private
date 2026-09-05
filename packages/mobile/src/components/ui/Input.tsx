import { forwardRef } from "react";
import { Text, TextInput, type TextInputProps, View } from "react-native";
import { cn } from "@/lib/utils";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerClassName?: string;
}

export const Input = forwardRef<TextInput, InputProps>(
  ({ label, error, className, containerClassName, ...props }, ref) => {
    return (
      <View className={cn("mb-4", containerClassName)}>
        {label && (
          <Text className="text-sm font-medium text-foreground mb-1.5">
            {label}
          </Text>
        )}
        <TextInput
          ref={ref}
          placeholderTextColor="#94a3b8"
          className={cn(
            "border border-border bg-background rounded-xl px-4 py-3.5 text-base text-foreground",
            error && "border-destructive",
            className,
          )}
          {...props}
        />
        {error && <Text className="text-sm text-destructive mt-1">{error}</Text>}
      </View>
    );
  },
);
