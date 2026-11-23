package expo.modules.verificationcamera

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import android.util.Base64
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

internal const val CAPTURE_POLICY = "android-memory-jpeg-v1"
internal const val MAX_JPEG_BYTES = 2 * 1024 * 1024
internal const val MAX_JPEG_EDGE = 1600
internal const val MAX_INPUT_PIXELS = 12_000_000L

class GuideCrop : Record {
  @Field var originX: Int = 0
  @Field var originY: Int = 0
  @Field var width: Int = 0
  @Field var height: Int = 0
}

internal class MemoryImageException : CodedException("The camera image could not be processed safely.")

internal object MemoryJpegEncoder {
  // Destructive/one-shot: this consumes the source bitmap, on success AND failure.
  // No EXIF/GPS/thumbnail metadata is copied into the newly rendered pixels.
  fun encode(source: Bitmap, crop: GuideCrop): Map<String, Any> {
    var rendered: Bitmap? = null
    try {
      if (source.isRecycled || source.width.toLong() * source.height > MAX_INPUT_PIXELS
        || max(source.width, source.height) > 6000 || min(crop.width, crop.height) < 450
        || crop.originX < 0 || crop.originY < 0
        || crop.originX.toLong() + crop.width > source.width
        || crop.originY.toLong() + crop.height > source.height) throw MemoryImageException()

      val scale = min(1.0, MAX_JPEG_EDGE.toDouble() / max(crop.width, crop.height))
      val width = (crop.width * scale).roundToInt()
      val height = (crop.height * scale).roundToInt()
      if (min(width, height) < 450) throw MemoryImageException()

      // Crop and downscale directly into a bounded bitmap, not a full-size copy.
      val output = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
      rendered = output
      val canvas = Canvas(output)
      canvas.drawColor(Color.WHITE)
      canvas.drawBitmap(
        source,
        Rect(crop.originX, crop.originY, crop.originX + crop.width, crop.originY + crop.height),
        RectF(0f, 0f, width.toFloat(), height.toFloat()),
        Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
      )

      for (quality in intArrayOf(88, 80, 72)) {
        BoundedJpegBuffer(MAX_JPEG_BYTES).use { buffer ->
          val compressed = try {
            output.compress(Bitmap.CompressFormat.JPEG, quality, buffer)
          } catch (_: Exception) {
            if (!buffer.overflowed) throw MemoryImageException()
            false
          }
          if (compressed && !buffer.overflowed && buffer.size >= 4) {
            val encoded = buffer.useBytes { bytes, count ->
              Base64.encodeToString(bytes, 0, count, Base64.NO_WRAP)
            }
            return mapOf(
              "imageBase64" to encoded,
              "width" to width,
              "height" to height,
              "byteLength" to buffer.size,
              "mimeType" to "image/jpeg"
            )
          }
          if (!buffer.overflowed) throw MemoryImageException()
        }
      }
      throw MemoryImageException()
    } catch (_: Exception) {
      throw MemoryImageException() // no raw exception, cause, path, or image is forwarded
    } catch (_: OutOfMemoryError) {
      throw MemoryImageException()
    } finally {
      rendered?.let { if (!it.isRecycled) { it.eraseColor(Color.TRANSPARENT); it.recycle() } }
      dispose(source)
    }
  }

  fun dispose(bitmap: Bitmap) {
    if (!bitmap.isRecycled) bitmap.recycle()
  }
}
