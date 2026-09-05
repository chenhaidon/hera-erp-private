/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string = string> extends Record<string, unknown> {
      StaticRoutes: `/` | `/(app)` | `/(app)/(tabs)` | `/(app)/(tabs)/home` | `/(app)/(tabs)/production` | `/(app)/(tabs)/profile` | `/(app)/(tabs)/quality` | `/(app)/approvals` | `/(app)/home` | `/(app)/inventory` | `/(app)/marketing` | `/(app)/production` | `/(app)/profile` | `/(app)/purchase` | `/(app)/quality` | `/(app)/scan-report` | `/(app)/settings` | `/(app)/settings/account-cancel` | `/(app)/settings/data-list` | `/(app)/settings/privacy` | `/(auth)` | `/(auth)/sign-in` | `/(tabs)` | `/(tabs)/home` | `/(tabs)/production` | `/(tabs)/profile` | `/(tabs)/quality` | `/_sitemap` | `/approvals` | `/home` | `/inventory` | `/marketing` | `/production` | `/profile` | `/purchase` | `/quality` | `/scan-report` | `/settings` | `/settings/account-cancel` | `/settings/data-list` | `/settings/privacy` | `/sign-in`;
      DynamicRoutes: `/(app)/approvals/${Router.SingleRoutePart<T>}` | `/(app)/inventory/${Router.SingleRoutePart<T>}` | `/(app)/marketing/${Router.SingleRoutePart<T>}` | `/(app)/production/${Router.SingleRoutePart<T>}` | `/(app)/purchase/${Router.SingleRoutePart<T>}` | `/(app)/quality/${Router.SingleRoutePart<T>}` | `/approvals/${Router.SingleRoutePart<T>}` | `/inventory/${Router.SingleRoutePart<T>}` | `/marketing/${Router.SingleRoutePart<T>}` | `/production/${Router.SingleRoutePart<T>}` | `/purchase/${Router.SingleRoutePart<T>}` | `/quality/${Router.SingleRoutePart<T>}`;
      DynamicRouteTemplate: `/(app)/approvals/[id]` | `/(app)/inventory/[id]` | `/(app)/marketing/[id]` | `/(app)/production/[id]` | `/(app)/purchase/[id]` | `/(app)/quality/[id]` | `/approvals/[id]` | `/inventory/[id]` | `/marketing/[id]` | `/production/[id]` | `/purchase/[id]` | `/quality/[id]`;
    }
  }
}
