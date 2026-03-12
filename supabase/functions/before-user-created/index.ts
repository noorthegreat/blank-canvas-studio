import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'

Deno.serve(async (req: Request) => {
    const payload = await req.text()
    const secret = Deno.env.get('BEFORE_USER_CREATED_HOOK_SECRET')?.replace('v1,whsec_', '')
    const headers = Object.fromEntries(req.headers)

    try {
        const wh = new Webhook(secret || '')
        wh.verify(payload, headers)

        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    } catch (error) {
        return new Response(JSON.stringify({ error: { message: 'Invalid request format or signature', http_code: 400 } }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        })
    }
})
