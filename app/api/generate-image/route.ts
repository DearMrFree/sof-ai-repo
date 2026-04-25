import { type NextRequest, NextResponse } from 'next/server'
import * as fal from '@fal-ai/serverless-client'

// Configure fal client
fal.config({
  credentials: process.env.FAL_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { prompt, aspectRatio = '16:9' } = await request.json()

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    // Map aspect ratio to fal image size
    const imageSizeMap: Record<string, string> = {
      '16:9': 'landscape_16_9',
      '9:16': 'portrait_16_9',
      '1:1': 'square_hd',
      '4:3': 'landscape_4_3',
    }

    const imageSize = imageSizeMap[aspectRatio] || 'landscape_16_9'

    // Generate image using the fal Flux model
    const result = await fal.subscribe('fal-ai/flux/schnell', {
      input: {
        prompt,
        image_size: imageSize,
        num_inference_steps: 4,
        num_images: 1,
      },
    }) as { images?: { url: string }[] }

    const imageUrl = result.images?.[0]?.url

    if (!imageUrl) {
      throw new Error('No image generated')
    }

    return NextResponse.json({ imageUrl })
  } catch (error) {
    console.error('Error generating image:', error)
    return NextResponse.json(
      { error: 'Failed to generate image' },
      { status: 500 },
    )
  }
}
