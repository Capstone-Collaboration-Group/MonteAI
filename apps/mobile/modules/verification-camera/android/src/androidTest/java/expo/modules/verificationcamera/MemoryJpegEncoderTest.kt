package expo.modules.verificationcamera

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.util.Base64
import androidx.exifinterface.media.ExifInterface
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.ByteArrayInputStream
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MemoryJpegEncoderTest {
  private fun crop(x: Int, y: Int, width: Int, height: Int) = GuideCrop().apply {
    originX = x; originY = y; this.width = width; this.height = height
  }

  @Test fun realAndroidJpegRoundTripsAndConsumesSource() {
    val source = Bitmap.createBitmap(2400, 3200, Bitmap.Config.ARGB_8888)
    source.eraseColor(Color.GREEN)
    val result = MemoryJpegEncoder.encode(source, crop(480, 480, 1440, 2240))
    assertTrue(source.isRecycled)
    assertEquals(setOf("imageBase64", "width", "height", "byteLength", "mimeType"), result.keys)
    assertEquals("image/jpeg", result["mimeType"])
    assertEquals(1029, result["width"])
    assertEquals(1600, result["height"])
    val bytes = Base64.decode(result["imageBase64"] as String, Base64.NO_WRAP)
    try {
      assertEquals(result["byteLength"], bytes.size)
      assertTrue(bytes.size <= MAX_JPEG_BYTES)
      assertEquals(0xff, bytes[0].toInt() and 255)
      assertEquals(0xd8, bytes[1].toInt() and 255)
      assertEquals(0xff, bytes[bytes.size - 2].toInt() and 255)
      assertEquals(0xd9, bytes.last().toInt() and 255)
      val decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
      try { assertEquals(1029, decoded.width); assertEquals(1600, decoded.height) }
      finally { decoded.recycle() }
      ByteArrayInputStream(bytes).use { stream ->
        val exif = ExifInterface(stream)
        for (tag in listOf(ExifInterface.TAG_GPS_LATITUDE, ExifInterface.TAG_GPS_LONGITUDE,
          ExifInterface.TAG_DATETIME_ORIGINAL, ExifInterface.TAG_MAKE, ExifInterface.TAG_MODEL)) {
          assertNull(exif.getAttribute(tag))
        }
      }
    } finally { bytes.fill(0) }
  }

  @Test fun cropSelectsTheGuideRatherThanTheFullFrame() {
    val source = Bitmap.createBitmap(1600, 1600, Bitmap.Config.ARGB_8888)
    source.eraseColor(Color.RED)
    Canvas(source).drawRect(400f, 400f, 1200f, 1200f, Paint().apply { color = Color.GREEN })
    val result = MemoryJpegEncoder.encode(source, crop(450, 450, 700, 700))
    val bytes = Base64.decode(result["imageBase64"] as String, Base64.NO_WRAP)
    try {
      val decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
      try {
        val pixel = decoded.getPixel(350, 350)
        assertTrue(Color.green(pixel) > 200)
        assertTrue(Color.red(pixel) < 30)
        assertEquals(700, decoded.width)
      } finally { decoded.recycle() }
    } finally { bytes.fill(0) }
  }

  @Test fun noisyPixelsStayInsideTheDecodedAndBase64Limits() {
    val source = Bitmap.createBitmap(1600, 1600, Bitmap.Config.ARGB_8888)
    val row = IntArray(1600)
    var seed = 1234567
    try {
      for (y in 0 until 1600) {
        for (x in row.indices) { seed = seed * 1664525 + 1013904223; row[x] = seed or (255 shl 24) }
        source.setPixels(row, 0, 1600, 0, y, 1600, 1)
      }
      val result = MemoryJpegEncoder.encode(source, crop(0, 0, 1600, 1600))
      val count = result["byteLength"] as Int
      assertTrue(count <= MAX_JPEG_BYTES)
      assertEquals(4 * ((count + 2) / 3), (result["imageBase64"] as String).length)
    } finally { row.fill(0); MemoryJpegEncoder.dispose(source) }
  }

  @Test fun invalidCropsConsumeTheSourceAndReturnOnlyStaticErrors() {
    for (invalid in listOf(crop(-1, 0, 450, 450), crop(0, 0, 0, 500), crop(400, 0, 500, 500))) {
      val source = Bitmap.createBitmap(800, 800, Bitmap.Config.ARGB_8888)
      try { MemoryJpegEncoder.encode(source, invalid); fail("Expected crop rejection") }
      catch (error: MemoryImageException) {
        assertEquals("The camera image could not be processed safely.", error.message)
        assertNull(error.cause)
        assertTrue(source.isRecycled)
      }
    }
  }

  @Test fun inputPixelBudgetIsRecheckedNatively() {
    val source = Bitmap.createBitmap(3500, 3500, Bitmap.Config.ARGB_8888)
    try { MemoryJpegEncoder.encode(source, crop(0, 0, 700, 1120)); fail("Expected pixel rejection") }
    catch (_: MemoryImageException) { assertTrue(source.isRecycled) }
  }

  @Test fun noUpscalingAndRepeatedDisposalIsSafe() {
    val source = Bitmap.createBitmap(720, 1120, Bitmap.Config.ARGB_8888)
    val result = MemoryJpegEncoder.encode(source, crop(0, 0, 720, 1120))
    assertEquals(720, result["width"])
    assertEquals(1120, result["height"])
    MemoryJpegEncoder.dispose(source)
    MemoryJpegEncoder.dispose(source)
    assertTrue(source.isRecycled)
  }

  @Test fun encoderSuccessAndFailureProduceNoObservedFileWrites() {
    val probe = CaptureFileWriteProbe(InstrumentationRegistry.getInstrumentation().targetContext)
    val started = probe.start()
    try {
      assertEquals(true, started["coverageComplete"])
      assertTrue((started["directoryCount"] as Int) > 0)
      val source = Bitmap.createBitmap(720, 1120, Bitmap.Config.ARGB_8888)
      MemoryJpegEncoder.encode(source, crop(0, 0, 720, 1120))
      val invalid = Bitmap.createBitmap(720, 1120, Bitmap.Config.ARGB_8888)
      try { MemoryJpegEncoder.encode(invalid, crop(0, 0, 0, 0)) } catch (_: MemoryImageException) { /* expected */ }
      // Let the platform observer dispatch any queued events before ending the interval.
      CountDownLatch(1).await(350, TimeUnit.MILLISECONDS)
      assertEquals(0, probe.report()["writeEventCount"])
    } finally { probe.stop() }
  }

  @Test fun positiveControlDetectsATransientEmptyFileEvenAfterDeletion() {
    val context = InstrumentationRegistry.getInstrumentation().targetContext
    val probe = CaptureFileWriteProbe(context)
    probe.start()
    var sentinel: File? = null
    try {
      // Intentionally empty test sentinel, NEVER a capture or encoded image.
      sentinel = File.createTempFile("idv-empty-observer-control-", ".tmp", context.cacheDir)
      assertTrue(sentinel.delete())
      CountDownLatch(1).await(350, TimeUnit.MILLISECONDS)
      assertTrue((probe.report()["writeEventCount"] as Int) > 0)
    } finally { sentinel?.delete(); probe.stop() }
  }
}
