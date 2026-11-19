// Supabase Edge Function: parse-voice-expense
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-api-version, *',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
      status: 200,
    });
  }

  try {
    const { voiceText, categories, accounts } = await req.json();

    if (!voiceText || typeof voiceText !== 'string' || !voiceText.trim()) {
      return new Response(JSON.stringify({ error: 'voiceText is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Safely read and trim the Groq API key from Supabase Secrets
    const rawKey = Deno.env.get('GROQ_API_KEY');
    const GROQ_API_KEY = rawKey ? rawKey.trim() : null;

    if (!GROQ_API_KEY) {
      return new Response(
        JSON.stringify({
          error: 'GROQ_API_KEY is not configured in Supabase secrets.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const categoryList = (categories || []).map((c: any) => ({
      id: c.id,
      name: c.category_name,
    }));
    const accountList = (accounts || []).map((a: any) => ({
      id: a.id,
      name: a.account_name,
    }));

    const systemPrompt = `You are an intelligent financial assistant for the Trackerlio expense management system.
Your job is to extract expense transaction details from the user's spoken voice command into structured JSON.
Current reference date: ${todayStr}.

Available Categories:
${JSON.stringify(categoryList)}

Available Accounts:
${JSON.stringify(accountList)}

Rules:
1. "expense_name": Identify the item or merchant (e.g. "Biryani", "Groceries", "Uber", "Petrol"). Capitalize words properly.
2. "amount": Extract numeric currency amount as a positive number (e.g. "400 rupees" -> 400).
3. "category_id": Find best matching category ID from Available Categories list. If no match, return null.
4. "account_id": Find best matching account ID from Available Accounts list (e.g. "SBI" -> "SBI Bank"). If no match, return null.
5. "expense_date": Infer date in YYYY-MM-DD format (defaults to ${todayStr}).
6. "comments": Set to the original spoken command.

Output MUST be a single valid JSON object strictly matching this schema:
{
  "expense_name": string,
  "amount": number,
  "expense_date": string,
  "category_id": string | null,
  "account_id": string | null,
  "comments": string
}`;

    // Target the allowed models
    const modelsToTry = [
      'llama-3.1-8b-instant',
      'llama-3.3-70b-versatile',
      'openai/gpt-oss-120b',
    ];

    let groqData: any = null;
    let lastError: string = '';

    for (const model of modelsToTry) {
      try {
        const groqResponse = await fetch(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${GROQ_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: voiceText.trim() },
              ],
              response_format: { type: 'json_object' },
              temperature: 0.1,
            }),
          }
        );

        if (groqResponse.ok) {
          groqData = await groqResponse.json();
          break;
        } else {
          lastError = await groqResponse.text();
        }
      } catch (err: any) {
        lastError = err?.message || 'Network error';
      }
    }

    if (!groqData) {
      return new Response(JSON.stringify({ error: `Groq error: ${lastError}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawContent = groqData.choices[0].message.content;
    const parsedResult = JSON.parse(rawContent);

    return new Response(JSON.stringify(parsedResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Internal error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
