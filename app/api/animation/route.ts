import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req) {
  try {
    const { prompt } = await req.json();
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{
        role: 'user',
        content: `Summarize in 10-20 words: ${prompt}`
      }],
      temperature: 0.5,
      max_tokens: 50
    });

    return NextResponse.json({
      summary: completion.choices[0].message.content.trim()
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Summary failed' },
      { status: 500 }
    );
  }
}