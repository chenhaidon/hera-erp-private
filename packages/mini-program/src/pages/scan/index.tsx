import { useEffect } from 'react';
import Taro from '@tarojs/taro';
import { View, Text } from '@tarojs/components';
import { withRouteGuard } from '@/components/RouteGuard';
import { getEmployeeById } from '@/db/api';
import { getCache, setCache } from '@/utils/cache';
import type { Employee } from '@/db/types';

const CURRENT_EMPLOYEE_KEY = 'current_employee';

function parseEmployeeCode(data: string): string | null {
  const prefix = 'jinlong:employee:';
  if (data.startsWith(prefix)) {
    return data.slice(prefix.length).trim();
  }
  return null;
}

function ScanPage() {
  useEffect(() => {
    Taro.scanCode({
      success: async (res) => {
        const result = res.result || '';
        const employeeId = parseEmployeeCode(result);
        if (employeeId) {
          try {
            const emp = await getEmployeeById(employeeId);
            if (emp) {
              const employee: Employee = {
                id: emp.id,
                code: emp.code,
                name: emp.name,
                department: emp.department,
                position: emp.position,
                status: emp.status,
              };
              setCache(CURRENT_EMPLOYEE_KEY, employee, 24 * 60);
              Taro.showModal({
                title: '身份识别成功',
                content: `当前操作人：${employee.name}（${employee.code}）`,
                showCancel: false,
                success: () => Taro.navigateBack(),
              });
              return;
            }
          } catch {
            // ignore
          }
          Taro.showToast({ title: '未找到该员工档案', icon: 'none' });
          Taro.navigateBack();
          return;
        }
        Taro.showModal({ title: '扫描结果', content: result, showCancel: false });
      },
      fail: () => {
        Taro.showToast({ title: '扫码失败', icon: 'none' });
        Taro.navigateBack();
      },
    });
  }, []);

  return (
    <View className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <Text className="text-muted">正在调起扫码...</Text>
    </View>
  );
}

export { getCache, CURRENT_EMPLOYEE_KEY };
export default withRouteGuard(ScanPage);
