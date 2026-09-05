import { createClient } from 'jsr:@supabase/supabase-js@2'
import QRCode from 'npm:qrcode'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function generateQrCode(workNo: string) {
  const qrText = `workNo=${workNo}`
  const pngBuffer = await QRCode.toBuffer(qrText, { type: 'png', width: 300 })
  const filename = `${crypto.randomUUID()}.png`
  const { data, error } = await supabase.storage.from('qrcodes').upload(filename, pngBuffer, { contentType: 'image/png' })
  if (error) throw error
  const { data: urlData } = supabase.storage.from('qrcodes').getPublicUrl(data!.path)
  return { qrText, imageUrl: urlData.publicUrl }
}

async function handleListWorkOrders() {
  const { data, error } = await supabase
    .from('work_orders')
    .select('id, work_no, product_code, product_name, plan_quantity, completed_quantity, progress, status, operations')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return jsonResponse(data)
}

function normalizeOperations(workOrder: any) {
  const ops = (workOrder.operations || []) as any[]
  const planQty = workOrder.plan_quantity || 0

  return ops.map((op, index) => {
    const completed = op.completed === true
    const completedQty = completed
      ? planQty
      : (op.completed_quantity ?? op.completed_qty ?? 0)
    let status = op.status
    if (!status) {
      if (completed) {
        status = 'completed'
      } else if (index === 0 || ops.slice(0, index).every((o) => o.completed === true || (o.completed_quantity ?? o.completed_qty ?? 0) >= planQty)) {
        status = 'running'
      } else {
        status = 'pending'
      }
    }
    return {
      ...op,
      sequence: op.sequence ?? index + 1,
      plan_quantity: planQty,
      completed_quantity: completedQty,
      completed: completedQty >= planQty,
      status,
    }
  })
}

async function handleGetWorkOrder(workNo: string) {
  const { data, error } = await supabase
    .from('work_orders')
    .select('id, work_no, product_code, product_name, plan_quantity, completed_quantity, progress, status, operations, remark, created_at, product:products!work_orders_product_id_fkey (code, name, sizes)')
    .eq('work_no', workNo)
    .maybeSingle()
  if (error) throw error
  if (!data) return jsonResponse({ error: '工单不存在' }, 404)

  const normalizedOps = normalizeOperations(data)
  const processNames = normalizedOps.map((op) => op.name)

  // 读取已存在的质检记录
  const { data: inspections } = await supabase
    .from('process_inspection_records')
    .select('process_name, result')
    .eq('work_no', workNo)
    .in('process_name', processNames)

  const inspectionMap = new Map((inspections || []).map((i: any) => [i.process_name, i.result]))

  const finalOps = normalizedOps.map((op) => {
    if (op.status === 'completed') {
      const result = inspectionMap.get(op.name)
      if (result === 'qualified') return { ...op, qc_status: 'qualified' }
      if (result === 'unqualified') return { ...op, status: 'unqualified', qc_status: 'unqualified' }
      // 已完工但未质检 -> 待质检
      return { ...op, status: 'qc', qc_status: 'pending' }
    }
    return op
  })

  // 工序标准：未配置时给出默认示例
  const { data: standards } = await supabase
    .from('quality_standards')
    .select('*')
    .in('category', processNames)
    .limit(100)
  const process_standards = processNames.map((name) => {
    const found = (standards || []).find((s: any) => s.category === name)
    if (found) return { name, standard: found.physical?.tolerance || '符合标准' }
    return { name, standard: '符合工艺要求' }
  })

  return jsonResponse({
    work_order: {
      ...data,
      start_date: '-',
      end_date: '-',
      process_route: '-',
      spec: '-',
      color: '-',
      operations: finalOps,
      process_standards,
    },
  })
}

async function handleGetFlowCard(workNo: string) {
  const { data: workOrder, error: workOrderError } = await supabase
    .from('work_orders')
    .select('id, work_no, product_code, product_name, plan_quantity, completed_quantity, progress, status, operations, remark, created_at')
    .eq('work_no', workNo)
    .maybeSingle()
  if (workOrderError) throw workOrderError
  if (!workOrder) return jsonResponse({ error: '工单不存在' }, 404)

  const enrichedWorkOrder = {
    ...workOrder,
    product_name: workOrder.product_name || workOrder.product?.name || '-',
    spec: workOrder.spec || (workOrder.product?.sizes || []).join(',') || '-',
    color: workOrder.color || '-',
    start_date: workOrder.start_date || '-',
    end_date: workOrder.end_date || '-',
    process_route: workOrder.process_route || (workOrder.operations || []).map((o: any) => o.name).join(' → ') || '-',
    remark: workOrder.remark || 'AI Agent 创建',
  }

  let { data: card } = await supabase
    .from('work_order_cards')
    .select('*')
    .eq('work_no', workNo)
    .maybeSingle()

  if (!card) {
    const { qrText, imageUrl } = await generateQrCode(workNo)
    const { data: inserted, error: insertError } = await supabase
      .from('work_order_cards')
      .insert({ work_order_id: workOrder.id, work_no: workNo, qr_text: qrText, image_url: imageUrl })
      .select()
      .single()
    if (insertError) throw insertError
    card = inserted
  }

  return jsonResponse({ work_order: enrichedWorkOrder, flow_card: card })
}

async function handleReport(workNo: string, body: any) {
  const { process_name, completed_qty, remark = '', operator_role = 'worker' } = body
  if (!process_name || !completed_qty) {
    return jsonResponse({ error: '缺少工序名称或完成数量' }, 400)
  }

  const { data: workOrder, error } = await supabase
    .from('work_orders')
    .select('id, plan_quantity, completed_quantity, progress, status, operations')
    .eq('work_no', workNo)
    .single()
  if (error) throw error

  const planQty = workOrder.plan_quantity || 0
  const normalizedOps = normalizeOperations(workOrder)

  const operations = normalizedOps.map((op: any) => {
    if (op.name === process_name) {
      const newCompleted = (op.completed_quantity || 0) + completed_qty
      const isCompleted = newCompleted >= planQty
      return {
        ...op,
        completed: isCompleted,
        completed_quantity: newCompleted,
        completed_qty: newCompleted,
        status: isCompleted ? 'qc' : 'running',
      }
    }
    return op
  })

  // 工单完成数量 = 当前进行中工序的完成数量；若全部完成则为计划数量
  const activeOp = operations.find((op: any) => !op.completed)
  const newCompletedQty = activeOp ? (activeOp.completed_quantity || 0) : planQty
  const progress = planQty > 0 ? Math.round((newCompletedQty / planQty) * 100) : 0
  const status = progress >= 100 ? 'qc' : 'producing'

  const { error: updateError } = await supabase
    .from('work_orders')
    .update({ completed_quantity: newCompletedQty, progress, status, operations })
    .eq('id', workOrder.id)
  if (updateError) throw updateError

  const { error: insertError } = await supabase
    .from('work_reports')
    .insert({ work_order_id: workOrder.id, work_no: workNo, process_name, completed_qty, operator_role, remark })
  if (insertError) throw insertError

  return jsonResponse({ success: true })
}

async function handleInspect(workNo: string, body: any) {
  const { process_name, result, items = [], remark = '' } = body
  if (!process_name || !result) {
    return jsonResponse({ error: '缺少工序名称或判定结果' }, 400)
  }

  const { data: workOrder, error } = await supabase
    .from('work_orders')
    .select('id, plan_quantity, operations')
    .eq('work_no', workNo)
    .single()
  if (error) throw error

  const planQty = workOrder.plan_quantity || 0
  const normalizedOps = normalizeOperations(workOrder)

  const operations = normalizedOps.map((op: any) => {
    if (op.name === process_name) {
      const completed = op.completed_quantity >= planQty
      return {
        ...op,
        completed,
        status: result === 'qualified' ? 'completed' : 'unqualified',
        qc_status: result,
        inspection_result: result,
      }
    }
    // 解锁下一道工序
    if (result === 'qualified') {
      const prev = normalizedOps.find((o: any) => o.name === process_name)
      if (prev && (op.sequence || 0) === ((prev.sequence || 0) + 1)) {
        return { ...op, status: op.status === 'pending' ? 'running' : op.status }
      }
    }
    return op
  })

  const { error: updateError } = await supabase
    .from('work_orders')
    .update({ operations })
    .eq('id', workOrder.id)
  if (updateError) throw updateError

  const { error: insertError } = await supabase
    .from('process_inspection_records')
    .insert({ work_order_id: workOrder.id, work_no: workNo, process_name, result, items, remark })
  if (insertError) throw insertError

  return jsonResponse({ success: true })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const url = new URL(req.url)
  const path = url.pathname.replace('/mp-api', '').replace(/\/$/, '') || '/'
  try {
    if (path === '/work-orders' && req.method === 'GET') {
      return await handleListWorkOrders()
    }

    const workOrderMatch = path.match(/^\/work-orders\/([^/]+)$/)
    if (workOrderMatch && req.method === 'GET') {
      return await handleGetWorkOrder(workOrderMatch[1])
    }

    const flowCardMatch = path.match(/^\/flow-card\/([^/]+)$/)
    if (flowCardMatch && req.method === 'GET') {
      return await handleGetFlowCard(flowCardMatch[1])
    }

    const reportMatch = path.match(/^\/work-orders\/([^/]+)\/report$/)
    if (reportMatch && req.method === 'POST') {
      return await handleReport(reportMatch[1], await req.json())
    }

    const inspectMatch = path.match(/^\/work-orders\/([^/]+)\/inspect$/)
    if (inspectMatch && req.method === 'POST') {
      return await handleInspect(inspectMatch[1], await req.json())
    }

    return jsonResponse({ error: 'Not found' }, 404)
  } catch (err: any) {
    console.error('mp-api error:', err)
    return jsonResponse({ error: err.message || 'Internal error' }, 500)
  }
})
