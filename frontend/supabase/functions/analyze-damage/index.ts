import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64) throw new Error("No image provided");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an expert smartphone screen damage analysis AI. Analyze the provided image of a smartphone screen and return a structured JSON response using the suggest_damage_report tool. 

Evaluate the following damage types:
- Hairline Cracks
- Shattered Glass  
- Dead Pixels
- Black Spots
- Discoloration
- Touch Sensitivity Issues
- LCD Bleeding

For each, determine if detected (true/false) and confidence (0-100).

Calculate an overall damage score (0-100, where 100 = completely destroyed).
Determine severity: "Low" (score <25), "Moderate" (25-50), "High" (50-75), "Critical" (>75).
Estimate repair cost range in USD.
Provide 3-5 actionable recommendations.
Classify the primary damage category.

If the image is NOT a smartphone screen, still respond but note that in recommendations.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this smartphone screen image for damage." },
              { type: "image_url", image_url: { url: imageBase64 } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_damage_report",
              description: "Return a structured damage analysis report for a smartphone screen.",
              parameters: {
                type: "object",
                properties: {
                  overallScore: { type: "number", description: "Damage score 0-100" },
                  severity: { type: "string", enum: ["Low", "Moderate", "High", "Critical"] },
                  classification: { type: "string", description: "Primary damage category e.g. 'Cracked Screen', 'LCD Damage', 'Minor Scratches'" },
                  damageTypes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string" },
                        detected: { type: "boolean" },
                        confidence: { type: "number" },
                      },
                      required: ["type", "detected", "confidence"],
                    },
                  },
                  estimatedCost: { type: "string", description: "Cost range e.g. '$50 - $120'" },
                  recommendations: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
                required: ["overallScore", "severity", "classification", "damageTypes", "estimatedCost", "recommendations"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_damage_report" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error("No tool call response from AI");
    }

    const report = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-damage error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
