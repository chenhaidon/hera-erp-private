import { serve } from 'https://deno.land/std/http/server.ts';

interface OcrRequest {
  url?: string;
  image?: string;
  pdf_file?: string;
  pdf_file_num?: string;
  ofd_file?: string;
  ofd_file_num?: string;
  language_type?: string;
  detect_direction?: boolean;
  paragraph?: boolean;
  probability?: boolean;
  multidirectional_recognize?: boolean;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let body: OcrRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { url, image, pdf_file, ofd_file, pdf_file_num, ofd_file_num, language_type, detect_direction, paragraph, probability, multidirectional_recognize } = body;

  if (!url && !image && !pdf_file && !ofd_file) {
    return new Response(JSON.stringify({ error: 'Missing url, image, pdf_file or ofd_file' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = Deno.env.get('INTEGRATIONS_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const params: Record<string, string> = {};
  if (url) params.url = url;
  if (image) params.image = image;
  if (pdf_file) params.pdf_file = pdf_file;
  if (pdf_file_num) params.pdf_file_num = pdf_file_num;
  if (ofd_file) params.ofd_file = ofd_file;
  if (ofd_file_num) params.ofd_file_num = ofd_file_num;
  if (language_type) params.language_type = language_type;
  if (detect_direction !== undefined) params.detect_direction = String(detect_direction);
  if (paragraph !== undefined) params.paragraph = String(paragraph);
  if (probability !== undefined) params.probability = String(probability);
  if (multidirectional_recognize !== undefined) params.multidirectional_recognize = String(multidirectional_recognize);

  const upstream = await fetch(
    'https://app-crmh8tn256v5-api-eLMlJ2jB44g9-gateway.appmiaoda.com/rest/2.0/ocr/v1/accurate_basic',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Gateway-Authorization': `Bearer ${apiKey}`,
      },
      body: new URLSearchParams(params).toString(),
    }
  );

  if (upstream.status === 429 || upstream.status === 402) {
    const errText = await upstream.text();
    return new Response(errText, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!upstream.ok) {
    return new Response(
      JSON.stringify({ error: `Upstream error: ${upstream.status}` }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const data = await upstream.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
