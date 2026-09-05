import { createClient } from 'jsr:@supabase/supabase-js@2'
import QRCode from 'npm:qrcode'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { text } = await req.json()
    if (!text) {
      return new Response(JSON.stringify({ error: '缺少 text 参数' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const pngBuffer = await QRCode.toBuffer(text, { type: 'png', width: 300 })
    const filename = `${crypto.randomUUID()}.png`
    const { data, error } = await supabase.storage.from('qrcodes').upload(filename, pngBuffer, { contentType: 'image/png' })
    if (error) throw error

    const { data: urlData } = supabase.storage.from('qrcodes').getPublicUrl(data.path)
    return new Response(JSON.stringify({ url: urlData.publicUrl }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err: any) {
    console.error('generate-qrcode error:', err)
    return new Response(JSON.stringify({ error: err.message || '生成二维码失败' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
