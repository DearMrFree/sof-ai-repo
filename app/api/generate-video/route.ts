import { type NextRequest, NextResponse } from 'next/server'
import * as fal from '@fal-ai/serverless-client'

// Configure fal client
fal.config({
  credentials: process.env.FAL_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { prompt, imageUrl } = await request.json()

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    // If we have an image URL, generate video from image
    // Otherwise, first generate an image, then convert to video
    let sourceImageUrl = imageUrl

    if (!sourceImageUrl) {
      // Generate the source image first using Flux
      const imageResult = await fal.subscribe('fal-ai/flux/schnell', {
        input: {
          prompt: prompt,
          image_size: 'landscape_16_9',
          num_inference_steps: 4,
          num_images: 1,
        },
      }) as { images?: { url: string }[] }

      sourceImageUrl = imageResult.images?.[0]?.url

      if (!sourceImageUrl) {
        throw new Error('Failed to generate source image')
      }
    }

    // Generate video from the image using Kling
    const videoResult = await fal.subscribe('fal-ai/kling-video/v1/standard/image-to-video', {
      input: {
        prompt: prompt,
        image_url: sourceImageUrl,
        duration: '5',
        aspect_ratio: '16:9',
      },
    }) as { video?: { url: string } }

    const videoUrl = videoResult.video?.url

    if (!videoUrl) {
      throw new Error('No video generated')
    }

    return NextResponse.json({ 
      videoUrl,
      sourceImageUrl 
    })
  } catch (error) {
    console.error('Error generating video:', error)
    return NextResponse.json(
      { error: 'Failed to generate video. Please try again.' },
      { status: 500 },
    )
  }
}
