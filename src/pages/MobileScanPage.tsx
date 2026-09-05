import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { ScanLine, Camera, X, AlertCircle, Loader2, ChevronDown, UserCog, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore } from '@/store';
import { toast } from 'sonner';
import { routeWorkOrder, type ScanRouteResult } from './MobileScanRoute';
import MobileScanReportPage from './MobileScanReportPage';
import MobileScanInspectPage from './MobileScanInspectPage';
import MobileScanOutsourcingPage from './MobileScanOutsourcingPage';
import MobileEquipmentPage from './MobileEquipmentPage';
import MobileWorkOrderPage from './MobileWorkOrderPage';
import { decodeQrFromFile } from '@/lib/qrDecode';
import type { WorkOrder } from '@/types';

type PermissionErrorType = 'denied' | 'not_found' | 'unsupported' | 'unknown';

interface PermissionErrorInfo {
  type: PermissionErrorType;
  title: string;
  message: string;
  steps: string[];
}

function classifyPermissionError(err: any): PermissionErrorInfo | null {
  const name = err?.name || '';
  const message = err?.message || '';
  const combined = `${name} ${message}`.toLowerCase();
  const isWeChat = /MicroMessenger/i.test(navigator.userAgent);

  if (
    name === 'NotAllowedError' ||
    name === 'PermissionDeniedError' ||
    combined.includes('permission denied') ||
    combined.includes('not allowed') ||
    combined.includes('用户拒绝了') ||
    combined.includes('permission dismissed')
  ) {
    return {
      type: 'denied',
      title: '摄像头权限未开启',
      message: isWeChat
        ? '微信内置浏览器无法直接调用摄像头，建议点击下方「选择图片识别」按钮，从相册中选择已拍摄的二维码，或在手机设置中开启微信相机权限。'
        : '浏览器没有摄像头权限，建议直接使用「选择图片识别」从相册选择二维码，或按下方步骤开启权限后重试。',
      steps: isWeChat
        ? [
            '点击「选择图片识别」按钮，从相册中选择二维码图片',
            '或进入手机设置 → 应用管理 → 微信 → 权限 → 相机，允许访问',
            '返回页面后，点击「重新扫描二维码」',
          ]
        : [
            '直接点击「选择图片识别」按钮，从相册中选择二维码图片',
            '或点击浏览器地址栏左侧的锁形/设置图标',
            '找到「摄像头」或「相机」权限，选择「允许」',
            '返回页面后，点击「重新扫描二维码」',
          ],
    };
  }

  if (
    name === 'NotFoundError' ||
    name === 'DevicesNotFoundError' ||
    combined.includes('not found') ||
    combined.includes('找不到') ||
    combined.includes('no camera')
  ) {
    return {
      type: 'not_found',
      title: '未检测到摄像头',
      message: '当前设备没有可用摄像头，或摄像头被其他应用占用。',
      steps: [
        '检查设备是否有摄像头',
        '关闭其他可能占用摄像头的应用',
        '点击下方「选择图片识别」，从相册中选择二维码图片',
        '或直接手动输入工单号',
      ],
    };
  }

  if (
    name === 'NotSupportedError' ||
    combined.includes('not supported') ||
    combined.includes('不支持') ||
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {
    return {
      type: 'unsupported',
      title: '当前浏览器不支持摄像头',
      message: '该浏览器或环境不支持直接调用摄像头，建议从相册中选择已拍摄的二维码图片。',
      steps: [
        '点击下方「选择图片识别」按钮',
        '从相册中选择二维码图片',
        '或直接手动输入工单号',
      ],
    };
  }

  return null;
}

import { MobileUserMenu } from '@/components/common/MobileUserMenu';

export default function MobileScanPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const pendingWorkNo = searchParams.get('workNo');
  const pendingEquipmentId = searchParams.get('equipmentId');
  const { profile, loading: authLoading } = useAuth();
  const location = useLocation();
  const currentRole = useAppStore((state) => state.currentRole);
  const store = useAppStore();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraErrorInfo, setCameraErrorInfo] = useState<PermissionErrorInfo | null>(null);
  const [mode, setMode] = useState<'scan' | 'report' | 'inspect' | 'outsourcing' | 'admin' | 'block' | 'equipment' | 'workorder'>('scan');

  // 扫码工作台及工单处理均要求登录，未登录时跳转到登录页并携带回跳地址
  useEffect(() => {
    if (authLoading) return;
    if (!profile) {
      const from = `${location.pathname}${location.search}`;
      navigate(`/mobile/login?from=${encodeURIComponent(from)}`, { replace: true });
    }
  }, [authLoading, profile, location.pathname, location.search, navigate]);
  const [routeResult, setRouteResult] = useState<ScanRouteResult | null>(null);
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 始终指向最新的扫码结果处理函数，避免 useCallback 闭包过期（store 数据异步加载后旧闭包为空）
  const handleScanResultRef = useRef<(t: string) => void>();

  const role = profile?.role || currentRole;
  // 管理员可切换测试角色
  const [testRole, setTestRole] = useState<'worker' | 'quality' | 'outsourcing' | 'admin'>('worker');
  const effectiveRole = role === 'admin' ? testRole : role;

  // 工单号下拉候选
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestions = useMemo(() => {
    if (!manualInput.trim()) return [];
    const q = manualInput.trim().toUpperCase();
    return store.workOrders
      .filter((w) => w.work_no.toUpperCase().includes(q))
      .map((w) => w.work_no)
      .slice(0, 8);
  }, [manualInput, store.workOrders]);

  const startScan = useCallback(async () => {
    if (scannerRef.current) return;
    setCameraError(null);
    setCameraErrorInfo(null);

    // 安全上下文检测：getUserMedia 仅在 HTTPS 或 localhost 下可用
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      const info: PermissionErrorInfo = {
        type: 'unsupported',
        title: '当前页面非安全环境，无法调用摄像头',
        message: '浏览器要求摄像头必须在 HTTPS 安全页面或本地 localhost 下才能使用，当前页面为 HTTP 明文访问。',
        steps: [
          '请通过 HTTPS 链接访问本系统',
          '或在手机上使用「选择图片识别」从相册选择二维码',
          '或直接手动输入工单号',
        ],
      };
      setCameraError(info.title);
      setCameraErrorInfo(info);
      toast.error(info.title);
      return;
    }

    try {
      // 先主动请求摄像头权限，部分浏览器（如微信内置浏览器）在直接调用 Html5Qrcode.getCameras 时可能失败
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
          });
          // 释放测试流，避免占用摄像头
          stream.getTracks().forEach((track) => track.stop());
        } catch (permErr: any) {
          // 用户拒绝或浏览器不支持，给出明确引导
          const info = classifyPermissionError(permErr);
          if (info) {
            setCameraError(info.title);
            setCameraErrorInfo(info);
            toast.error('摄像头权限未开启：' + info.message);
            return;
          }
          console.warn('[MobileScanPage] getUserMedia permission check failed', permErr);
        }
      } else {
        // navigator.mediaDevices 不存在（非安全上下文或浏览器不支持）
        const info = classifyPermissionError({ name: 'NotSupportedError' });
        if (info) {
          setCameraError(info.title);
          setCameraErrorInfo(info);
          toast.error(info.title);
        } else {
          setCameraError('当前浏览器不支持摄像头，请使用「选择图片识别」');
        }
        return;
      }

      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) {
        const info = classifyPermissionError({ name: 'NotFoundError' });
        if (info) {
          setCameraError(info.title);
          setCameraErrorInfo(info);
        } else {
          setCameraError('未检测到摄像头，请使用手动输入或拍照识别');
        }
        toast.error('未检测到摄像头，请使用手动输入或拍照识别');
        return;
      }
      const scanner = new Html5Qrcode('mobile-qr-reader', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decodedText) => {
          if (loading) return;
          setLoading(true);
          try {
            await handleScanResultRef.current?.(decodedText);
          } finally {
            setLoading(false);
          }
        },
        () => {}
      );
      setScanning(true);
      setCameraError(null);
      setCameraErrorInfo(null);
    } catch (err: any) {
      const info = classifyPermissionError(err);
      if (info) {
        setCameraError(info.title);
        setCameraErrorInfo(info);
        toast.error('无法启动摄像头，请检查权限设置：' + info.message);
      } else {
        const message = err?.message || '无法启动摄像头';
        setCameraError(message);
        toast.error('无法启动摄像头，请检查权限设置：' + message);
      }
      setScanning(false);
    }
  }, [loading]);

  const handleFileCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setCameraError(null);
    setCameraErrorInfo(null);
    try {
      // 使用 jsQR 在多尺寸下解析二维码，识别率高于 html5-qrcode 的 scanFile
      const decodedText = await decodeQrFromFile(file);
      if (!decodedText) {
        toast.error('未识别到二维码，请确保图片清晰、完整且二维码占比较大');
        return;
      }
      await handleScanResultRef.current?.(decodedText);
    } catch (err: any) {
      console.warn('[MobileScanPage] decodeQrFromFile failed', err);
      toast.error('图片解析失败：' + (err?.message || '未知错误'));
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, []);

  const openFileCapture = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const stopScan = useCallback(async () => {
    if (scannerRef.current) {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      try {
        await Promise.race([
          scanner.stop(),
          new Promise<void>((_, reject) => setTimeout(() => reject(new Error('stop timeout')), 3000)),
        ]);
      } catch {
        // ignore
      }
      try {
        await scanner.clear();
      } catch {
        // ignore
      }
    }
    setScanning(false);
    setCameraError(null);
    setCameraErrorInfo(null);
  }, []);

  useEffect(() => {
    if (mode === 'scan' && !pendingWorkNo && !pendingEquipmentId) {
      startScan();
    } else {
      stopScan();
    }
    return () => {
      stopScan();
    };
  }, [mode, startScan, stopScan, pendingWorkNo, pendingEquipmentId]);

  // 核心分流：根据指定工单与操作类型解析并切换页面（不依赖 state，避免闭包过期）
  const routeToAction = useCallback(
    (wo: WorkOrder, action: 'report' | 'inspect' | 'outsourcing') => {
      const roleForAction = action === 'report' ? 'worker' : action === 'inspect' ? 'quality' : 'outsourcing';
      try {
        // eslint-disable-next-line no-console
        console.log('[MobileScanPage] routeToAction', { action, roleForAction, workNo: wo.work_no });
        const result = routeWorkOrder(wo.work_no, roleForAction, store);
        if (result.action === 'block') {
          setRouteResult(result);
          setMode('block');
          return;
        }
        setRouteResult(result);
        setMode(result.action);
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[MobileScanPage] routeToAction threw', err);
        toast.error(err.message || '工单分流失败');
      }
    },
    [store]
  );

  // 工单信息页按钮：使用当前 state 中的工单
  const handleWorkOrderAction = useCallback(
    (action: 'report' | 'inspect' | 'outsourcing') => {
      if (!workOrder) return;
      routeToAction(workOrder, action);
    },
    [workOrder, routeToAction]
  );

  const handleWorkNo = useCallback(
    async (workNo: string) => {
      if (!workNo) {
        console.warn('[MobileScanPage] handleWorkNo: workNo is empty');
        return;
      }
      if (!profile) {
        const from = `/mobile/scan?workNo=${encodeURIComponent(workNo)}`;
        navigate(`/mobile/login?from=${encodeURIComponent(from)}`, { replace: true });
        return;
      }
      // eslint-disable-next-line no-console
      console.log('[MobileScanPage] handleWorkNo start', { workNo, totalWorkOrders: store.workOrders.length });

      const found = store.workOrders.find((w) => w.work_no === workNo);
      if (!found) {
        // eslint-disable-next-line no-console
        console.warn('[MobileScanPage] handleWorkNo: workOrder not found', {
          workNo,
          availableWorkNos: store.workOrders.map((w) => w.work_no).slice(0, 10),
        });
        toast.error('未找到该工单，请检查工单号');
        return;
      }
      // eslint-disable-next-line no-console
      console.log('[MobileScanPage] handleWorkNo: workOrder found', { id: found.id, work_no: found.work_no, status: found.status });

      // 将工单号同步到 URL，刷新后仍能按当前逻辑处理
      const next = new URLSearchParams(searchParams);
      next.set('workNo', workNo);
      setSearchParams(next, { replace: true });

      setWorkOrder(found);

      // 管理员保留工单信息页，便于切换测试角色
      if (effectiveRole === 'admin') {
        setMode('workorder');
        return;
      }

      // 生产人员 / 一线工人直接报工
      if (effectiveRole === 'worker' || effectiveRole === 'production') {
        routeToAction(found, 'report');
        return;
      }

      // 质检人员直接质检
      if (effectiveRole === 'quality') {
        routeToAction(found, 'inspect');
        return;
      }

      // 内部外协员直接外协
      if (effectiveRole === 'outsourcing') {
        routeToAction(found, 'outsourcing');
        return;
      }

      toast.error('当前角色暂无可执行的扫码操作');
    },
    [store.workOrders, profile, navigate, searchParams, setSearchParams, effectiveRole, routeToAction]
  );

  const handleEquipment = useCallback(
    async (equipmentId: string) => {
      if (!equipmentId) {
        console.warn('[MobileScanPage] handleEquipment: equipmentId is empty');
        return;
      }
      const found = store.equipment.find((e) => e.id === equipmentId);
      if (!found) {
        toast.error('未找到该设备，请检查二维码');
        return;
      }
      // 未登录时先跳转到登录页，登录后回跳设备详情页
      if (!profile) {
        navigate('/mobile/login', {
          state: { from: `/mobile/equipment?equipmentId=${encodeURIComponent(equipmentId)}` },
          replace: true,
        });
        return;
      }
      navigate(`/mobile/equipment?equipmentId=${encodeURIComponent(equipmentId)}`, { replace: true });
    },
    [navigate, profile, store.equipment]
  );

  const handleScanResult = async (decodedText: string) => {
    const trimmed = decodedText.trim();
    const equipmentId = parseEquipmentId(trimmed);
    if (equipmentId) {
      await handleEquipment(equipmentId);
      return;
    }
    const workNo = parseWorkNo(trimmed);
    if (!workNo) {
      toast.error('二维码无效，请扫描生产流转卡或设备二维码');
      return;
    }
    await handleWorkNo(workNo);
  };
  handleScanResultRef.current = handleScanResult;

  // 原生相机扫码后通过 URL 携带参数打开本页：自动识别并展示对应页面
  useEffect(() => {
    if (authLoading) return;
    if (pendingWorkNo) {
      // 已经在该工单信息页时不再重复跳转，保留 URL 中的 workNo 以便刷新后仍停留
      if (mode === 'workorder' && workOrder?.work_no === pendingWorkNo) {
        return;
      }
      const found = store.workOrders.find((w) => w.work_no === pendingWorkNo);
      if (found) {
        handleWorkNo(pendingWorkNo);
        return;
      }
    }
    if (pendingEquipmentId) {
      const found = store.equipment.find((e) => e.id === pendingEquipmentId);
      if (found) {
        handleEquipment(pendingEquipmentId);
        const next = new URLSearchParams(searchParams);
        next.delete('equipmentId');
        setSearchParams(next, { replace: true });
      }
    }
  }, [authLoading, pendingWorkNo, pendingEquipmentId, mode, workOrder, store.workOrders, store.equipment, handleWorkNo, handleEquipment, searchParams, setSearchParams]);

  const handleManualSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const workNo = parseWorkNo(manualInput);
      // eslint-disable-next-line no-console
      console.log('[MobileScanPage] handleManualSubmit', { raw: manualInput, parsed: workNo });
      if (!workNo) {
        toast.error('请输入有效的生产工单号');
        return;
      }
      setLoading(true);
      try {
        await handleWorkNo(workNo);
      } finally {
        setLoading(false);
      }
    },
    [handleWorkNo, manualInput]
  );

  const backToScan = useCallback(() => {
    setMode('scan');
    setRouteResult(null);
    setManualInput('');
    // 返回扫码工作台时清除 URL 中的 workNo/equipmentId，避免自动再次跳回工单信息/设备页
    const next = new URLSearchParams(searchParams);
    let changed = false;
    if (next.has('workNo')) {
      next.delete('workNo');
      changed = true;
    }
    if (next.has('equipmentId')) {
      next.delete('equipmentId');
      changed = true;
    }
    if (changed) {
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const backToWorkOrder = useCallback(() => {
    const workNo = workOrder?.work_no || routeResult?.workOrder?.work_no;
    if (workNo) {
      navigate(`/mobile/scan?workNo=${encodeURIComponent(workNo)}`, { replace: true });
      return;
    }
    setMode('workorder');
  }, [workOrder, routeResult, navigate]);

  const handleComplete = useCallback(() => {
    // 操作完成后回到工单信息页（刷新最新工单数据），而非扫码工作台
    const workNo = routeResult?.workOrder?.work_no;
    const latest = workNo ? store.workOrders.find((w) => w.work_no === workNo) : null;
    if (latest && workNo) {
      setWorkOrder(latest);
      navigate(`/mobile/scan?workNo=${encodeURIComponent(workNo)}`, { replace: true });
    } else {
      setMode('scan');
    }
    setRouteResult(null);
    setManualInput('');
  }, [routeResult, store.workOrders, navigate]);

  if (mode === 'report' && routeResult?.workOrder) {
    return (
      <MobileScanReportPage
        workNo={routeResult.workOrder.work_no}
        opCode={routeResult.workOrder.targetOperation?.code}
        onBack={backToWorkOrder}
        onComplete={handleComplete}
      />
    );
  }

  if (mode === 'inspect' && routeResult?.workOrder) {
    return (
      <MobileScanInspectPage
        workNo={routeResult.workOrder.work_no}
        opCode={routeResult.workOrder.targetOperation?.code}
        onBack={backToWorkOrder}
        onComplete={handleComplete}
      />
    );
  }

  if (mode === 'outsourcing' && routeResult?.workOrder) {
    return (
      <MobileScanOutsourcingPage
        workNo={routeResult.workOrder.work_no}
        opCode={routeResult.workOrder.targetOperation?.code}
        onBack={backToWorkOrder}
        onComplete={handleComplete}
      />
    );
  }

  if (mode === 'equipment') {
    return (
      <MobileEquipmentPage
        onBack={backToScan}
      />
    );
  }

  if (mode === 'workorder' && workOrder) {
    return (
      <MobileWorkOrderPage
        workOrder={workOrder}
        isAdmin={role === 'admin'}
        role={effectiveRole}
        onBack={backToScan}
        onAction={handleWorkOrderAction}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 items-center border-b border-border bg-card px-4">
        <h1 className="flex-1 text-center text-lg font-semibold text-foreground">扫码工作台</h1>
        <MobileUserMenu />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center p-6">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
            <ScanLine className="h-10 w-10 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">当前角色：{roleLabel(effectiveRole)}</p>
          {role === 'admin' && (
            <div className="mt-2 flex items-center justify-center gap-2">
              <UserCog className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">管理员切换测试角色：</span>
              <div className="flex rounded-lg border border-border bg-card p-0.5">
                {(['worker', 'quality', 'outsourcing', 'admin'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setTestRole(r)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      testRole === r
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {roleLabel(r)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">扫描生产流转卡二维码，系统自动分流</p>
        </div>

        <div className="relative mb-6 w-full max-w-sm">
          <div
            id="mobile-qr-reader"
            className={`relative w-full overflow-hidden rounded-2xl border border-border bg-muted ${
              scanning ? 'aspect-square' : 'hidden'
            }`}
          />
          {scanning && cameraError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-muted p-6 text-center">
              <Camera className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">摄像头未就绪</p>
              <p className="mt-1 text-xs text-muted-foreground">{cameraError}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={openFileCapture}
                disabled={loading}
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                选择图片识别
              </Button>
            </div>
          )}
        </div>

        {!scanning && cameraErrorInfo && (
          <div className="mb-6 w-full max-w-sm rounded-2xl border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="flex-1">
                <p className="font-medium">{cameraErrorInfo.title}</p>
                <p className="mt-1 text-sm text-destructive/90">{cameraErrorInfo.message}</p>
                <ul className="mt-2 list-inside list-decimal space-y-1 text-sm text-destructive/90">
                  {cameraErrorInfo.steps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
                    onClick={startScan}
                    disabled={loading}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    重新扫描二维码
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
                    onClick={openFileCapture}
                    disabled={loading}
                  >
                    <ImagePlus className="mr-2 h-4 w-4" />
                    选择图片识别
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {!scanning && cameraError && !cameraErrorInfo && (
          <div className="mb-6 w-full max-w-sm rounded-2xl border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="flex-1">
                <p className="font-medium">无法启动摄像头</p>
                <p className="mt-1 text-sm text-destructive/90">{cameraError}</p>
              </div>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileCapture}
        />

        {!scanning && (
          <div className="flex w-full max-w-sm flex-col gap-3">
            <Button
              size="lg"
              className="h-16 w-full rounded-2xl text-lg font-semibold active:scale-[0.98]"
              onClick={startScan}
              disabled={loading}
            >
              {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Camera className="mr-2 h-6 w-6" />}
              {loading ? '识别中...' : '扫描二维码'}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-12 w-full rounded-2xl text-base font-medium active:scale-[0.98]"
              onClick={openFileCapture}
              disabled={loading}
            >
              <ImagePlus className="mr-2 h-5 w-5" />
              选择图片识别
            </Button>
          </div>
        )}

        {scanning && (
          <Button
            variant="outline"
            size="lg"
            className="mt-4 h-12 w-full max-w-sm rounded-xl"
            onClick={stopScan}
          >
            <X className="mr-2 h-5 w-5" />
            取消扫码
          </Button>
        )}

        <div className="my-6 w-full max-w-sm">
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
            <span className="relative bg-background px-3 text-sm text-muted-foreground">或手动输入工单号</span>
          </div>
        </div>

        <form
          className="flex w-full max-w-sm gap-2"
          onSubmit={handleManualSubmit}
        >
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              type="text"
              placeholder="请输入工单号，如 WO-2026-0001"
              value={manualInput}
              onChange={(e) => { setManualInput(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              className="h-12 w-full"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                {suggestions.map((wn) => (
                  <li
                    key={wn}
                    className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm hover:bg-muted"
                    onMouseDown={() => { setManualInput(wn); setShowSuggestions(false); }}
                  >
                    <ChevronDown className="h-3.5 w-3.5 rotate-[-90deg] text-muted-foreground" />
                    <span className="font-medium text-foreground">{wn}</span>
                  </li>
                ))}
              </ul>
            )}
            {showSuggestions && manualInput.trim().length >= 2 && suggestions.length === 0 && (
              <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
                <p className="text-xs text-muted-foreground">未找到匹配工单，请核对工单号</p>
              </div>
            )}
          </div>
          <Button type="submit" size="lg" className="h-12 px-4 active:scale-[0.98]" disabled={loading}>
            确认
          </Button>
        </form>
      </main>

      <Dialog open={mode === 'block'} onOpenChange={() => (workOrder ? setMode('workorder') : backToScan())}>
        <DialogContent className="max-w-[calc(100%-2rem)] rounded-2xl md:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              当前工序不可报工
            </DialogTitle>
            <DialogDescription>{mode === 'block' && routeResult ? reasonText(routeResult.reason) : ''}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button className="w-full" onClick={() => (workOrder ? setMode('workorder') : backToScan())}>
              我知道了
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function parseWorkNo(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/workNo=([^&\s]+)/);
  if (match) return decodeURIComponent(match[1]);
  // 允许直接是工单号
  if (/^[A-Za-z0-9\-_]+$/.test(trimmed)) return trimmed;
  return null;
}

function parseEquipmentId(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/equipmentId=([^&\s]+)/);
  if (match) return decodeURIComponent(match[1]);
  return null;
}

function roleLabel(role?: string) {
  switch (role) {
    case 'worker':
      return '一线工人';
    case 'quality':
      return '质检员';
    case 'outsourcing':
      return '外协管理';
    case 'admin':
      return '管理员';
    case 'production':
      return '生产管理';
    default:
      return '内部人员';
  }
}

function reasonText(reason?: ScanRouteResult['reason']) {
  switch (reason) {
    case 'prev_not_completed':
      return '当前工序不可报工（原因：前序未完成）';
    case 'pending_qc':
      return '当前工序不可报工（原因：待质检）';
    case 'not_outsourcing':
      return '该工单无外协工序或外协工序已开工';
    case 'outsourcing_not_pending':
      return '该工单外协工序已开工或已完成';
    case 'outsourcing_role_mismatch':
      return '当前工序为外协工序，请切换为内部外协员角色扫码处理';
    case 'role_mismatch':
    default:
      return '当前角色暂无可执行的操作';
  }
}
