import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// The four categories we ask Claude to sort a video frame into.
const CATEGORIES = [
  "match",
  "goalkeeper_training",
  "fitness_training",
  "unknown",
] as const;

const client = new Anthropic();

export async function POST(request: NextRequest) {
  const { imageBase64 } = await request.json();

  if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
    return NextResponse.json(
      { error: "Missing imageBase64" },
      { status: 400 }
    );
  }

  // The frontend sends a data URL like "data:image/jpeg;base64,...".
  // Claude's vision input just wants the raw base64 data, so strip the prefix.
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: base64Data,
              },
            },
            {
              type: "text",
              text: "This is one frame from a soccer video. Classify it into exactly one category and estimate how confident you are.",
            },
          ],
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              category: { type: "string", enum: CATEGORIES },
              confidence: {
                type: "integer",
                description: "0-100 confidence in the category",
              },
            },
            required: ["category", "confidence"],
            additionalProperties: false,
          },
        },
      },
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude");
    }

    const result = JSON.parse(textBlock.text);
    return NextResponse.json(result);
  } catch (error) {
    console.error("classify-video failed:", error);
    return NextResponse.json(
      { error: "Classification failed" },
      { status: 500 }
    );
  }
}
