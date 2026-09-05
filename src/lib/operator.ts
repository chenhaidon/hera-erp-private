// 当前操作者信息（供 store 层记录操作日志使用，避免 store 直接依赖 React Context）
export interface OperatorInfo {
  username: string;
  fullName: string;
  role: string;
}

let current: OperatorInfo | null = null;

export function setOperator(op: OperatorInfo | null) {
  current = op;
}

export function getOperator(): OperatorInfo {
  return (
    current ?? {
      username: 'unknown',
      fullName: 'unknown',
      role: 'unknown',
    }
  );
}